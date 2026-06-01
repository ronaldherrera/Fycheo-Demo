import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Loader2, X, Eye, Download, File as FileIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { employeeService } from '../services/employeeService';
import { documentService } from '../services/documentService';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useAuth } from '../contexts/AuthContext';
import type { Employee } from '../types';

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileMatch {
  file: File;
  detectedDni: string | null;
  employee: Employee | null;
  status: UploadStatus;
  error?: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const extractDni = (filename: string): string | null => {
  const match = filename.match(/\b(\d{8}[A-Za-z])\b/i);
  return match ? match[1].toUpperCase() : null;
};

const BulkNominas = () => {
  const { activeCompany } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewFile) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(previewFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  useEffect(() => {
    if (!activeCompany?.id) return;
    employeeService.getEmployees(activeCompany.id)
      .then(data => setEmployees(data.filter(e => e.accepted !== false && !!e.dni_nie && !!e.ss_number)))
      .catch(console.error);
  }, [activeCompany?.id]);

  const processFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    setMatches(prev => {
      const existingNames = new Set(prev.map(m => m.file.name));
      const newItems: FileMatch[] = arr
        .filter(f => !existingNames.has(f.name))
        .map(file => {
          const dni = extractDni(file.name);
          const employee = dni
            ? employees.find(e =>
                e.dni_nie?.replace(/\s/g, '').toUpperCase() === dni
              ) ?? null
            : null;
          return { file, detectedDni: dni, employee, status: 'pending' };
        });
      return [...prev, ...newItems];
    });
  }, [employees]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const assignEmployee = (index: number, employeeId: string) => {
    const emp = employeeId ? employees.find(e => e.id === employeeId) ?? null : null;
    setMatches(prev => prev.map((m, i) => i === index ? { ...m, employee: emp } : m));
  };

  const removeMatch = (index: number) => {
    setMatches(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!activeCompany?.id) return;
    const period = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const title = `Nómina ${MONTHS[selectedMonth]} ${selectedYear}`;
    setUploading(true);

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (!m.employee || m.status !== 'pending') continue;

      setMatches(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'uploading' } : item
      ));

      try {
        await documentService.uploadDocument(
          m.file, activeCompany.id, m.employee.id, 'nomina', title, period
        );
        setMatches(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'done' } : item
        ));
      } catch (err: any) {
        setMatches(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', error: err.message } : item
        ));
      }
    }

    setUploading(false);
  };

  const readyCount  = matches.filter(m => m.employee && m.status === 'pending').length;
  const doneCount   = matches.filter(m => m.status === 'done').length;
  const errorCount  = matches.filter(m => m.status === 'error').length;
  const noMatchCount = matches.filter(m => !m.employee && m.status === 'pending').length;
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const StatusIcon = ({ status, error }: { status: UploadStatus; error?: string }) => {
    if (status === 'uploading') return <Loader2 size={16} className="text-primary animate-spin" />;
    if (status === 'done')      return <CheckCircle2 size={16} className="text-emerald-400" />;
    if (status === 'error')     return <span title={error}><XCircle size={16} className="text-red-400" /></span>;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Nóminas Masivas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Sube nóminas para varios empleados a la vez. Incluye el DNI en el nombre del archivo para el auto-matching.
        </p>
      </div>

      {/* Periodo */}
      <div className="bg-white/5 rounded-2xl border border-white/5 p-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Periodo</p>
        <div className="flex gap-3">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            disabled={uploading}
            className="bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i} className="bg-slate-900">{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            disabled={uploading}
            className="bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
          >
            {years.map(y => (
              <option key={y} value={y} className="bg-slate-900">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-white/10 hover:border-white/20 hover:bg-white/5'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
        />
        <Upload size={32} className={`mx-auto mb-3 transition-colors ${isDragging ? 'text-primary' : 'text-slate-500'}`} />
        <p className="text-slate-300 font-medium">Arrastra los PDFs aquí o haz clic para seleccionar</p>
        <p className="text-slate-500 text-sm mt-1">Solo archivos PDF. Puedes seleccionar varios a la vez.</p>
        <p className="text-slate-600 text-xs mt-3">
          Ejemplo de nombre con DNI:{' '}
          <span className="font-mono text-slate-500">nomina_12345678A_enero.pdf</span>
        </p>
      </div>

      {/* Tabla de confirmación */}
      {matches.length > 0 && (
        <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
          {/* Cabecera tabla */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-300">
              {matches.length} archivo{matches.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-4 text-xs">
              {noMatchCount > 0 && (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={12} /> {noMatchCount} sin asignar
                </span>
              )}
              {doneCount > 0 && (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={12} /> {doneCount} subidos
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle size={12} /> {errorCount} con error
                </span>
              )}
            </div>
          </div>

          {/* Filas */}
          <div className="divide-y divide-white/5">
            {matches.map((match, i) => (
              <div key={`${match.file.name}-${i}`} className="px-6 py-4 flex items-center gap-4">
                {/* Icono + nombre archivo */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText size={18} className="text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{match.file.name}</p>
                    <p className="text-xs mt-0.5">
                      {match.detectedDni ? (
                        <span className="text-slate-500">
                          DNI detectado:{' '}
                          <span className="font-mono text-slate-400">{match.detectedDni}</span>
                        </span>
                      ) : (
                        <span className="text-amber-500">Sin DNI en el nombre</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Selector empleado */}
                <div className="w-64 shrink-0">
                  <CustomSelect
                    value={match.employee?.id ?? ''}
                    onChange={val => assignEmployee(i, val)}
                    disabled={match.status !== 'pending' || uploading}
                    searchable
                    usePortal
                    placeholder="— Sin asignar —"
                    options={[
                      { value: '', label: '— Sin asignar —' },
                      ...employees.map(e => ({
                        value: e.id,
                        label: e.name || e.email,
                        sublabel: e.dni_nie ?? undefined
                      }))
                    ]}
                    className={!match.employee ? 'border-amber-500/40 text-amber-400' : ''}
                    dropdownClassName="w-72"
                  />
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setPreviewFile(match.file)}
                    className="text-slate-600 hover:text-slate-300 transition-colors"
                    title="Vista previa"
                  >
                    <Eye size={16} />
                  </button>
                  <div className="w-4 flex items-center justify-center">
                    {match.status === 'pending' && !uploading ? (
                      <button
                        onClick={() => removeMatch(i)}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      <StatusIcon status={match.status} error={match.error} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer con botón de subida */}
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {readyCount > 0 ? (
                <>
                  <span className="text-white font-medium">{readyCount}</span>{' '}
                  nómina{readyCount !== 1 ? 's' : ''} lista{readyCount !== 1 ? 's' : ''} para subir
                  {noMatchCount > 0 && (
                    <span className="text-amber-500 ml-2">
                      ({noMatchCount} sin asignar se saltarán)
                    </span>
                  )}
                </>
              ) : (
                'Asigna un empleado a cada archivo para poder subir'
              )}
            </p>
            <button
              onClick={handleUpload}
              disabled={!readyCount || uploading}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20"
            >
              {uploading ? (
                <><Loader2 size={16} className="animate-spin" /> Subiendo...</>
              ) : (
                <><Upload size={16} /> Subir {readyCount > 0 ? readyCount : ''} nómina{readyCount !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      )}
      {/* Visor de PDF */}
      <AnimatePresence>
        {previewFile && previewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                    <FileIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{previewFile.name}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Visor Seguro de Documentos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewUrl}
                    download={previewFile.name}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Download size={14} />
                    Descargar
                  </a>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="text-slate-400 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-slate-900">
                <iframe
                  src={`${previewUrl}#toolbar=0&navpanes=0`}
                  className="w-full h-full border-0"
                  title="Visor PDF"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BulkNominas;
