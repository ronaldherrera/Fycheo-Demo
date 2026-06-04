import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, CalendarOff, User, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X, ClipboardList, LogIn, LogOut, Coffee, ArrowUpDown, MessageCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { dashboardService } from '../services/dashboardService';
import type { DashboardFilters } from '../services/dashboardService';
import { teamService } from '../services/teamService';
import { employeeService } from '../services/employeeService';
import { settingsService } from '../services/settingsService';
import { CustomSelect } from '../components/ui/CustomSelect';
import ChatPanel from '../components/ChatPanel';
import type { Team, Employee } from '../types';

// ─── Mini Gantt reutilizable para el popover ───────────────────────────────
const SEG_COLORS_HEX: Record<string, string> = {
  working: '#10b981',
  break: '#fbbf24',
  others: '#ec4899'
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _MiniGantt = ({ timelines, isToday }: { timelines: any[]; isToday: boolean }) => {
  const VIEW_START = 6 * 60;
  const VIEW_END = 22 * 60;
  const VIEW_RANGE = VIEW_END - VIEW_START;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const nowPct = ((nowMins - VIEW_START) / VIEW_RANGE) * 100;
  const hourLabels = [6, 9, 12, 15, 18, 21];

  if (timelines.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-slate-600 text-xs gap-2">
        <CalendarIcon size={14} className="opacity-40" />
        Sin fichajes registrados
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Eje horas */}
      <div className="relative h-3 ml-[70px] mr-[38px]">
        {hourLabels.map(h => (
          <span
            key={h}
            className="absolute text-[8px] text-slate-600 -translate-x-1/2"
            style={{ left: `${((h * 60 - VIEW_START) / VIEW_RANGE) * 100}%` }}
          >
            {String(h).padStart(2, '0')}h
          </span>
        ))}
      </div>

      {timelines.map((emp: any) => (
        <div key={emp.userId} className="flex items-center gap-2">
          {/* Avatar + nombre */}
          <div className="w-[68px] shrink-0 flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {emp.avatar
                ? <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                : <span className="text-[7px] font-bold text-slate-400 uppercase">{emp.name.charAt(0)}</span>
              }
            </div>
            <span className="text-[9px] text-slate-400 truncate">{emp.name.split(' ')[0]}</span>
          </div>

          {/* Barra */}
          <div className="relative flex-1 h-4 bg-slate-800 rounded overflow-hidden border border-white/5">
            {hourLabels.map(h => (
              <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-700/30"
                style={{ left: `${((h * 60 - VIEW_START) / VIEW_RANGE) * 100}%` }} />
            ))}
            {emp.segments.map((seg: any, si: number) => {
              const cs = Math.max(seg.startMin, VIEW_START);
              const ce = Math.min(seg.endMin, VIEW_END);
              if (ce <= cs) return null;
              const lp = ((cs - VIEW_START) / VIEW_RANGE) * 100;
              const wp = ((ce - cs) / VIEW_RANGE) * 100;
              const isOpen = si === emp.segments.length - 1 && emp.isStillIn;
              const col = SEG_COLORS_HEX[seg.type] || '#10b981';
              return (
                <div key={si}
                  className="absolute top-0.5 bottom-0.5 rounded-sm"
                  style={{
                    left: `${lp}%`, width: `${wp}%`,
                    background: isOpen
                      ? `repeating-linear-gradient(90deg,${col} 0,${col} 5px,${col}66 5px,${col}66 8px)`
                      : col
                  }}
                />
              );
            })}
            {isToday && nowPct >= 0 && nowPct <= 100 && (
              <div className="absolute top-0 bottom-0 w-px bg-white/60 z-10"
                style={{ left: `${nowPct}%` }} />
            )}
          </div>

          {/* Hora */}
          <div className="w-[36px] text-[8px] text-slate-600 text-right leading-tight shrink-0">
            <div>{emp.firstTime}</div>
            <div className={emp.isStillIn ? 'text-emerald-500' : ''}>{emp.isStillIn ? '⬤' : emp.lastTime}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Dashboard ─────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { activeCompany } = useAuth();

  const formatMin = (m: number) => {
    const hh = Math.floor(m / 60);
    const mm = Math.floor(m % 60);
    const isNextDay = hh >= 24;
    const hhStr = String(hh % 24).padStart(2, '0');
    const mmStr = String(mm).padStart(2, '0');
    return `${hhStr}:${mmStr}${isNextDay ? ' +1d' : ''}`;
  };

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Filtros del dashboard
  const [filters, setFilters] = useState<DashboardFilters>(() => {
    const saved = sessionStorage.getItem('fycheo_dashboard_filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.scope) {
          // Forzamos la fecha de hoy al cargar, manteniendo el resto de la selección
          parsed.date = new Date().toISOString().split('T')[0];
          return parsed;
        }
      } catch (e) {
        console.error('Error parseando filtros', e);
      }
    }
    return {
      scope: 'org',
      targetId: '',
      date: new Date().toISOString().split('T')[0]
    };
  });

  // Guardar filtros en sessionStorage
  useEffect(() => {
    sessionStorage.setItem('fycheo_dashboard_filters', JSON.stringify(filters));
  }, [filters]);

  const [calendarConfig, setCalendarConfig] = useState<{ specialDays: Record<string, string>, weeklySchedule: Record<number, any> }>({ specialDays: {}, weeklySchedule: {} });

  // Calendario mensual
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // monthData: YYYY-MM-DD → { timelines, scheduledShifts }
  const [monthData, setMonthData] = useState<Record<string, {
    timelines: any[];
    scheduledShifts: { name: string; avatar: string | null; startTime: string; endTime: string }[];
  }>>({});

  // Popover hover
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Popover Gantt (Employee Row)
  const [hoveredEmp, setHoveredEmp] = useState<any>(null);
  const [ganttTooltipPos, setGanttTooltipPos] = useState({ x: 0, y: 0 });

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const handleUnreadChange = useCallback((count: number) => setUnreadChat(count), []);

  const handleApproveTimeRequest = async (id: string) => {
    try {
      await dashboardService.updateTimeRequestStatus(id, 'approved');
      setFilters(prev => ({ ...prev })); // trigger refresh
    } catch (e) {
      console.error('Error approving request:', e);
    }
  };

  const handleRejectTimeRequest = async (id: string) => {
    try {
      await dashboardService.updateTimeRequestStatus(id, 'rejected');
      setFilters(prev => ({ ...prev })); // trigger refresh
    } catch (e) {
      console.error('Error rejecting request:', e);
    }
  };

  // ── Filtros secundarios ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCompany) return;
    Promise.all([
      teamService.getTeams(activeCompany.id),
      employeeService.getEmployees(activeCompany.id)
    ]).then(([t, e]) => {
      setTeams(t);
      setEmployees(e);
      
      // Auto-selección y limpieza de filtros obsoletos si el targetId no existe o está vacío
      setFilters(prev => {
        let nextTargetId = prev.targetId;
        if (prev.scope === 'team') {
          const teamExists = t.some(team => team.id === prev.targetId);
          if (!teamExists) {
            nextTargetId = t.length > 0 ? t[0].id : '';
          }
        } else if (prev.scope === 'employee') {
          const empExists = e.some(emp => emp.id === prev.targetId);
          if (!empExists) {
            nextTargetId = e.length > 0 ? e[0].id : '';
          }
        }
        if (nextTargetId !== prev.targetId) {
          return { ...prev, targetId: nextTargetId };
        }
        return prev;
      });
    }).catch(console.error);
  }, [activeCompany]);

  // ── Dashboard data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    dashboardService.getDashboardData(activeCompany.id, filters)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeCompany, filters]);

  // ── Realtime: Solicitudes manuales ───────────────────────────────────────
  useEffect(() => {
    if (!activeCompany) return;

    const channel = supabase
      .channel('dashboard-time-entries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'time_entries' },
        (payload) => {
          const row = payload.new as any;
          // Si hay algún cambio en fichajes (especialmente manuales), refrescamos la vista
          if (row && row.company_id === activeCompany.id) {
            setFilters(f => ({ ...f }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompany]);

  // ── Datos mensuales para el calendario ──────────────────────────────────
  useEffect(() => {
    if (!activeCompany) return;

    const loadMonthData = async () => {
      try {
        const { data: members } = await supabase
          .from('company_members').select('user_id').eq('company_id', activeCompany.id);
        const ids = (members || []).map((m: any) => m.user_id);
        if (ids.length === 0) return;

        const { data: profs } = await supabase
          .from('profiles').select('id, full_name, avatar').in('id', ids);
        const profileMap: Record<string, any> = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));

        const monthStart = new Date(calendarYear, calendarMonth, 1);
        const monthEnd = new Date(calendarYear, calendarMonth + 1, 0, 23, 59, 59, 999);
        const dateFrom = monthStart.toISOString().split('T')[0];
        const dateTo = monthEnd.toISOString().split('T')[0];

        // time_entries del mes
        const { data: entries } = await supabase
          .from('time_entries')
          .select('user_id, entry_type, occurred_at')
          .in('user_id', ids)
          .gte('occurred_at', monthStart.toISOString())
          .lte('occurred_at', monthEnd.toISOString())
          .order('occurred_at', { ascending: true });

        // shifts del mes
        const { data: shifts } = await supabase
          .from('shifts')
          .select('employee_id, date, start_time, end_time')
          .eq('company_id', activeCompany.id)
          .in('employee_id', ids)
          .gte('date', dateFrom)
          .lte('date', dateTo);

        // holidays del mes
        const { data: holidays } = await supabase
          .from('company_holidays')
          .select('date, type')
          .eq('company_id', activeCompany.id)
          .gte('date', dateFrom)
          .lte('date', dateTo);

        // weekly_schedule via settingsService
        const settingsData = await settingsService.getCompanySettings(activeCompany.id).catch(() => null);
        let weeklySchedule: Record<number, any> = {};
        if (settingsData?.schedule) {
          const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
          Object.entries(settingsData.schedule).forEach(([key, val]) => {
            if (dayMap[key] !== undefined) {
              weeklySchedule[dayMap[key]] = val;
            }
          });
        }

        const specialDaysMap: Record<string, string> = {};
        
        (holidays || []).forEach((h: any) => {
           const d = new Date(h.date);
           const dayOfWeek = d.getDay();
           const isNormallyClosed = !weeklySchedule[dayOfWeek]?.active;
           let variant = 'open_holiday';
           if (h.type === 'closed') variant = 'closed_holiday';
           else if (isNormallyClosed && (h.type === 'open_normal' || h.type === 'special_hours')) variant = 'open_unexpected';
           else if (h.type === 'special_hours') variant = 'open_partial_holiday';
           specialDaysMap[h.date] = variant;
        });
        
        setCalendarConfig({ specialDays: specialDaysMap, weeklySchedule });

        // Agrupar time_entries por fecha → por empleado
        const byDateEmp: Record<string, Record<string, any[]>> = {};
        (entries || []).forEach((e: any) => {
          if (!e.occurred_at) return;
          const date = new Date(e.occurred_at).toLocaleDateString('en-CA');
          if (!byDateEmp[date]) byDateEmp[date] = {};
          if (!byDateEmp[date][e.user_id]) byDateEmp[date][e.user_id] = [];
          byDateEmp[date][e.user_id].push(e);
        });

        const todayStr = new Date().toLocaleDateString('en-CA');
        const result: typeof monthData = {};

        Object.entries(byDateEmp).forEach(([date, empMap]) => {
          const isToday = date === todayStr;
          const nowMins = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 24 * 60;

          const timelines = Object.entries(empMap).map(([userId, empEntries]) => {
            empEntries.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
            const segments: { startMin: number; endMin: number; type: string }[] = [];
            let segStart: number | null = null;
            let segType = 'working';

            for (const e of empEntries) {
              const t = e.entry_type;
              const mins = new Date(e.occurred_at).getHours() * 60 + new Date(e.occurred_at).getMinutes();
              if (t === 'clock-in' || t === 'break-end' || t === 'others-in') {
                segStart = mins; segType = 'working';
              } else if (t === 'break-start' && segStart !== null) {
                segments.push({ startMin: segStart, endMin: mins, type: segType });
                segStart = mins; segType = 'break';
              } else if (t === 'others-out' && segStart !== null) {
                segments.push({ startMin: segStart, endMin: mins, type: segType });
                segStart = mins; segType = 'others';
              } else if (t === 'clock-out' && segStart !== null) {
                segments.push({ startMin: segStart, endMin: mins, type: segType });
                segStart = null;
              }
            }
            if (segStart !== null) segments.push({ startMin: segStart, endMin: nowMins, type: segType });

            const prof = profileMap[userId];
            const first = empEntries[0];
            const last = empEntries[empEntries.length - 1];
            return {
              userId, segments,
              name: prof?.full_name || userId.slice(0, 6),
              avatar: prof?.avatar || null,
              firstTime: new Date(first.occurred_at).toTimeString().substring(0, 5),
              lastTime: new Date(last.occurred_at).toTimeString().substring(0, 5),
              isStillIn: segStart !== null
            };
          }).filter(e => e.segments.length > 0);

          result[date] = { timelines, scheduledShifts: [] };
        });

        // Añadir shifts
        (shifts || []).forEach((s: any) => {
          if (!result[s.date]) result[s.date] = { timelines: [], scheduledShifts: [] };
          const prof = profileMap[s.employee_id];
          result[s.date].scheduledShifts.push({
            name: prof?.full_name || 'Desconocido',
            avatar: prof?.avatar || null,
            startTime: s.start_time,
            endTime: s.end_time
          });
        });

        setMonthData(result);
      } catch (e) {
        console.error('Error cargando datos del mes:', e);
      }
    };

    loadMonthData();
  }, [activeCompany, calendarMonth, calendarYear]);

  // ── Posición del popover ─────────────────────────────────────────────────
  const handleDayMouseEnter = (dateStr: string, e: React.MouseEvent<HTMLElement>) => {
    setHoveredDay(dateStr);
    const rect = e.currentTarget.getBoundingClientRect();

    const POPOVER_W = 200; // Ancho estimado para el tooltip simple

    // Horizontal: derecha si cabe, izquierda si no, siempre dentro de pantalla
    const spaceRight = window.innerWidth - rect.right;
    const left = spaceRight >= POPOVER_W + 10
      ? rect.right + 10
      : Math.max(8, rect.left - POPOVER_W - 10);

    // Vertical: alinear con el top de la celda
    const top = Math.max(8, rect.top);

    setPopoverStyle({ top, left });
  };

  // ── Opciones filtros ─────────────────────────────────────────────────────
  const scopeOptions = [
    { value: 'org', label: 'Toda la Organización' },
    { value: 'team', label: 'Por Equipo' },
    { value: 'employee', label: 'Por Empleado' }
  ];
  const targetOptions = filters.scope === 'team'
    ? teams.map(t => ({ value: t.id, label: t.name }))
    : filters.scope === 'employee'
      ? employees.map(e => ({ value: e.id, label: e.full_name || e.name || e.email }))
      : [];

  if (loading && !data) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
  if (!data) return null;

  // ── Calendario ───────────────────────────────────────────────────────────
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DAY_HEADERS = ['L','M','X','J','V','S','D'];
  const todayStr = new Date().toLocaleDateString('en-CA');
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // lunes=0
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - startOffset - daysInMonth).fill(null)
  ];

  const kpis = [
    { label: 'Empleados', value: data.totalEmployees, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Fichajes (Día)', value: data.shiftsToday, icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Ausencias (Día)', value: data.absencesToday, icon: CalendarOff, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Filtros ── */}
      <div className="bg-surface-dark p-4 rounded-2xl shadow-sm border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="w-full md:w-64 z-50">
            <CustomSelect options={scopeOptions} value={filters.scope}
              onChange={v => setFilters(prev => ({ ...prev, scope: v as any, targetId: '' }))} placeholder="Alcance..." />
          </div>
          {filters.scope !== 'org' && (
            <div className="w-full md:w-64 z-40">
              <CustomSelect options={targetOptions} value={filters.targetId || ''}
                onChange={v => setFilters(prev => ({ ...prev, targetId: v }))}
                placeholder={filters.scope === 'team' ? 'Selecciona equipo...' : 'Selecciona empleado...'}
                searchable={true} />
            </div>
          )}
        </div>
        <button
          onClick={() => setChatOpen(true)}
          className="relative flex items-center gap-3 bg-slate-800/50 p-2.5 px-4 rounded-xl border border-white/10 hover:border-primary/40 transition-colors cursor-pointer group"
        >
          <MessageCircle size={18} className="text-primary" />
          <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">Chat</span>
          {unreadChat > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-[#0d1117] animate-pulse">
              {unreadChat > 9 ? '9+' : unreadChat}
            </span>
          )}
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">

        {/* Left col */}
        <div className="lg:col-span-2 xl:col-span-3 space-y-6">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {loading && <div className="absolute inset-0 bg-surface-dark/50 backdrop-blur-sm z-20 rounded-2xl" />}
            {kpis.map((stat, i) => (
              <div key={i}
                   className="bg-surface-dark p-6 rounded-2xl shadow-sm border border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-slate-400 text-sm font-medium">
                    {stat.label}
                  </h3>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  </div>
                </div>
                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                  <stat.icon size={28} />
                </div>
              </div>
            ))}
          </div>

          {/* ── Escaleta Diaria (Línea Temporal) ── */}
          <div className="bg-surface-dark p-6 rounded-2xl shadow-sm border border-white/5">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Escaleta Diaria</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Programación vs Actividad Real ({new Date(filters.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })})
                </p>
              </div>
              {/* Leyenda */}
              <div className="hidden sm:flex items-center gap-4 text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-800 border border-white/10" /> Programado</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Trabajando</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400" /> Descanso</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-pink-500" /> Permiso</div>
              </div>
            </div>

            {/* Leyenda (móvil) */}
            <div className="flex sm:hidden items-center gap-3 mb-6 text-[10px] text-slate-400 flex-wrap">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-800 border border-white/10" /> Prog.</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Trab.</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400" /> Desc.</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-pink-500" /> Perm.</div>
            </div>

            {(() => {
              const timelines = data.employeeTimelines || [];
              const scheduled = timelines.filter((t: any) => t.scheduled);
              const unscheduled = timelines.filter((t: any) => !t.scheduled && t.segments.length > 0);
              
              let minMin = 24 * 60;
              let maxMin = 0;
              
              timelines.forEach((t: any) => {
                if (t.scheduled) {
                  minMin = Math.min(minMin, t.scheduled.startMin);
                  maxMin = Math.max(maxMin, t.scheduled.endMin);
                }
                if (t.scheduled2) {
                  minMin = Math.min(minMin, t.scheduled2.startMin);
                  maxMin = Math.max(maxMin, t.scheduled2.endMin);
                }
                t.segments.forEach((seg: any) => {
                  minMin = Math.min(minMin, seg.startMin);
                  maxMin = Math.max(maxMin, seg.endMin);
                });
              });

              if (minMin > maxMin) {
                 minMin = 8 * 60; // Por defecto
                 maxMin = 20 * 60;
              }

              // Pad by 1 hour on each side
              const startHour = Math.max(0, Math.floor(minMin / 60) - 1);
              const endHour = Math.min(48, Math.ceil(maxMin / 60) + 1);

              const VIEW_START = startHour * 60;
              const VIEW_END = endHour * 60;
              const VIEW_RANGE = VIEW_END - VIEW_START;
              
              const hoursSpan = endHour - startHour;
              const hourLabels = Array.from({ length: hoursSpan + 1 }).map((_, i) => startHour + i);
              const step = hoursSpan <= 12 ? 1 : (hoursSpan <= 18 ? 2 : 4);
              
              const todayStr = new Date().toLocaleDateString('en-CA');
              const isToday = filters.date === todayStr;
              const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
              const nowPct = ((nowMins - VIEW_START) / VIEW_RANGE) * 100;

              if (timelines.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
                    <CalendarIcon size={32} className="opacity-30" />
                    Sin actividad ni turnos programados este día
                  </div>
                );
              }

              const handleMouseEnter = (e: React.MouseEvent, emp: any) => {
                const rect = e.currentTarget.getBoundingClientRect();
                
                // Calculamos si hay espacio arriba (asumimos que el tooltip mide unos 250px de alto)
                const spaceAbove = rect.top;
                const renderBelow = spaceAbove < 280; // Si hay menos de 280px, lo renderizamos debajo
                
                setHoveredEmp({ ...emp, renderBelow });
                setGanttTooltipPos({ 
                  x: rect.left + rect.width / 2, 
                  y: renderBelow ? rect.bottom : rect.top 
                });
              };
              
              const handleMouseLeave = () => {
                setHoveredEmp(null);
              };

              const renderRow = (emp: any) => (
                <div key={emp.userId} className="flex items-center gap-3 mb-2.5 relative cursor-default"
                     onMouseEnter={(e) => handleMouseEnter(e, emp)}
                     onMouseLeave={handleMouseLeave}
                >
                  {/* Avatar y Nombre */}
                  <Link to={`/manager/equipos/trabajador/${emp.userId}`} className="w-[100px] shrink-0 flex items-center gap-2 hover:text-primary transition-colors min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                      {emp.avatar_url
                        ? <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[11px] font-bold text-slate-400 uppercase">{emp.name.charAt(0)}</span>
                      }
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs text-slate-300 font-medium truncate" title={emp.name}>{emp.name.split(' ')[0]}</span>
                      {(emp.scheduled?.name || emp.isPartida) && (
                        <span className="text-[8px] font-bold text-primary/70 uppercase tracking-wider leading-none mt-0.5">
                          {emp.scheduled?.name || 'Partido'}
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Timeline Barra */}
                  <div className="relative flex-1 h-10 rounded-xl overflow-hidden border border-white/5 bg-slate-900/40">
                    {/* Líneas guía de horas */}
                    {hourLabels.map(h => {
                      if (h % step !== 0) return null;
                      return (
                        <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-800/60"
                          style={{ left: `${((h * 60 - VIEW_START) / VIEW_RANGE) * 100}%` }} />
                      );
                    })}

                    {/* Sombra de Turno(s) Programado(s) */}
                    {[emp.scheduled, emp.scheduled2].filter(Boolean).map((sched: any, si: number) => {
                      const c = sched.color || 'bg-slate-700';
                      const isHex = c.startsWith('#') || c.startsWith('rgb');
                      const twBg = isHex ? '' : c;
                      const hexBg = isHex ? c : undefined;
                      return (
                        <div key={si} className="absolute top-0 bottom-0 overflow-hidden rounded-md z-0"
                          style={{
                            left: `${((Math.max(sched.startMin, VIEW_START) - VIEW_START) / VIEW_RANGE) * 100}%`,
                            width: `${((Math.min(sched.endMin, VIEW_END) - Math.max(sched.startMin, VIEW_START)) / VIEW_RANGE) * 100}%`,
                          }}
                        >
                          <div className={`absolute inset-0 opacity-15 ${twBg}`} style={{ backgroundColor: hexBg }} />
                          <span className="absolute left-2 top-1 text-[9px] font-bold tracking-widest hidden sm:block z-10 text-white/50 whitespace-nowrap">
                            {formatMin(sched.startMin)} — {formatMin(sched.endMin)}
                          </span>
                        </div>
                      );
                    })}

                    {/* Fichajes Reales (Actividad) - Sólidos en la mitad inferior (mazacote) */}
                    {emp.segments.map((seg: any, si: number) => {
                      const cs = Math.max(seg.startMin, VIEW_START);
                      const ce = Math.min(seg.endMin, VIEW_END);
                      if (ce <= cs) return null;
                      const lp = ((cs - VIEW_START) / VIEW_RANGE) * 100;
                      const wp = ((ce - cs) / VIEW_RANGE) * 100;
                      
                      const touchesPrev = si > 0 && Math.abs(seg.startMin - emp.segments[si - 1].endMin) <= 1;
                      const touchesNext = si < emp.segments.length - 1 && Math.abs(seg.endMin - emp.segments[si + 1].startMin) <= 1;
                      const isOpen = si === emp.segments.length - 1 && emp.isStillIn;
                      
                      let radiusClass = '';
                      if (touchesPrev && (touchesNext || isOpen)) radiusClass = '';
                      else if (touchesPrev) radiusClass = 'rounded-r-[4px]';
                      else if (touchesNext || isOpen) radiusClass = 'rounded-l-[4px]';
                      else radiusClass = 'rounded-[4px]';

                      const col = SEG_COLORS_HEX[seg.type] || '#10b981';
                      return (
                        <div key={si}
                          className={`absolute top-[45%] bottom-1.5 z-20 transition-all hover:scale-y-110 hover:-translate-y-0.5 ${radiusClass}`}
                          style={{ left: `${lp}%`, width: `${wp}%`, backgroundColor: col }}
                        />
                      );
                    })}

                  </div>
                </div>
              );

              const renderSection = (titleNode: React.ReactNode, list: any[], maxHeight: string) => {
                if (list.length === 0) return null;
                return (
                  <div className="relative pb-6">
                    {/* Título de sección */}
                    <div className="mb-3 pb-2 border-b border-white/5">
                      {titleNode}
                    </div>

                    <div className="relative">
                      {/* Línea GLOBAL del momento actual para esta sección */}
                      {isToday && nowPct >= 0 && nowPct <= 100 && (
                        <div className="absolute top-[32px] bottom-0 border-l-2 border-dashed border-red-500/60 z-0 pointer-events-none"
                             style={{ left: `calc(112px + (100% - 120px) * ${nowPct / 100})` }}>
                          <div className="absolute -top-1.5 -left-[5px] w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]" />
                        </div>
                      )}

                      {/* Eje Horas (Ruler Detallado) para esta sección */}
                      <div className="relative h-8 ml-[112px] mr-2 border-b border-slate-800/60 mb-4">
                        {hourLabels.map((h) => {
                          const isMajor = h % step === 0;
                          return (
                            <div key={h} className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
                                 style={{ left: `${((h * 60 - VIEW_START) / VIEW_RANGE) * 100}%` }}>
                              {isMajor && (
                                <span className="text-[9px] font-bold text-slate-500 mb-1 flex items-center gap-0.5 whitespace-nowrap">
                                  {String(h % 24).padStart(2, '0')}:00
                                  {h >= 24 && <span className="text-[7px] text-blue-400 font-bold">+1d</span>}
                                </span>
                              )}
                              <div className={`w-px bg-slate-600/50 ${isMajor ? 'h-2' : 'h-1'}`} />
                            </div>
                          );
                        })}
                      </div>

                      {/* Filas */}
                      <div className={`${maxHeight} overflow-y-auto custom-scrollbar pr-2 relative z-10`}>
                        {list.map(renderRow)}
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-6">
                  {renderSection(
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Programados ({scheduled.length})
                    </h4>,
                    scheduled,
                    "max-h-[300px]"
                  )}

                  {renderSection(
                    <h4 className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest">
                      Fichajes sin Turno ({unscheduled.length})
                    </h4>,
                    unscheduled,
                    "max-h-[200px]"
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── Registro de Fichajes del Día ── */}
          <div className="bg-surface-dark p-6 rounded-2xl shadow-sm border border-white/5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Registro de Fichajes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(filters.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {' · '}{data?.todayEntries?.length || 0} registros
                  </p>
                </div>
              </div>
            </div>

            {(!data?.todayEntries || data.todayEntries.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm gap-3">
                <ClipboardList size={32} className="opacity-30" />
                Sin fichajes registrados este día
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Empleado</th>
                      <th className="text-left py-3 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left py-3 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1">Hora <ArrowUpDown size={10} /></span>
                      </th>
                      <th className="text-left py-3 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(data.todayEntries || [])]
                      .sort((a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                      .map((entry: any, idx: number) => {
                        const emp = data.profiles?.find((p: any) => p.id === entry.user_id);
                        const entryTypeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
                          'clock-in':    { label: 'Entrada',       icon: LogIn,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                          'clock-out':   { label: 'Salida',        icon: LogOut, color: 'text-red-400',     bg: 'bg-red-500/10' },
                          'break-start': { label: 'Inicio Pausa',  icon: Coffee, color: 'text-amber-400',   bg: 'bg-amber-500/10' },
                          'break-end':   { label: 'Fin Pausa',     icon: Coffee, color: 'text-blue-400',    bg: 'bg-blue-500/10' },
                          'others-out':  { label: 'Salida Otros',  icon: LogOut, color: 'text-pink-400',    bg: 'bg-pink-500/10' },
                          'others-in':   { label: 'Entrada Otros', icon: LogIn,  color: 'text-pink-400',    bg: 'bg-pink-500/10' },
                        };
                        const cfg = entryTypeConfig[entry.entry_type] || { label: entry.entry_type, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10' };
                        const IconComp = cfg.icon;
                        const time = new Date(entry.occurred_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        const status = entry.status || 'approved';
                        const statusConfig: Record<string, { label: string; style: string }> = {
                          approved: { label: 'Aprobado', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                          pending:  { label: 'Pendiente', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                          rejected: { label: 'Denegado', style: 'bg-red-500/10 text-red-400 border-red-500/20' },
                        };
                        const sc = statusConfig[status] || statusConfig.approved;

                        return (
                          <tr key={entry.id || idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                                  {emp?.avatar_url
                                    ? <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                                    : <User size={14} className="text-slate-500" />
                                  }
                                </div>
                                <span className="text-slate-200 font-medium text-xs truncate max-w-[140px]">
                                  {emp?.full_name || emp?.email?.split('@')[0] || 'Desconocido'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
                                <IconComp size={13} />
                                {cfg.label}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-slate-300 font-mono text-xs">{time}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${sc.style}`}>
                                {sc.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>


        </div>

        {/* Right col */}
        <div className="space-y-6">
          {/* Solicitudes de Fichaje Manual */}
          <div className="bg-surface-dark p-6 rounded-2xl shadow-sm border border-white/5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-400 text-sm font-medium">Solicitudes Fichaje</p>
                <p className="text-3xl font-bold text-white mt-1">{data?.pendingTimeRequests?.length || 0}</p>
              </div>
              <div className={`p-4 rounded-2xl ${data?.pendingTimeRequests?.length > 0 ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-500/10 text-slate-500'}`}>
                <Clock size={28} />
              </div>
            </div>
            {(!data?.pendingTimeRequests || data.pendingTimeRequests.length === 0) ? (
              <div className="flex-1 flex flex-col items-center justify-center py-4 text-slate-500 text-sm">
                <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center mb-2">
                  <Check size={18} className="text-slate-600" />
                </div>
                Todo al día
              </div>
            ) : (
              <ul className="space-y-3 overflow-y-auto max-h-[250px] custom-scrollbar pr-2">
                {data.pendingTimeRequests.map((req: any) => (
                  <li key={req.id} className="flex flex-col p-3 bg-white/5 border border-white/5 rounded-xl gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {req.avatar_url ? <img src={req.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={16} className="text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-200 text-sm leading-tight truncate">{req.employeeName}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {req.type === 'clock-in' ? 'Entrada' : req.type === 'clock-out' ? 'Salida' : 'Pausa'} a las <span className="text-white font-mono">{new Date(req.date).toTimeString().substring(0, 5)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full">
                      <button onClick={() => handleApproveTimeRequest(req.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold transition-colors border border-emerald-500/20">
                        <Check size={14} /> Aceptar
                      </button>
                      <button onClick={() => handleRejectTimeRequest(req.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-colors border border-red-500/20">
                        <X size={14} /> Denegar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Calendario Mensual */}
          <div className="bg-surface-dark p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col">
            {/* Cabecera */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white capitalize">
                {MONTH_NAMES[calendarMonth]} de {calendarYear}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
                    else setCalendarMonth(m => m - 1);
                  }}
                  className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
                    else setCalendarMonth(m => m + 1);
                  }}
                  className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Headers LMXJVSD */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_HEADERS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-500">{d}</div>
              ))}
            </div>

            {/* Celdas */}
            <div className="grid grid-cols-7 gap-y-2 flex-1 content-start">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const mData = monthData[dateStr];
                
                const timelinesCount = mData?.timelines?.length || 0;
                const scheduledCount = mData?.scheduledShifts?.length || 0;
                const totalActivity = timelinesCount + scheduledCount;
                
                const isSelected = filters.date === dateStr;
                const isTodayDate = todayStr === dateStr;

                const dateObj = new Date(calendarYear, calendarMonth, day);
                const dayOfWeek = dateObj.getDay();
                const isDayOpen = calendarConfig.weeklySchedule[dayOfWeek]?.active ?? true;
                let specialType = calendarConfig.specialDays[dateStr];
                
                if (!specialType && !isDayOpen) {
                  specialType = 'closed_normal';
                }

                let textColor = 'text-white hover:bg-white/10';
                if (specialType === 'closed_normal') textColor = 'text-slate-500 hover:bg-white/5 opacity-50';
                else if (specialType === 'closed_holiday') textColor = 'text-red-400 hover:bg-red-400/10';
                else if (specialType === 'open_holiday') textColor = 'text-emerald-400 hover:bg-emerald-400/10';
                else if (specialType === 'open_partial_holiday') textColor = 'text-orange-400 hover:bg-orange-400/10';
                else if (specialType === 'open_unexpected') textColor = 'text-fuchsia-400 hover:bg-fuchsia-400/10';

                // Override principal state
                if (isSelected) textColor = 'border-2 border-primary bg-primary/10 text-white';
                else if (isTodayDate && !specialType) textColor = 'bg-primary/10 hover:bg-primary/20 text-primary';

                return (
                  <div key={i} className="flex flex-col items-center justify-start cursor-pointer relative"
                       onClick={() => setFilters(prev => ({ ...prev, date: dateStr }))}
                       onMouseEnter={(e) => handleDayMouseEnter(dateStr, e)}
                       onMouseLeave={() => setHoveredDay(null)}
                  >
                    <div className={`w-8 h-8 flex flex-col items-center justify-center rounded-lg transition-all relative z-10 ${textColor}`}>
                      <span className="text-sm font-bold">{day}</span>
                      {totalActivity > 0 && (
                        <span className={`text-[9px] font-semibold -mt-1 leading-none ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>{totalActivity}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Presentes ahora */}
          <div className="bg-surface-dark p-6 rounded-2xl shadow-sm border border-white/5 flex flex-col flex-1 max-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Presentes Ahora</h3>
              <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-md border border-emerald-500/20">
                {data.presentEmployees.length}
              </span>
            </div>
            {data.presentEmployees.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Nadie en turno actualmente.</div>
            ) : (
              <ul className="space-y-3 overflow-y-auto custom-scrollbar pr-2">
                {data.presentEmployees.map((emp: any) => (
                  <li key={emp.id} className="flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 transition-colors rounded-lg">
                    <Link to={`/manager/equipos/trabajador/${emp.id}`} className="flex items-center gap-3 hover:text-primary transition-colors min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {emp.avatar_url ? <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={16} className="text-slate-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200 text-sm leading-tight truncate max-w-[120px]">{emp.employeeName}</p>
                        <p className="text-[10px] text-slate-500">{emp.startTime?.substring(0, 5)}</p>
                      </div>
                    </Link>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Popover hover día ── */}
      {hoveredDay && (
        <div
          style={{ ...popoverStyle, position: 'fixed', zIndex: 9999 }}
          className="bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-3 pointer-events-none min-w-[180px]"
        >
          {/* Título */}
          <p className="text-xs font-bold text-white mb-2 capitalize border-b border-white/10 pb-2">
            {new Date(hoveredDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between items-center gap-4">
              <span className="text-[10px] text-slate-400">Actividad Real:</span>
              <span className="text-[10px] font-bold text-white">
                {monthData[hoveredDay]?.timelines?.length || 0} emp.
              </span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-[10px] text-slate-400">Programados:</span>
              <span className="text-[10px] font-bold text-violet-400">
                {monthData[hoveredDay]?.scheduledShifts?.length || 0} turnos
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TOOLTIP GLOBAL GANTT */}
      {hoveredEmp && (
        <div className="fixed flex flex-col z-[9999] w-72 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 text-xs pointer-events-none transition-opacity duration-150"
             style={{
               left: ganttTooltipPos.x,
               top: hoveredEmp.renderBelow ? ganttTooltipPos.y + 12 : ganttTooltipPos.y - 12,
               transform: hoveredEmp.renderBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
             }}
        >
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
              {hoveredEmp.avatar_url ? <img src={hoveredEmp.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-400 uppercase">{hoveredEmp.name.charAt(0)}</span>}
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">{hoveredEmp.name}</h4>
              {hoveredEmp.scheduled ? (
                <p className="text-slate-400 text-[10px]">
                  Turno: {formatMin(hoveredEmp.scheduled.startMin)} - {formatMin(hoveredEmp.scheduled.endMin)}
                </p>
              ) : (
                <p className="text-amber-500/80 text-[10px]">Sin turno programado</p>
              )}
            </div>
          </div>

          {hoveredEmp.segments && hoveredEmp.segments.length > 0 ? (() => {
            let totalWork = 0;
            let totalBreak = 0;
            return (
              <>
                <div className="space-y-2 mb-3">
                  {hoveredEmp.segments.map((seg: any, i: number) => {
                    const isOpen = i === hoveredEmp.segments.length - 1 && hoveredEmp.isStillIn;
                    const startStr = formatMin(seg.startMin);
                    const endStr = isOpen ? 'Ahora' : formatMin(seg.endMin);
                    
                    const durationMins = seg.endMin - seg.startMin;
                    const h = Math.floor(durationMins / 60);
                    const m = Math.floor(durationMins % 60);
                    const durStr = isOpen ? 'En curso' : `${h > 0 ? h + 'h ' : ''}${m}m`;
                    
                    let typeName = 'Trabajo';
                    let colorClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
                    if (seg.type === 'break') {
                      typeName = 'Descanso';
                      colorClass = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
                    } else if (seg.type === 'others') {
                      typeName = 'Otras tareas';
                      colorClass = 'text-pink-400 bg-pink-400/10 border-pink-400/20';
                    }
                    
                    if (seg.type === 'working') totalWork += durationMins;
                    else if (seg.type === 'break') totalBreak += durationMins;

                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-slate-400">{startStr} - {endStr}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${colorClass}`}>{typeName}</span>
                          <span className="font-bold text-white text-[10px] w-12 text-right">{durStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="pt-3 border-t border-white/10 flex justify-between items-center text-[11px] bg-slate-900/30 -mx-4 -mb-4 p-3 rounded-b-xl">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="text-slate-400">Total Trabajado:</span>
                    <span className="font-bold text-sm">{Math.floor(totalWork/60)}h {Math.floor(totalWork%60)}m</span>
                  </div>
                  {totalBreak > 0 && (
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <span className="text-slate-400">Descanso:</span>
                      <span className="font-bold">{Math.floor(totalBreak/60)}h {Math.floor(totalBreak%60)}m</span>
                    </div>
                  )}
                </div>
              </>
            );
          })() : (
            <div className="text-center text-slate-500 text-[10px] py-2">Sin fichajes reales registrados.</div>
          )}

          {/* Flechita dinámica */}
          <div className={`absolute left-1/2 -translate-x-1/2 border-[6px] border-transparent ${
            hoveredEmp.renderBelow 
              ? 'bottom-full border-b-slate-800/95' 
              : 'top-full border-t-slate-800/95'
          }`} />
        </div>
      )}


      {/* ── Chat Panel ── */}
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} onUnreadChange={handleUnreadChange} />

    </div>
  );
};

export default Dashboard;
