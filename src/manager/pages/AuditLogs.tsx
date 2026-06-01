import { useEffect, useState } from 'react';
import { Activity, Clock, Shield, Search, RefreshCcw, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { logService } from '../services/logService';
import type { ActivityLog } from '../types';

export default function AuditLogs() {
  const { activeCompany } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const canViewLogs = activeCompany?.role === 'admin' || activeCompany?.role === 'hr';

  const fetchLogs = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const data = await logService.getLogs(activeCompany.id, 100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewLogs) {
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [activeCompany, canViewLogs]);

  if (!canViewLogs) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
          <Shield size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Acceso Denegado</h2>
        <p className="text-slate-400 text-center max-w-md">
          El Registro de Actividad contiene información sensible y de auditoría. Solo los administradores y responsables de RRHH tienen acceso.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => 
    log.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (log.manager?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionColor = (type: string) => {
    if (type.includes('delete') || type.includes('remove')) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (type.includes('create') || type.includes('add')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (type.includes('publish')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (type.includes('export')) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  const translateActionType = (type: string) => {
    const translations: Record<string, string> = {
      'team_changed': 'Equipo Modificado',
      'shift_published': 'Turnos Publicados',
      'employee_added': 'Empleado Añadido',
      'absence_approved': 'Ausencia Aprobada',
      'employee_deleted': 'Empleado Eliminado',
      'employee_updated': 'Empleado Actualizado',
      'export_generated': 'Documento Exportado'
    };
    return translations[type] || type.replace('_', ' ');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
              <Activity size={24} />
            </div>
            Registro de Actividad
          </h1>
          <p className="text-slate-400 mt-2">
            Auditoría de todos los cambios importantes en los cuadrantes y equipos de la empresa.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Buscar acción o persona..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-dark border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2.5 bg-surface-dark border border-white/5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Recargar log"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Timeline de Logs */}
      <div className="bg-surface-dark border border-white/5 rounded-2xl p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-500 mb-4">
              <History size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-300">No hay registros</h3>
            <p className="text-slate-500 mt-1">No se encontraron actividades que coincidan con tu búsqueda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const date = new Date(log.created_at);
              const colorClasses = getActionColor(log.action_type);
              
              return (
                <div key={log.id} className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex sm:flex-col items-center justify-between sm:justify-start gap-4 sm:gap-2 shrink-0 pt-1">
                    <div className="flex flex-col sm:items-end sm:text-right w-16">
                      <span className="text-xs font-bold text-slate-300">
                        {date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-white/5 pt-4 sm:pt-0 sm:pl-4 flex flex-col justify-center">
                    <div className="mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colorClasses}`}>
                          {translateActionType(log.action_type)}
                        </div>
                        {log.metadata?.affected && (
                          <div className="text-xs font-medium text-slate-300 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                            <span className="text-slate-500 mr-1">Afectado:</span>
                            {log.metadata.affected}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 items-start mt-1">
                        <span className="text-slate-500 text-xs mt-0.5">Detalle:</span>
                        <p className="text-sm md:text-base font-medium text-white leading-relaxed flex-1">
                          {log.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary overflow-hidden border border-primary/30">
                        {log.manager?.avatar ? (
                           <img src={log.manager.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                           (log.manager?.full_name || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        Realizado por <strong className="text-slate-300">{log.manager?.full_name || 'Usuario Desconocido'}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
