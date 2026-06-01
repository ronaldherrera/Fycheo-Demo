import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, User, Plus, Trash2, AlertTriangle, Clock, ChevronDown, CalendarDays, Info, Search } from 'lucide-react';
import type { Absence, Employee } from '../types';
import { settingsService, type LeavePolicy, type Holiday } from '../services/settingsService';
import { absenceService } from '../services/absenceService';

interface AbsencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  absences: Absence[];
  companyId: string;
  leavePolicies: LeavePolicy[];
  onAbsencesChange: (newAbsences: Absence[]) => void;
}

export const AbsencesModal: React.FC<AbsencesModalProps> = ({
  isOpen,
  onClose,
  employees,
  absences,
  companyId,
  leavePolicies,
  onAbsencesChange
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isPolicyDropdownOpen, setIsPolicyDropdownOpen] = useState(false);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const filteredDropdownEmployees = useMemo(() => {
    return employees.filter(emp => 
      (emp.full_name || emp.name).toLowerCase().includes(employeeSearch.toLowerCase())
    );
  }, [employees, employeeSearch]);

  useEffect(() => {
    if (isOpen && companyId) {
      settingsService.getHolidays(companyId).then(setHolidays).catch(console.error);
    }
  }, [isOpen, companyId]);

  const allPolicies = useMemo<LeavePolicy[]>(() => {
    return [
      ...leavePolicies,
      {
        id: 'manual_paid',
        name: 'Permiso Retribuido (Manual)',
        isPaid: true,
        hex: '#10b981',
        limitUnit: 'days',
        limitPeriod: 'year',
        minAmount: 0,
        maxAmount: 0,
        consecutiveDays: false,
        requiresMakeUp: false,
        companyId,
        color: 'emerald'
      },
      {
        id: 'manual_unpaid',
        name: 'Permiso No Retribuido (Manual)',
        isPaid: false,
        hex: '#f59e0b',
        limitUnit: 'days',
        limitPeriod: 'year',
        minAmount: 0,
        maxAmount: 0,
        consecutiveDays: false,
        requiresMakeUp: true,
        companyId,
        color: 'amber'
      },
      {
        id: 'medical',
        name: 'Baja Médica',
        isPaid: true,
        hex: '#ef4444',
        limitUnit: 'days',
        limitPeriod: 'year',
        minAmount: 0,
        maxAmount: 0,
        consecutiveDays: true,
        requiresMakeUp: false,
        companyId,
        color: 'red'
      }
    ];
  }, [leavePolicies, companyId]);

  const selectedPolicy = allPolicies.find(p => p.id === selectedPolicyId);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !startDate || !selectedPolicyId) {
      setErrorMsg('Por favor, rellena todos los campos obligatorios.');
      return;
    }
    if (selectedPolicyId !== 'medical' && !endDate) {
      setErrorMsg('Por favor, indica la fecha de fin del permiso.');
      return;
    }
    if (endDate && endDate < startDate) {
      setErrorMsg('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const newAbsence = await absenceService.createAbsence({
        employee_id: selectedEmployeeId,
        company_id: companyId,
        start_date: startDate,
        end_date: endDate || null,
        type: selectedPolicyId,
        reason,
        status: 'approved'
      });
      onAbsencesChange([...absences, newAbsence]);
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch {
      setErrorMsg('Error al crear el permiso. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que quieres eliminar este permiso?')) return;
    try {
      await absenceService.deleteAbsence(id);
      onAbsencesChange(absences.filter(a => a.id !== id));
    } catch {
      alert('Error al eliminar el permiso.');
    }
  };

  const getPolicyById = (id: string) => allPolicies.find(p => p.id === id);

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? (emp.full_name || emp.name) : 'Desconocido';
  };

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  const countDays = (start: string, end: string) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    let totalDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    
    // Descontar los días festivos que caen en este rango de fechas
    let holidaysInRange = 0;
    holidays.forEach(h => {
      // Consideramos como festivos a descontar los cierres ('closed')
      if (h.type === 'closed') {
        const hd = new Date(h.date + 'T00:00:00');
        if (hd >= s && hd <= e) {
          holidaysInRange++;
        }
      }
    });

    return Math.max(0, totalDays - holidaysInRange);
  };

  const filteredAbsences = absences
    .filter(a => filterEmployeeId === 'all' || a.employee_id === filterEmployeeId)
    .filter(a => {
      if (!searchQuery) return true;
      const name = getEmployeeName(a.employee_id).toLowerCase();
      const policy = getPolicyById(a.type)?.name.toLowerCase() || '';
      return name.includes(searchQuery.toLowerCase()) || policy.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-[#0f1117] border border-white/8 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400 border border-indigo-500/25">
              <CalendarDays size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Gestión de Tiempo Libre</h2>
              <p className="text-xs text-slate-500">Asigna permisos y ausencias a tu equipo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Columna Izquierda: Formulario */}
          <div className="w-full md:w-[340px] shrink-0 flex flex-col border-r border-white/5 overflow-y-auto">
            <div className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Nuevo Permiso</h3>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 text-red-400 text-xs">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Empleado */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Empleado</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border bg-black/40 border-white/8 text-white hover:border-white/20 transition-all focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none"
                    >
                      <div className="flex items-center gap-3">
                        <User size={14} className="text-slate-500 shrink-0" />
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
                                className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500/50"
                              />
                            </div>
                          </div>
                          <div className="overflow-y-auto py-1">
                            {filteredDropdownEmployees.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-slate-500">
                                No se encontraron empleados
                              </div>
                            ) : (
                              filteredDropdownEmployees.map(emp => (
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
                                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
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

                {/* Tipo de Permiso */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Tipo de Permiso</label>
                  {allPolicies.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2">
                      <Info size={14} className="mt-0.5 shrink-0" />
                      <span>Sin políticas configuradas. Ve a <b>Configuración → Tiempo Libre</b> para crear una.</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsPolicyDropdownOpen(!isPolicyDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border bg-black/40 border-white/8 text-white hover:border-white/20 transition-all focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none"
                      >
                        {selectedPolicy ? (
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: selectedPolicy.hex }}
                            />
                            <span className="text-sm font-medium">{selectedPolicy.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">Selecciona un tipo...</span>
                        )}
                        <ChevronDown size={16} className={`text-slate-500 transition-transform ${isPolicyDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isPolicyDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsPolicyDropdownOpen(false)}
                          />
                          <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-[#1a1d27] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
                            {allPolicies.map(policy => (
                              <button
                                key={policy.id}
                                type="button"
                                onClick={() => {
                                  setSelectedPolicyId(policy.id);
                                  setIsPolicyDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all hover:bg-white/5 ${
                                  selectedPolicyId === policy.id ? 'bg-white/5' : ''
                                }`}
                              >
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: policy.hex }}
                                />
                                <span className="text-sm font-medium text-white flex-1">{policy.name}</span>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                                  style={{ color: policy.hex, backgroundColor: `${policy.hex}20`, border: `1px solid ${policy.hex}30` }}
                                >
                                  {policy.isPaid !== false ? 'Retribuido' : 'Recuperar'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Info de la política seleccionada */}
                {selectedPolicy && (
                  <div
                    className="p-3 rounded-xl border text-xs space-y-1"
                    style={{ backgroundColor: `${selectedPolicy.hex}0d`, borderColor: `${selectedPolicy.hex}25` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Días</span>
                      <span className="font-medium text-white">
                        {selectedPolicy.maxAmount === 0 
                          ? 'Sin límite' 
                          : `${selectedPolicy.minAmount > 0 && selectedPolicy.minAmount !== selectedPolicy.maxAmount ? `${selectedPolicy.minAmount}–` : ''}${selectedPolicy.maxAmount} días al ${selectedPolicy.limitPeriod === 'week' ? 'semana' : selectedPolicy.limitPeriod === 'month' ? 'mes' : 'año'}`}
                      </span>
                    </div>
                    {selectedPolicy.maxTimes !== undefined && selectedPolicy.maxTimes > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Veces permitidas</span>
                        <span className="font-medium text-white">
                          Máx {selectedPolicy.maxTimes} al {selectedPolicy.limitPeriod === 'week' ? 'semana' : selectedPolicy.limitPeriod === 'month' ? 'mes' : 'año'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Condición</span>
                      <span className="font-medium text-white">{selectedPolicy.consecutiveDays !== false ? 'Consecutivos' : 'Sueltos'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Compensación</span>
                      <span className="font-medium" style={{ color: selectedPolicy.isPaid !== false ? '#4ade80' : '#fbbf24' }}>
                        {selectedPolicy.isPaid !== false ? '💰 Retribuido' : '⏳ A recuperar'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Desde</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={e => {
                        setStartDate(e.target.value);
                        if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                      }}
                      className="w-full bg-black/40 border border-white/8 rounded-xl py-2.5 px-3 text-white text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                      Hasta {selectedPolicyId === 'medical' && '(Opcional)'}
                    </label>
                    <input
                      type="date"
                      required={selectedPolicyId !== 'medical'}
                      min={startDate}
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-black/40 border border-white/8 rounded-xl py-2.5 px-3 text-white text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Duración calculada */}
                {startDate && endDate && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 -mt-1">
                    <Clock size={12} />
                    <span>{countDays(startDate, endDate)} {countDays(startDate, endDate) === 1 ? 'día' : 'días'}</span>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Notas (Opcional)</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Motivo del permiso..."
                    rows={2}
                    className="w-full bg-black/40 border border-white/8 rounded-xl py-2.5 px-3 text-white text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all resize-none placeholder:text-slate-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || allPolicies.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Plus size={16} /> Añadir Permiso</>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Columna Derecha: Lista */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filtros */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por empleado o tipo..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/8 rounded-xl py-2 pl-8 pr-3 text-white text-sm focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <div className="relative shrink-0 w-[260px]">
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl border bg-black/40 border-white/8 text-white hover:border-white/20 transition-all focus:border-indigo-500/50 outline-none"
                >
                  <span className="text-sm truncate mr-2 text-left flex-1">
                    {filterEmployeeId === 'all' ? 'Todos' : getEmployeeName(filterEmployeeId)}
                  </span>
                  <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilterDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsFilterDropdownOpen(false)}
                    />
                    <div className="absolute z-20 top-full right-0 mt-2 w-full bg-[#1a1d27] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setFilterEmployeeId('all');
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-all hover:bg-white/5 ${
                          filterEmployeeId === 'all' ? 'bg-white/5 text-white font-medium' : 'text-slate-300'
                        }`}
                      >
                        Todos
                      </button>
                      {employees.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setFilterEmployeeId(emp.id);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all hover:bg-white/5 ${
                            filterEmployeeId === emp.id ? 'bg-white/5 text-white font-medium' : 'text-slate-300'
                          }`}
                        >
                          <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold">{(emp.full_name || emp.name).charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="text-sm truncate flex-1">{emp.full_name || emp.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">{filteredAbsences.length} permisos</span>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-5">
              {filteredAbsences.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3 text-slate-600">
                    <Calendar size={24} />
                  </div>
                  <p className="text-slate-400 font-medium text-sm">Sin permisos registrados</p>
                  <p className="text-xs text-slate-600 mt-1">Añade permisos desde el panel de la izquierda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAbsences.map(absence => {
                    const policy = getPolicyById(absence.type);
                    const hex = policy?.hex || '#6366f1';
                    const days = countDays(absence.start_date, absence.end_date || absence.start_date);
                    return (
                      <div
                        key={absence.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                      >
                        {/* Color bar */}
                        <div
                          className="w-1 self-stretch rounded-full shrink-0"
                          style={{ backgroundColor: hex }}
                        />

                        {/* Avatar + nombre */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold border"
                          style={{ backgroundColor: `${hex}15`, borderColor: `${hex}30`, color: hex }}
                        >
                          {getEmployeeName(absence.employee_id).charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium text-sm">{getEmployeeName(absence.employee_id)}</span>
                            {policy && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                                style={{ color: hex, backgroundColor: `${hex}20`, border: `1px solid ${hex}30` }}
                              >
                                {policy.name}
                              </span>
                            )}
                            {policy && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                                policy.isPaid !== false
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                              }`}>
                                {policy.isPaid !== false ? 'Retribuido' : 'A recuperar'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <CalendarDays size={11} />
                            <span>
                              {absence.start_date === absence.end_date
                                ? formatDate(absence.start_date)
                                : `${formatDate(absence.start_date)} → ${formatDate(absence.end_date || absence.start_date)}`}
                            </span>
                            <span className="text-slate-700">·</span>
                            <Clock size={11} />
                            <span>{days} {days === 1 ? 'día' : 'días'}</span>
                          </div>
                          {absence.reason && (
                            <p className="text-xs text-slate-600 mt-1 italic truncate">"{absence.reason}"</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDelete(absence.id)}
                          className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                          title="Eliminar permiso"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
