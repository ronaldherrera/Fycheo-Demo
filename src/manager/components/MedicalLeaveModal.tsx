import React, { useState } from 'react';
import { X, Calendar, User, Plus, AlertTriangle, FileUp, Paperclip, ChevronDown, Search } from 'lucide-react';
import type { Absence, Employee } from '../types';
import { absenceService } from '../services/absenceService';

interface MedicalLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  companyId: string;
  onAbsencesChange: (newAbsence: Absence) => void;
}

export const MedicalLeaveModal: React.FC<MedicalLeaveModalProps> = ({
  isOpen,
  onClose,
  employees,
  companyId,
  onAbsencesChange
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  if (!isOpen) return null;

  const filteredEmployees = employees.filter(emp => 
    (emp.full_name || emp.name).toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return '';
    return emp.full_name || emp.name;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !startDate) {
      setErrorMsg("Empleado y fecha de inicio son obligatorios");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      let document_url = undefined;

      if (file) {
        document_url = await absenceService.uploadDocument(file);
      }

      const newAbsence: Partial<Absence> = {
        employee_id: selectedEmployeeId,
        company_id: companyId,
        start_date: startDate,
        end_date: null,
        type: 'medical',
        status: 'approved',
        reason: notes || undefined,
        document_url
      };

      const created = await absenceService.createAbsence(newAbsence);
      onAbsencesChange(created);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al guardar la baja médica');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#1a1d27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Nueva Baja Médica</h2>
              <p className="text-xs text-slate-400">Registrar nuevo parte de baja</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {errorMsg && (
            <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-400 text-xs">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <form id="medical-leave-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Empleado */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Empleado <span className="text-red-400">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={16} className="text-slate-500" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                  className="w-full flex items-center justify-between pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 hover:border-white/20 rounded-xl text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 outline-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {selectedEmployeeId ? (
                      <span className="text-sm font-medium">{getEmployeeName(selectedEmployeeId)}</span>
                    ) : (
                      <span className="text-sm text-slate-500">Selecciona empleado...</span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform ${isEmployeeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isEmployeeDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsEmployeeDropdownOpen(false)}
                    />
                    <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-[#1a1d27] border border-white/10 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-60">
                      <div className="p-2 border-b border-white/5 shrink-0">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-500" />
                          </div>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Buscar empleado..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/50"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto py-1">
                        {filteredEmployees.length === 0 ? (
                          <div className="px-3 py-4 text-center text-sm text-slate-500">
                            No se encontraron empleados
                          </div>
                        ) : (
                          filteredEmployees.map(emp => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setIsEmployeeDropdownOpen(false);
                                setEmployeeSearch('');
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-white/5 ${
                                selectedEmployeeId === emp.id ? 'bg-white/5' : ''
                              }`}
                            >
                              <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold">{(emp.full_name || emp.name).charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="text-sm font-medium text-white flex-1">{emp.full_name || emp.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fecha de Inicio */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Fecha de Inicio <span className="text-red-400">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar size={16} className="text-slate-500" />
                </div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50"
                  required
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                La fecha de fin se definirá más adelante cuando se tramite el alta.
              </p>
            </div>

            {/* Documento Adjunto */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Parte Médico (Opcional)</label>
              <div className="relative">
                <input
                  type="file"
                  id="document-upload"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <label
                  htmlFor="document-upload"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black/40 border border-white/10 border-dashed hover:border-white/30 rounded-xl cursor-pointer transition-colors"
                >
                  {file ? (
                    <>
                      <Paperclip size={16} className="text-indigo-400" />
                      <span className="text-sm text-indigo-300 truncate max-w-[200px]">{file.name}</span>
                    </>
                  ) : (
                    <>
                      <FileUp size={16} className="text-slate-500" />
                      <span className="text-sm text-slate-400">Adjuntar archivo (PDF o Imagen)</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Observaciones (Opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Detalles adicionales..."
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 resize-none"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-white/[0.02] flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            Cancelar
          </button>
          <button
            form="medical-leave-form"
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Registrar Baja'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
