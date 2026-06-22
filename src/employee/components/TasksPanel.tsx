/**
 * TasksPanel.tsx
 *
 * Panel de Tareas y Avisos recibidos desde el Manager.
 * - Lista tareas/avisos pendientes del usuario
 * - Marcar como hecho/enterado
 * - Realtime: recibe nuevas tareas al instante
 * - Badge: notifica número de pendientes al padre
 */

import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { supabase } from '../services/supabase';
import { AppContext } from '../EmployeeApp';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TaskType     = 'task' | 'notice';
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
type TaskStatus   = 'pending' | 'done';

interface Task {
  id: string;
  company_id: string;
  created_by: string;
  assigned_to: string;
  team_id: string | null;
  type: TaskType;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  done_at: string | null;
  created_at: string;
  creator?: { full_name?: string; email?: string } | null;
}

interface TasksPanelProps {
  onPendingChange?: (total: number, notices: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const priorityMeta = (p: TaskPriority) => {
  switch (p) {
    case 'urgent': return { label: 'Urgente', color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
    case 'high':   return { label: 'Alta',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)' };
    case 'normal': return { label: 'Normal',  color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.2)' };
    default:       return { label: 'Baja',    color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' };
  }
};

const dueDateMeta = (dateStr: string | null) => {
  if (!dateStr) return null;
  const due  = new Date(dateStr + 'T23:59:59');
  const now  = new Date();
  const diff = due.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0)  return { label: `Venció hace ${Math.abs(days)}d`, color: '#f87171' };
  if (days === 0) return { label: 'Vence hoy',                      color: '#fb923c' };
  if (days === 1) return { label: 'Vence mañana',                   color: '#fbbf24' };
  return { label: `Vence en ${days}d`,                              color: '#94a3b8' };
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });

// ─── Componente ───────────────────────────────────────────────────────────────

const TasksPanel: React.FC<TasksPanelProps> = ({ onPendingChange }) => {
  const { user } = useContext(AppContext);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);

  // ── Cargar tareas pendientes ───────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const total = data?.length ?? 0;
      const notices = data?.filter(t => t.type === 'notice').length ?? 0;
      setTasks(data ?? []);
      onPendingChange?.(total, notices);
    } catch (e) {
      console.error('Error cargando tareas:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, onPendingChange]);

  const lastCounts = useRef({ total: -1, notices: -1 });

  // ── Sincronizar badge con el padre ────────────────────────────────────────
  useEffect(() => {
    const total = tasks.length;
    const notices = tasks.filter(t => t.type === 'notice').length;
    if (lastCounts.current.total !== total || lastCounts.current.notices !== notices) {
      lastCounts.current = { total, notices };
      onPendingChange?.(total, notices);
    }
  }, [tasks, onPendingChange]);

  // ── Marcar como hecho ─────────────────────────────────────────────────────
  const markDone = async (taskId: string) => {
    if (markingId) return;
    setMarkingId(taskId);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done', done_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e) {
      console.error('Error al marcar tarea como hecha:', e);
    } finally {
      setMarkingId(null);
    }
  };

  // ── Suscripción Realtime ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`tasks:user:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            if (newTask.status === 'pending') {
              setTasks(prev => [newTask, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as Task;
            if (updatedTask.status === 'done') {
              setTasks(prev => prev.filter(t => t.id !== updatedTask.id));
            } else {
              setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedTask = payload.old as Task;
            setTasks(prev => prev.filter(t => t.id !== deletedTask.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ── Separar tareas y avisos (type puede no existir en BD → default 'task')
  const notices = tasks.filter(t => t.type === 'notice');
  const taskItems = tasks.filter(t => !t.type || t.type === 'task');

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Cabecera */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(148,163,184,0.1)',
        background: 'rgba(15,23,42,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>
            Tareas y Avisos
          </span>
          <button
            onClick={loadTasks}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 4, borderRadius: 8 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          </button>
        </div>
        {tasks.length > 0 && (
          <div style={{
            fontSize: 11, color: '#64748b',
            background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '4px 8px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#f59e0b' }}>pending_actions</span>
            {tasks.length} pendiente{tasks.length !== 1 ? 's' : ''} de completar
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#475569' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>progress_activity</span>
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#475569', fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 8, opacity: 0.35 }}>task_alt</span>
            Sin tareas pendientes.<br />
            <span style={{ fontSize: 11, color: '#334155' }}>Cuando tu responsable te asigne una, aparecerá aquí.</span>
          </div>
        ) : (
          <>
            {/* Avisos primero */}
            {notices.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 4px 6px' }}>
                  Avisos · {notices.length}
                </div>
                {notices.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    isExpanded={expanded === t.id}
                    onToggle={() => setExpanded(p => p === t.id ? null : t.id)}
                    onMarkDone={() => markDone(t.id)}
                    isMarking={markingId === t.id}
                  />
                ))}
              </div>
            )}

            {/* Tareas */}
            {taskItems.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 4px 6px' }}>
                  Tareas · {taskItems.length}
                </div>
                {taskItems.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    isExpanded={expanded === t.id}
                    onToggle={() => setExpanded(p => p === t.id ? null : t.id)}
                    onMarkDone={() => markDone(t.id)}
                    isMarking={markingId === t.id}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Sub-componente: Tarjeta de Tarea ─────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isExpanded: boolean;
  onToggle: () => void;
  onMarkDone: () => void;
  isMarking: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, isExpanded, onToggle, onMarkDone, isMarking }) => {
  const pm  = priorityMeta(task.priority);
  const due = dueDateMeta(task.due_date);
  const isNotice = task.type === 'notice';
  const creator = task.creator as any;

  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 14,
        border: `1px solid ${isNotice ? 'rgba(96,165,250,0.2)' : pm.border}`,
        background: isNotice ? 'rgba(96,165,250,0.06)' : 'rgba(15,23,42,0.6)',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Cabecera de la tarjeta */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '11px 13px', display: 'flex', alignItems: 'flex-start', gap: 10,
        }}
      >
        {/* Icono tipo */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: isNotice ? 'rgba(96,165,250,0.15)' : pm.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: isNotice ? '#60a5fa' : pm.color }}>
            {isNotice ? 'campaign' : 'assignment'}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13, lineHeight: 1.3, marginBottom: 4 }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {/* Badge prioridad */}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
              background: pm.bg, color: pm.color, border: `1px solid ${pm.border}`,
            }}>
              {pm.label}
            </span>
            {/* Fecha límite */}
            {due && (
              <span style={{ fontSize: 10, color: due.color, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>schedule</span>
                {due.label}
              </span>
            )}
            {/* Fecha creación */}
            <span style={{ fontSize: 10, color: '#475569' }}>{formatDate(task.created_at)}</span>
          </div>
          {/* Creador */}
          {creator?.full_name && (
            <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
              De: {creator.full_name}
            </div>
          )}
        </div>

        <span className="material-symbols-outlined" style={{
          fontSize: 16, color: '#475569', flexShrink: 0, marginTop: 2,
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s',
        }}>
          expand_more
        </span>
      </button>

      {/* Detalle expandido */}
      {isExpanded && (
        <div style={{ padding: '0 13px 13px', borderTop: '1px solid rgba(148,163,184,0.08)' }}>
          {task.description && (
            <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, padding: '10px 0 4px' }}>
              {task.description}
            </p>
          )}

          {/* Botón Marcar como hecho */}
          <button
            onClick={(e) => { e.stopPropagation(); onMarkDone(); }}
            disabled={isMarking}
            style={{
              width: '100%', marginTop: 10,
              padding: '9px 12px', borderRadius: 10, border: 'none',
              background: isNotice
                ? 'linear-gradient(135deg,#3b82f6,#6366f1)'
                : 'linear-gradient(135deg,#10b981,#059669)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: isMarking ? 'not-allowed' : 'pointer',
              opacity: isMarking ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'opacity 0.2s, transform 0.1s',
            }}
            onMouseDown={e => { if (!isMarking) (e.currentTarget.style.transform = 'scale(0.98)'); }}
            onMouseUp={e => { (e.currentTarget.style.transform = 'scale(1)'); }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {isMarking ? 'progress_activity' : (isNotice ? 'thumb_up' : 'check_circle')}
            </span>
            {isMarking ? 'Marcando...' : (isNotice ? 'Enterado' : 'Marcar como hecho')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TasksPanel;
