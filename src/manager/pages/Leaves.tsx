import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { absenceService } from '../services/absenceService';
import { employeeService } from '../services/employeeService';
import { settingsService } from '../services/settingsService';
import type { Absence, Employee } from '../types';
import type { LeavePolicy } from '../services/settingsService';
import { CalendarOff, User, Check, X, Clock, CalendarDays, Loader2, Undo, Plus, Palmtree, Stethoscope, FileDown, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AbsencesModal } from '../components/AbsencesModal';
import { MedicalLeaveModal } from '../components/MedicalLeaveModal';

export default function Leaves() {
  const { activeCompany } = useAuth();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [policies, setPolicies] = useState<Record<string, LeavePolicy>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [bajasFilter, setBajasFilter] = useState<'active' | 'history'>('active');
  const [mainTab, setMainTab] = useState<'permisos' | 'bajas'>('permisos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);
  
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false);
  const [dischargeAbsenceId, setDischargeAbsenceId] = useState<string | null>(null);
  const [dischargeDate, setDischargeDate] = useState('');

  useEffect(() => {
    if (activeCompany?.id) {
      loadData();
    }
  }, [activeCompany?.id]);

  const loadData = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const [absencesData, employeesData, settingsData] = await Promise.all([
        absenceService.getAllAbsences(activeCompany.id),
        employeeService.getEmployees(activeCompany.id),
        settingsService.getCompanySettings(activeCompany.id)
      ]);

      setAbsences(absencesData);
      
      const empMap: Record<string, Employee> = {};
      employeesData.forEach(e => empMap[e.id] = e);
      setEmployees(empMap);

      const polMap: Record<string, LeavePolicy> = {};
      if (settingsData && settingsData.leave_policies) {
        settingsData.leave_policies.forEach((p: LeavePolicy) => polMap[p.id] = p);
      }
      setPolicies(polMap);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeAbsenceId || !dischargeDate) return;
    try {
      await absenceService.updateAbsenceEndDate(dischargeAbsenceId, dischargeDate);
      setAbsences(absences.map(a => a.id === dischargeAbsenceId ? { ...a, end_date: dischargeDate } : a));
      setDischargeModalOpen(false);
      setDischargeAbsenceId(null);
      setDischargeDate('');
    } catch (err) {
      console.error(err);
      alert('Error al dar de alta. Inténtalo de nuevo.');
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    try {
      await absenceService.updateAbsenceStatus(id, status);
      setAbsences(absences.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAbsences = absences.filter(a => {
    if (mainTab === 'permisos' && a.type === 'medical') return false;
    if (mainTab === 'bajas' && a.type !== 'medical') return false;
    
    // El filtro de estado (Pendientes, Aprobadas...) solo aplica a Permisos
    if (mainTab === 'permisos' && filter !== 'all' && a.status !== filter) return false;
    
    // El filtro de bajas (Activas, Histórico) solo aplica a Bajas
    if (mainTab === 'bajas') {
      if (bajasFilter === 'active' && a.end_date) return false;
      if (bajasFilter === 'history' && !a.end_date) return false;
    }
    
    return true;
  });

  const getPolicyInfo = (type: string) => {
    if (type === 'manual_paid') return { name: 'Permiso Retribuido', color: '#10b981' };
    if (type === 'manual_unpaid') return { name: 'Permiso No Retribuido', color: '#f59e0b' };
    const p = policies[type];
    if (p) return { name: p.name, color: p.hex || '#6366f1' };
    if (type === 'vacation') return { name: 'Vacaciones', color: '#3b82f6' };
    if (type === 'medical') return { name: 'Baja Médica', color: '#ef4444' };
    return { name: 'Ausencia', color: '#ef4444' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1"><Clock size={12}/> Pendiente</span>;
      case 'approved':
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1"><Check size={12}/> Aprobada</span>;
      case 'rejected':
        return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1"><X size={12}/> Denegada</span>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const totalEmployees = Object.keys(employees).length;
  const activeBajasCount = absences.filter(a => a.type === 'medical' && !a.end_date).length;
  const bajasPercentage = totalEmployees > 0 ? Math.round((activeBajasCount / totalEmployees) * 100) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 text-primary rounded-xl ring-1 ring-primary/30">
              <CalendarOff size={28} />
            </div>
            Gestión de Ausencias y Bajas
          </h1>
          <p className="text-slate-400 text-lg">Revisa y gestiona las solicitudes de tiempo libre y bajas médicas de tu equipo.</p>
        </div>
      </div>

      <div className="flex border-b border-white/10 mb-8 gap-8">
        <button
          onClick={() => setMainTab('permisos')}
          className={`pb-3 text-base font-medium transition-colors border-b-2 ${
            mainTab === 'permisos' ? 'border-primary text-white' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Permisos Solicitados
        </button>
        <button
          onClick={() => setMainTab('bajas')}
          className={`pb-3 text-base font-medium transition-colors border-b-2 ${
            mainTab === 'bajas' ? 'border-primary text-white' : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Bajas Asignadas
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4 items-stretch sm:items-center">
        <div className="flex items-center gap-4 flex-wrap">
          {mainTab === 'bajas' && (
            <>
              <button
                onClick={() => setIsMedicalModalOpen(true)}
                className="h-12 flex items-center justify-center gap-2 px-5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-colors font-medium whitespace-nowrap"
              >
                <Plus size={18} /> Añadir Baja
              </button>

              <div className="h-12 flex items-center gap-3 px-4 bg-surface-dark border border-white/10 rounded-xl">
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-1">Tasa de Bajas</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-white leading-none">{bajasPercentage}%</span>
                    <span className="text-xs text-slate-400 font-medium">({activeBajasCount}/{totalEmployees})</span>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  bajasPercentage >= 15 ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                  bajasPercentage >= 5 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                }`}>
                  <Activity size={16} />
                </div>
              </div>
            </>
          )}
        </div>

        {mainTab === 'permisos' ? (
          <div className="h-12 flex gap-1.5 bg-surface-dark border border-white/10 p-1.5 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap w-full sm:w-auto shrink-0">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-full flex items-center justify-center px-4 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                  filter === f 
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobadas' : f === 'rejected' ? 'Denegadas' : 'Todas'}
              </button>
            ))}
          </div>
        ) : (
          <div className="h-12 flex gap-1.5 bg-surface-dark border border-white/10 p-1.5 rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap w-full sm:w-auto shrink-0">
            {(['active', 'history'] as const).map(f => (
              <button
                key={f}
                onClick={() => setBajasFilter(f)}
                className={`h-full flex items-center justify-center px-5 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                  bajasFilter === f 
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {f === 'active' ? 'Activas' : 'Histórico'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-primary">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className={mainTab === 'permisos' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
          <AnimatePresence mode="popLayout">
            {filteredAbsences.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 bg-surface-dark/50 rounded-2xl border border-white/5 border-dashed"
              >
                {mainTab === 'permisos' ? (
                  <Palmtree size={48} className="mb-4 opacity-50" />
                ) : (
                  <Stethoscope size={48} className="mb-4 opacity-50" />
                )}
                <p className="text-lg">No hay solicitudes {filter !== 'all' ? `en estado ${filter}` : ''}</p>
              </motion.div>
            ) : (
              filteredAbsences.map(absence => {
                const emp = employees[absence.employee_id];
                const policyInfo = getPolicyInfo(absence.type);
                
                if (mainTab === 'bajas') {
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      key={absence.id}
                      className="bg-surface-dark rounded-2xl border border-white/10 overflow-hidden flex flex-col md:flex-row md:items-center justify-between p-4 gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0 md:min-w-[250px] w-full md:w-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                          {emp?.avatar ? (
                              <img src={emp.avatar} alt={emp.full_name || emp.name} className="w-full h-full object-cover" />
                          ) : (
                              <User className="text-slate-500" size={24} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-white text-base leading-tight truncate">
                            {emp ? (emp.full_name || emp.name) : 'Usuario eliminado'}
                          </h3>
                          <span 
                            className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1"
                            style={{ backgroundColor: `${policyInfo.color}20`, color: policyInfo.color }}
                          >
                            {policyInfo.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 px-0 md:px-4 md:border-l border-white/10 w-full md:w-auto">
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <span className="text-slate-200 font-medium flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg whitespace-nowrap">
                            <CalendarDays size={14} className="text-primary"/>
                            {formatDate(absence.start_date)}
                          </span>
                          <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">a</span>
                          <span className={`font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap ${!absence.end_date ? 'text-amber-400 bg-amber-500/10' : 'text-slate-200 bg-white/5'}`}>
                            <CalendarDays size={14} className={!absence.end_date ? 'text-amber-400' : 'text-primary'}/>
                            {absence.end_date ? formatDate(absence.end_date) : 'Sin fecha'}
                          </span>
                        </div>

                        {absence.document_url && (
                          <a 
                            href={absence.document_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors text-sm w-fit shrink-0"
                            title="Ver Parte Médico"
                          >
                            <FileDown size={16} />
                            <span>Documento</span>
                          </a>
                        )}
                      </div>

                      <div className="shrink-0 flex gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                        {!absence.end_date ? (
                          <button 
                            onClick={() => {
                              setDischargeAbsenceId(absence.id);
                              setDischargeDate(new Date().toISOString().split('T')[0]);
                              setDischargeModalOpen(true);
                            }}
                            className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-semibold transition-colors flex justify-center items-center gap-2 text-sm border border-amber-500/20 flex-1 md:flex-initial"
                          >
                            <Check size={16} /> Dar de Alta
                          </button>
                        ) : (
                          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 font-semibold flex justify-center items-center gap-2 text-sm border border-emerald-500/20 flex-1 md:flex-initial">
                            <Check size={16} /> Alta registrada
                          </div>
                        )}
                        <button
                           onClick={() => absenceService.deleteAbsence(absence.id).then(() => setAbsences(absences.filter(a => a.id !== absence.id)))}
                           className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/20 shrink-0"
                           title="Eliminar baja"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={absence.id}
                    className="bg-surface-dark rounded-2xl border border-white/10 overflow-hidden flex flex-col relative group"
                  >
                    <div 
                      className="absolute top-0 left-0 right-0 h-1" 
                      style={{ backgroundColor: policyInfo.color }}
                    />
                    
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10">
                            {emp?.avatar ? (
                                <img src={emp.avatar} alt={emp.full_name || emp.name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="text-slate-500" size={20} />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-base leading-tight">
                              {emp ? (emp.full_name || emp.name) : 'Usuario eliminado'}
                            </h3>
                            <span 
                              className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1"
                              style={{ backgroundColor: `${policyInfo.color}20`, color: policyInfo.color }}
                            >
                              {policyInfo.name}
                            </span>
                          </div>
                        </div>
                        {getStatusBadge(absence.status)}
                      </div>

                      <div className="bg-black/20 rounded-xl p-3 mb-4 border border-white/5 flex items-center justify-center gap-4 text-sm">
                        <div className="text-center">
                          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Desde</span>
                          <span className="text-slate-200 font-medium flex items-center gap-1.5">
                            <CalendarDays size={14} className="text-primary"/>
                            {formatDate(absence.start_date)}
                          </span>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div className="text-center">
                          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block mb-0.5">Hasta</span>
                          <span className={`font-medium flex items-center gap-1.5 ${!absence.end_date ? 'text-amber-400' : 'text-slate-200'}`}>
                            <CalendarDays size={14} className={!absence.end_date ? 'text-amber-400' : 'text-primary'}/>
                            {absence.end_date ? formatDate(absence.end_date) : 'Sin fecha'}
                          </span>
                        </div>
                      </div>

                      {absence.reason && (
                        <div className="mb-4">
                          <span className="text-xs text-slate-500 font-semibold mb-1 block">Motivo</span>
                          <p className="text-sm text-slate-300 bg-white/5 p-2.5 rounded-lg border border-white/5">
                            {absence.reason}
                          </p>
                        </div>
                      )}

                      {absence.document_url && (
                        <div className="mb-4">
                          <span className="text-xs text-slate-500 font-semibold mb-1 block">Documento Adjunto</span>
                          <a 
                            href={absence.document_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors text-sm w-fit"
                          >
                            <FileDown size={16} />
                            Ver Parte Médico
                          </a>
                        </div>
                      )}

                      <div className="mt-auto pt-4 border-t border-white/5">
                        {!absence.end_date ? (
                          <button 
                            onClick={() => {
                              setDischargeAbsenceId(absence.id);
                              setDischargeDate(new Date().toISOString().split('T')[0]);
                              setDischargeModalOpen(true);
                            }}
                            className="w-full py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-semibold transition-colors flex justify-center items-center gap-2"
                          >
                            <Check size={16} /> Dar de Alta
                          </button>
                        ) : absence.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleUpdateStatus(absence.id, 'rejected')}
                              className="flex-1 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold transition-colors border border-red-500/20 flex justify-center items-center gap-2"
                            >
                              <X size={16} /> Denegar
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(absence.id, 'approved')}
                              className="flex-1 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-semibold transition-colors border border-emerald-500/20 flex justify-center items-center gap-2"
                            >
                              <Check size={16} /> Aprobar
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleUpdateStatus(absence.id, 'pending')}
                            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors flex justify-center items-center gap-2"
                          >
                            <Undo size={16} /> Revertir a Pendiente
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      )}

      {activeCompany && (
        <AbsencesModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          employees={Object.values(employees)}
          absences={absences}
          companyId={activeCompany.id}
          leavePolicies={Object.values(policies)}
          onAbsencesChange={(newAbsences) => {
            setAbsences(newAbsences);
          }}
        />
      )}

      {activeCompany && (
        <MedicalLeaveModal
          isOpen={isMedicalModalOpen}
          onClose={() => setIsMedicalModalOpen(false)}
          employees={Object.values(employees)}
          companyId={activeCompany.id}
          onAbsencesChange={(newAbsence) => {
            setAbsences(prev => [newAbsence, ...prev]);
          }}
        />
      )}

      {/* Modal para Dar de Alta */}
      {dischargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Dar de Alta
              </h2>
              <button 
                onClick={() => setDischargeModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleDischargeSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Fecha de Alta (Fin de la baja)
                </label>
                <input
                  type="date"
                  required
                  value={dischargeDate}
                  onChange={e => setDischargeDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/8 rounded-xl py-2.5 px-3 text-white text-sm focus:border-indigo-500/50 outline-none"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold transition-colors"
                >
                  Confirmar Alta
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
