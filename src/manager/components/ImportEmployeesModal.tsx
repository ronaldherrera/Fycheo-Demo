import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { employeeService } from '../services/employeeService';
import { CustomSelect } from './ui/CustomSelect';

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Empleado Base' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr', label: 'RRHH' },
  { value: 'admin', label: 'Administrador' }
];

interface ImportEmployeesModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedEmployee {
  email: string;
  name: string;
  phone?: string;
  role: string;
  dni_nie?: string;
  ss_number?: string;
}

export const ImportEmployeesModal: React.FC<ImportEmployeesModalProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrors(['Por favor, sube un archivo con formato .csv']);
      return;
    }

    setFile(file);
    setErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const newParsed: ParsedEmployee[] = [];
        const newErrors: string[] = [];

        data.forEach((row, index) => {
          if (!row.email) {
            newErrors.push(`Fila ${index + 1}: Falta el email.`);
          } else if (!row.nombre) {
            newErrors.push(`Fila ${index + 1}: Falta el nombre.`);
          } else {
            newParsed.push({
              email: row.email.trim(),
              name: row.nombre.trim(),
              phone: row.telefono ? row.telefono.trim() : undefined,
              role: 'employee',
              dni_nie: row.dni ? row.dni.trim() : undefined,
              ss_number: row['seguridad social'] ? row['seguridad social'].trim() : undefined
            });
          }
        });

        if (newParsed.length === 0 && newErrors.length === 0) {
          newErrors.push('El archivo parece estar vacío o no tiene las columnas correctas (email, nombre, telefono, dni, seguridad social).');
        }

        setErrors(newErrors);
        setParsedData(newParsed);
      },
      error: (error) => {
        setErrors([`Error al procesar el archivo: ${error.message}`]);
      }
    });
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);
    setErrors([]);

    try {
      const companyId = localStorage.getItem('active_company_id');
      if (!companyId) throw new Error('No company ID found');

      // Call service to import
      await employeeService.importEmployeesBulk(parsedData, companyId);
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrors([err.message || 'Error desconocido al importar']);
      setIsUploading(false);
    }
  };

  const handleRoleChange = (email: string, newRole: string) => {
    setParsedData(prev => prev.map(emp => 
      emp.email === email ? { ...emp, role: newRole } : emp
    ));
  };

  const handleMassRoleChange = (newRole: string) => {
    if (!newRole) return;
    setParsedData(prev => prev.map(emp => ({ ...emp, role: newRole })));
  };

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,email,nombre,telefono,dni,seguridad social\njuan@empresa.com,Juan Pérez,+34600123456,12345678Z,011234567812\nana@empresa.com,Ana López,+34600654321,87654321X,018765432100";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plantilla_fycheo.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#151B2B] rounded-2xl border border-white/10 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white">Importar Empleados</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-auto flex-1">
          {!file ? (
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer bg-white/5"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Sube tu archivo CSV</h3>
              <p className="text-slate-400 text-sm mb-6">Arrastra el archivo aquí o haz clic para buscarlo</p>
              
              <button 
                onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                className="text-primary hover:text-blue-400 text-sm flex items-center justify-center gap-2 mx-auto"
              >
                <FileText size={16} /> Descargar plantilla de ejemplo
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="flex items-center gap-3">
                  <FileText className="text-primary" size={24} />
                  <div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setFile(null); setParsedData([]); setErrors([]); }}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  Cambiar archivo
                </button>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                    <AlertCircle size={18} /> Hay errores en el archivo
                  </div>
                  <ul className="text-sm text-red-300 space-y-1 list-disc pl-5">
                    {errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                    {errors.length > 5 && <li>...y {errors.length - 5} errores más.</li>}
                  </ul>
                </div>
              )}

              {parsedData.length > 0 && errors.length === 0 && (
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                      <CheckCircle size={18} /> {parsedData.length} empleados listos
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 w-[300px]">
                      <span className="text-xs text-slate-400 shrink-0">Asignar rol a todos:</span>
                      <div className="w-full">
                        <CustomSelect 
                          value=""
                          onChange={handleMassRoleChange}
                          options={ROLE_OPTIONS}
                          placeholder="Selecciona..."
                          size="sm"
                          variant="table"
                          className="w-full bg-transparent border-0 text-white hover:bg-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border border-white/5 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-3 rounded-tl-lg">Nombre</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Teléfono</th>
                          <th className="p-3">Rol</th>
                          <th className="p-3">DNI/NIE</th>
                          <th className="p-3 rounded-tr-lg">Num. SS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {parsedData.slice(0, 10).map((emp, i) => (
                          <tr key={i} className="text-slate-300">
                            <td className="p-3">{emp.name}</td>
                            <td className="p-3">{emp.email}</td>
                            <td className="p-3">{emp.phone || '-'}</td>
                            <td className="p-3">
                              <CustomSelect 
                                value={emp.role} 
                                onChange={(val) => handleRoleChange(emp.email, val)}
                                options={ROLE_OPTIONS}
                                size="sm"
                                variant="table"
                                usePortal={true}
                                className="w-[140px] bg-black/30 border-white/10 hover:bg-black/50"
                              />
                            </td>
                            <td className="p-3">{emp.dni_nie || '-'}</td>
                            <td className="p-3">{emp.ss_number || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedData.length > 10 && (
                      <div className="text-center p-2 text-xs text-slate-500 bg-white/5">
                        Mostrando 10 de {parsedData.length} empleados
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-surface-dark">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            disabled={isUploading}
          >
            Cancelar
          </button>
          <button 
            onClick={handleImport}
            disabled={parsedData.length === 0 || errors.length > 0 || isUploading}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? 'Importando...' : `Importar ${parsedData.length} empleados`}
          </button>
        </div>

      </div>
    </div>
  );
};
