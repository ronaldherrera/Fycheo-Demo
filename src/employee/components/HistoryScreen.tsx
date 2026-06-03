
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../EmployeeApp';
import { DEFAULT_AVATAR } from '../constants';
import { supabase } from '../services/supabase';
import { adjustDataToCurrentDate, adjustDateString, deAdjustISOString, deAdjustDateString } from '../../lib/date-adjuster';

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const minutesToLabel = (mins: number) => {
  const rounded = Math.round(mins);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const typeMeta = (t: string | null | undefined) => {
  const type = (t ?? "").toLowerCase();
  switch (type) {
    case "clock-in":
      return { label: "Entrada trabajo", icon: "login", color: "primary" as const };
    case "clock-out":
      return { label: "Salida trabajo", icon: "logout", color: "slate" as const };
    case "break-start":
      return { label: "Inicio descanso", icon: "coffee", color: "amber" as const };
    case "break-end":
      return { label: "Entrada trabajo", icon: "login", color: "primary" as const };
    case "others-in":
      return { label: "Entrada trabajo", icon: "login", color: "primary" as const };
    case "others-out":
      return { label: "Permiso", icon: "edit_note", color: "pink" as const };
    default:
      return { label: "Registro", icon: "schedule", color: "primary" as const };
  }
};

const colorClasses = (c: "primary" | "slate" | "amber" | "emerald" | "pink") => {
  switch (c) {
    case "slate": return { border: "border-slate-500", iconBg: "bg-slate-500/10", iconText: "text-slate-500" };
    case "amber": return { border: "border-amber-500", iconBg: "bg-amber-500/10", iconText: "text-amber-500" };
    case "emerald": return { border: "border-emerald-500", iconBg: "bg-emerald-500/10", iconText: "text-emerald-500" };
    case "pink": return { border: "border-pink-500", iconBg: "bg-pink-500/10", iconText: "text-pink-500" };
    case "primary": default: return { border: "border-primary", iconBg: "bg-primary/10", iconText: "text-primary" };
  }
};

const getShiftStyle = (color: string | undefined | null) => {
  let c = color || '';
  if (c.includes('indigo')) c = 'bg-purple-600';
  if (c.includes('fuchsia')) c = 'bg-pink-400';

  if (c.includes('lime'))    return { card: 'bg-lime-400/10 border-lime-400/30',       bar: 'bg-lime-400',    iconBg: 'bg-lime-400/20',    iconText: 'text-lime-600 dark:text-lime-400',    title: 'text-lime-900 dark:text-lime-100',       notes: 'text-lime-600 dark:text-lime-300' };
  if (c.includes('cyan'))    return { card: 'bg-cyan-400/10 border-cyan-400/30',       bar: 'bg-cyan-400',    iconBg: 'bg-cyan-400/20',    iconText: 'text-cyan-600 dark:text-cyan-400',    title: 'text-cyan-900 dark:text-cyan-100',       notes: 'text-cyan-600 dark:text-cyan-300' };
  if (c.includes('orange'))  return { card: 'bg-orange-500/10 border-orange-500/30',   bar: 'bg-orange-500',  iconBg: 'bg-orange-500/20',  iconText: 'text-orange-600 dark:text-orange-400', title: 'text-orange-900 dark:text-orange-100',   notes: 'text-orange-600 dark:text-orange-300' };
  if (c.includes('yellow'))  return { card: 'bg-yellow-400/10 border-yellow-400/30',   bar: 'bg-yellow-400',  iconBg: 'bg-yellow-400/20',  iconText: 'text-yellow-600 dark:text-yellow-400', title: 'text-yellow-900 dark:text-yellow-100',   notes: 'text-yellow-600 dark:text-yellow-300' };
  if (c.includes('emerald')) return { card: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-600 dark:text-emerald-400', title: 'text-emerald-900 dark:text-emerald-100', notes: 'text-emerald-600 dark:text-emerald-300' };
  if (c.includes('red'))     return { card: 'bg-red-500/10 border-red-500/30',         bar: 'bg-red-500',     iconBg: 'bg-red-500/20',     iconText: 'text-red-600 dark:text-red-400',      title: 'text-red-900 dark:text-red-100',         notes: 'text-red-600 dark:text-red-300' };
  if (c.includes('purple'))  return { card: 'bg-purple-600/10 border-purple-600/30',   bar: 'bg-purple-600',  iconBg: 'bg-purple-600/20',  iconText: 'text-purple-600 dark:text-purple-400', title: 'text-purple-900 dark:text-purple-100',   notes: 'text-purple-600 dark:text-purple-300' };
  if (c.includes('pink'))    return { card: 'bg-pink-400/10 border-pink-400/30',       bar: 'bg-pink-400',    iconBg: 'bg-pink-400/20',    iconText: 'text-pink-600 dark:text-pink-400',    title: 'text-pink-900 dark:text-pink-100',       notes: 'text-pink-600 dark:text-pink-300' };
  if (c.includes('amber'))   return { card: 'bg-amber-500/10 border-amber-500/30',     bar: 'bg-amber-500',   iconBg: 'bg-amber-500/20',   iconText: 'text-amber-600 dark:text-amber-400',  title: 'text-amber-900 dark:text-amber-100',     notes: 'text-amber-600 dark:text-amber-300' };
  if (c.includes('slate'))   return { card: 'bg-slate-400/10 border-slate-400/30',     bar: 'bg-slate-400',   iconBg: 'bg-slate-400/20',   iconText: 'text-slate-600 dark:text-slate-400',  title: 'text-slate-900 dark:text-slate-100',     notes: 'text-slate-600 dark:text-slate-300' };
  return                            { card: 'bg-blue-500/10 border-blue-500/30',        bar: 'bg-blue-500',    iconBg: 'bg-blue-500/20',    iconText: 'text-blue-600 dark:text-blue-400',    title: 'text-blue-900 dark:text-blue-100',       notes: 'text-blue-600 dark:text-blue-300' };
};

const HistoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [entryType, setEntryType] = useState<'clock-in' | 'clock-out' | 'break-start' | 'break-end' | 'others-in' | 'others-out'>('clock-in');
  const [context, setContext] = useState('');
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [plannedShifts, setPlannedShifts] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'activity' | 'shifts'>('shifts');
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [monthShifts, setMonthShifts] = useState<Record<string, any>>({});
  const [monthHolidays, setMonthHolidays] = useState<Record<string, any>>({});
  const [companySchedule, setCompanySchedule] = useState<Record<string, any>>({});
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamShifts, setTeamShifts] = useState<Record<string, any[]>>({});

  // Form states
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [formDate, setFormDate] = useState(isoDate(new Date()));
  const [formTime, setFormTime] = useState('08:00');
  const [formTimeEnd, setFormTimeEnd] = useState('');

  // Estados para Modal de Borrado UI
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<{id: string, cascadeId?: string, message?: string} | null>(null);
  const [canDelete, setCanDelete] = useState(false); // Restricción de borrado: solo el último global

  // Constraints for editing
  const [editConstraints, setEditConstraints] = useState<{min: string | null, max: string | null, minTime?: Date, maxTime?: Date, minType?: string, maxType?: string} | null>(null);
  const [latestGlobalId, setLatestGlobalId] = useState<string | null>(null); // ID of the absolute latest record
  
  // Custom Error Modal State
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveCompany = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .eq('accepted', true)
        .maybeSingle();

      if (data) {
        setActiveCompanyId(data.company_id);
      } else {
        setActiveCompanyId(null);
      }
    };
    fetchActiveCompany();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !activeCompanyId) return;

    const channel = supabase
      .channel('realtime_history_screen')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `company_id=eq.${activeCompanyId}`,
        },
        (payload) => {
          const record = (payload.new as any) || (payload.old as any);
          if (record && record.user_id === user.id) {
             setRefreshKey(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeCompanyId]);

  useEffect(() => {
    const fetchMonthData = async () => {
      if (!user?.id) return;
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = isoDate(new Date(year, month, 1));
      const endDate = isoDate(new Date(year, month + 1, 0));

      const { data: shiftsData } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .gte('date', deAdjustDateString(startDate))
        .lte('date', deAdjustDateString(endDate));

      if (shiftsData) {
        const map: Record<string, any> = {};
        shiftsData.forEach(s => {
          const adj = adjustDateString(s.date);
          map[adj] = { ...s, date: adj };
        });
        setMonthShifts(map);
      } else {
        setMonthShifts({});
      }

      if (activeCompanyId) {
        // Obtener el team_id del usuario
        const { data: memberData } = await supabase
          .from('company_members')
          .select('team_id')
          .eq('user_id', user.id)
          .eq('company_id', activeCompanyId)
          .single();

        let teamIds: string[] = [];
        if (memberData?.team_id) {
          const { data: tMembers } = await supabase
            .from('company_members')
            .select('user_id, profiles!inner(full_name, avatar)')
            .eq('team_id', memberData.team_id)
            .eq('company_id', activeCompanyId);
          
          if (tMembers) {
            const others = tMembers.filter((m: any) => m.user_id !== user.id);
            setTeamMembers(others);
            teamIds = others.map((m: any) => m.user_id);
          }
        } else {
          setTeamMembers([]);
        }

        const [holidaysRes, settingsRes, teamShiftsRes] = await Promise.all([
          supabase
            .from('company_holidays')
            .select('date, type, name, start_time, end_time')
            .eq('company_id', activeCompanyId)
            .gte('date', deAdjustDateString(startDate))
            .lte('date', deAdjustDateString(endDate)),
          supabase
            .from('companies')
            .select('settings')
            .eq('id', activeCompanyId)
            .single(),
          teamIds.length > 0 ? supabase
            .from('shifts')
            .select('*')
            .in('employee_id', teamIds)
            .gte('date', deAdjustDateString(startDate))
            .lte('date', deAdjustDateString(endDate)) : Promise.resolve({ data: [] })
        ]);

        if (teamShiftsRes.data) {
           const tsMap: Record<string, any[]> = {};
           teamShiftsRes.data.forEach((s: any) => {
               const adj = adjustDateString(s.date);
               if (!tsMap[adj]) tsMap[adj] = [];
               tsMap[adj].push({ ...s, date: adj });
           });
           setTeamShifts(tsMap);
        } else {
           setTeamShifts({});
        }

        const schedule = settingsRes.data?.settings?.schedule || {};
        setCompanySchedule(schedule);

        if (holidaysRes.data) {
          const hMap: Record<string, any> = {};
          holidaysRes.data.forEach(h => {
            const d = new Date(h.date);
            const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
            const isNormallyClosed = !schedule[dayKeys[d.getDay()]]?.active;

            let color = 'text-emerald-500 dark:text-emerald-400';
            let context = 'Abierto (Horario habitual)';
            let bgClass = 'bg-emerald-500/10 border-emerald-500/30';
            let iconClass = 'text-emerald-500 bg-emerald-500/20';
            let barClass = 'bg-emerald-500';

            if (h.type === 'closed') {
                color = 'text-red-500 dark:text-red-400';
                context = 'Cerrado todo el día';
                bgClass = 'bg-red-500/10 border-red-500/30';
                iconClass = 'text-red-500 bg-red-500/20';
                barClass = 'bg-red-500';
            } else if (isNormallyClosed) {
                color = 'text-fuchsia-500 dark:text-fuchsia-400';
                bgClass = 'bg-fuchsia-500/10 border-fuchsia-500/30';
                iconClass = 'text-fuchsia-500 bg-fuchsia-500/20';
                barClass = 'bg-fuchsia-500';
            } else if (h.type === 'special_hours') {
                color = 'text-orange-500 dark:text-orange-400';
                context = `Horario: ${h.start_time?.slice(0, 5) || ''} a ${h.end_time?.slice(0, 5) || ''}`;
                bgClass = 'bg-orange-500/10 border-orange-500/30';
                iconClass = 'text-orange-500 bg-orange-500/20';
                barClass = 'bg-orange-500';
            }

            hMap[h.date] = { ...h, color, context, bgClass, iconClass, barClass };
          });
          setMonthHolidays(hMap);
        } else {
          setMonthHolidays({});
        }
      } else {
        setMonthHolidays({});
      }
    };
    fetchMonthData();
  }, [user?.id, activeCompanyId, currentDate]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setLoadingHistory(true);
      const dateStr = isoDate(selectedDate);
      
      // Rango del día seleccionado
      const start = `${dateStr}T00:00:00`;
      const end = `${dateStr}T23:59:59`;

      const { data, error } = await supabase
        .from('time_entries')
        .select('*, companies:company_id(name)')
        .eq('user_id', user.id)
        .gte('occurred_at', deAdjustISOString(start))
        .lte('occurred_at', deAdjustISOString(end))
        .order('occurred_at', { ascending: false });

      if (!error && data) {
         setHistoryEntries(adjustDataToCurrentDate(data));
      } else {
         setHistoryEntries([]);
      }
      setLoadingHistory(false);

      // Cargar turnos (Shifts)
      setLoadingShifts(true);
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', user.id)
        .eq('date', dateStr)
        .eq('is_published', true);

      if (!shiftsError && shiftsData) {
         setPlannedShifts(shiftsData);
      } else {
         setPlannedShifts([]);
      }
      setLoadingShifts(false);

      // Fetch Global Latest ID (to handle "Delete" button visibility correctly across days)
      const { data: latestData } = await supabase
        .from('time_entries')
        .select('id')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestData) {
         setLatestGlobalId(latestData.id);
      } else {
         setLatestGlobalId(null);
      }
    };

    fetchHistory();
  }, [selectedDate, user, refreshKey]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleDelete = async (id: string) => {
    // 1. Obtener registro para comprobar cascada
    const { data: entry, error: fetchErr } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !entry) {
       console.error(fetchErr);
       alert("No se pudo localizar el registro");
       return;
    }

    const type = (entry.entry_type ?? "").toLowerCase();
    
    // SAFETY CHECK: Ensure this is GLOBALLY the last record before deleting
    // (If user clicks delete from the list, we must re-verify because list state might be stale or partial)
    const { data: futureEntries } = await supabase
         .from('time_entries')
         .select('id')
         .eq('user_id', user.id)
         .gt('occurred_at', entry.occurred_at)
         .limit(1);

    


    if (futureEntries && futureEntries.length > 0) {
        alert("Solo se puede eliminar el último registro del historial completo.");
        return;
    }

    // Identificar si es un evento de cierre que requiere borrar su apertura
    // Identificar si es un evento de cierre que requiere borrar su apertura
    // AHORA: clock-in también puede cerrar break-start/others-out
    const potentialLinks = ['break-start', 'others-out'];
    let cascadeId = undefined;
    let linkMsg = null;

    // Buscar SIEMPRE el registro anterior inmediato para ver si formamos un par
    const { data: prevs } = await supabase
         .from('time_entries')
         .select('*')
         .eq('user_id', user.id)
         .lt('occurred_at', entry.occurred_at)
         .order('occurred_at', { ascending: false })
         .limit(1);

    if (prevs && prevs.length > 0) {
        const prev = prevs[0];
        const prevType = prev.entry_type;
        
        // Si borramos un break-end, tiene que haber un break-start antes (lógica original)
        if (type === 'break-end' && prevType === 'break-start') {
             cascadeId = prev.id;
             linkMsg = `Al eliminar este fin de descanso, se eliminará también el inicio correspondiente.`;
        }
        // Si borramos un others-in, tiene que haber un others-out antes
        else if (type === 'others-in' && prevType === 'others-out') {
             cascadeId = prev.id;
             linkMsg = `Al eliminar esta vuelta de permiso, se eliminará también la salida correspondiente.`;
        }
        // NUEVO: Si borramos un clock-in (que se usa como cierre genérico ahora), y el anterior es break/others
        else if (type === 'clock-in' && (prevType === 'break-start' || prevType === 'others-out')) {
             cascadeId = prev.id;
             linkMsg = `Al eliminar esta Entrada, se eliminará también el registro de ${prevType === 'break-start' ? 'Inicio Descanso' : 'Salida Permiso'} previo.`;
        }
    }

    // Setear estado y abrir modal
    setEntryToDelete({ id, cascadeId, message: linkMsg || undefined });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;

    // Borrar principal
    const { error } = await supabase.from('time_entries').delete().eq('id', entryToDelete.id);
    if (error) {
       console.error(error);
       alert("Error al eliminar");
    } else {
       // Borrar cascada
       if (entryToDelete.cascadeId) {
          await supabase.from('time_entries').delete().eq('id', entryToDelete.cascadeId);
       }
       handleRefresh();
    }
    setDeleteModalOpen(false);
    setEntryToDelete(null);
  };

  const openAddModal = () => {
    setEditingEntry(null);
    setEntryType('clock-in');
    setContext('');
    setFormDate(isoDate(selectedDate)); // Default to selected date
    const now = new Date();
    setFormTime(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
    setFormTimeEnd('');
    setShowModal(true);
  };



  const openEditModal = async (entry: any) => {
    // 1. Set initial state immediately to show modal fast (constraints will load in a moment if async needed? 
    // Actually better to wait for constraints to avoid "jumping" validation or allowing edits before check.
    // Let's set the entry first.
    setEditingEntry(entry);
    setEntryType(entry.entry_type);
    setContext(entry.description || ''); // Simple context mapping
    
    const d = entry.occurred_at ? new Date(entry.occurred_at) : new Date(entry.created_at);
    setFormDate(isoDate(d));
    setFormTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    setFormTimeEnd('');

    // Reset constraints initially
    setEditConstraints(null);
    setShowModal(true);

    // Calcular restricciones de tiempo
    // historyEntries está ordenado descendente (más nuevo primero)
    // index-1 es el siguiente cronológicamente (futuro) -> MAX
    // index+1 es el anterior cronológicamente (pasado) -> MIN
    const idx = historyEntries.findIndex(e => e.id === entry.id);
    let minT: Date | undefined = undefined;
    let maxT: Date | undefined = undefined;
    let minType: string | null = null;
    let maxType: string | null = null;
    let minStr: string | null = null;
    let maxStr: string | null = null;

    if (idx !== -1) {
       // --- MIN CONSTRAINT (Previous in time) ---
       if (idx < historyEntries.length - 1) {
          // Local neighbor found
          const prevEntry = historyEntries[idx + 1];
          const prevD = prevEntry.occurred_at ? new Date(prevEntry.occurred_at) : new Date(prevEntry.created_at);
          minT = prevD;
          minType = prevEntry.entry_type;
       } else {
          // No local neighbor (First of the day). Check DB for last record BEFORE this one.
           const { data: prevDb } = await supabase
             .from('time_entries')
             .select('*')
             .eq('user_id', user.id)
             .lt('occurred_at', entry.occurred_at) // Strictly before
             .order('occurred_at', { ascending: false })
             .limit(1)
             .maybeSingle();
           
           if (prevDb) {
              minT = prevDb.occurred_at ? new Date(prevDb.occurred_at) : new Date(prevDb.created_at);
              minType = prevDb.entry_type;
           }
       }

       // --- MAX CONSTRAINT (Next in time) ---
       if (idx > 0) {
          // Local neighbor found
          const nextEntry = historyEntries[idx - 1];
          const nextD = nextEntry.occurred_at ? new Date(nextEntry.occurred_at) : new Date(nextEntry.created_at);
          maxT = nextD;
          maxType = nextEntry.entry_type;
       } else {
          // No local neighbor (Last of the day). Check DB for first record AFTER this one.
          const { data: nextDb } = await supabase
             .from('time_entries')
             .select('*')
             .eq('user_id', user.id)
             .gt('occurred_at', entry.occurred_at) // Strictly after
             .order('occurred_at', { ascending: true })
             .limit(1)
             .maybeSingle();
             
           if (nextDb) {
              maxT = nextDb.occurred_at ? new Date(nextDb.occurred_at) : new Date(nextDb.created_at);
              maxType = nextDb.entry_type;
           }
       }
    }

    if (minT) minStr = `${pad2(minT.getHours())}:${pad2(minT.getMinutes())}`;
    if (maxT) maxStr = `${pad2(maxT.getHours())}:${pad2(maxT.getMinutes())}`;

    setEditConstraints({ 
        min: minStr, 
        max: maxStr, 
        minTime: minT, 
        maxTime: maxT,
        minType,
        maxType
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Helper to construct Date
    const makeDate = (dateStr: string, timeStr: string) => {
       const [y, m, d] = dateStr.split('-').map(Number);
       const [hh, mm] = timeStr.split(':').map(Number);
       return new Date(y, m - 1, d, hh, mm);
    };

    const isIntervalBreak = !editingEntry && (entryType as any) === 'break-interval';
    const isIntervalOthers = !editingEntry && (entryType as any) === 'others-interval';

    let error = null;

    if (isIntervalBreak || isIntervalOthers) {
       // INTERVAL SAVE (2 records)
       // ... (Lógica de añadir nuevo intervalo no cambia constraints de edición simple)
       // ... (Lógica de añadir nuevo intervalo no cambia constraints de edición simple)
       if (!formTimeEnd) {
          setErrorMessage("Debes indicar hora de inicio y fin");
          setErrorModalOpen(true);
          return;
       }
       const startAt = makeDate(formDate, formTime);
       const endAt = makeDate(formDate, formTimeEnd);

       if (endAt <= startAt) {
          setErrorMessage("La hora de fin debe ser posterior al inicio");
          setErrorModalOpen(true);
          return;
       }

       // --- INTERVAL CONSISTENCY CHECK ---
       // 1. Validate Start: Must imply leaving a WORKING state.
       // So PREVIOUS record to startAt must be 'working'.
       const { data: prevToStart } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user.id)
          .lt('occurred_at', startAt.toISOString())
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle();

       const isWorkingState = (type: string) => 
          ['clock-in', 'break-end', 'others-in'].includes(type);

       // Rule: Can only Start Break/Permission if currently Working
       if (!prevToStart || !isWorkingState(prevToStart.entry_type)) {
           // Allow edge case? No, user wants strict.
           // If no prev entry -> You are not working.
           setErrorMessage("No puedes añadir un Descanso/Permiso si no consta que estés trabajando (falta una Entrada previa).");
           setErrorModalOpen(true);
           return;
       }

       // 2. Validate End: Must imply returning to WORKING state.
       // So NEXT record after endAt must NOT be 'working' (avoid double entry).
       const { data: nextToEnd } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user.id)
          .gt('occurred_at', endAt.toISOString())
          .order('occurred_at', { ascending: true })
          .limit(1)
          .maybeSingle();

       if (nextToEnd) {
           if (isWorkingState(nextToEnd.entry_type)) {
               setErrorMessage("No puedes finalizar el Descanso/Permiso porque el siguiente registro ya es una Entrada/Vuelta.");
               setErrorModalOpen(true);
               return;
           }
       }
       // ----------------------------------

       const typeStart = isIntervalBreak ? 'break-start' : 'others-out';
       const typeEnd = isIntervalBreak ? 'break-end' : 'others-in';
       
       const desc = isIntervalOthers ? context : typeMeta(typeStart).label;

       // 1. Insert Start
       const { error: err1 } = await supabase.from('time_entries').insert({
          user_id: user.id,
          entry_type: typeStart,
          description: desc,
          occurred_at: startAt.toISOString(),
          date: formDate,
          entry_time: formTime,
          minutes: 0,
          company_id: activeCompanyId,
          is_manual: true,
          status: 'pending'
       });
       if (err1) error = err1;
       else {
          // 2. Insert End
          const { error: err2 } = await supabase.from('time_entries').insert({
            user_id: user.id,
            entry_type: typeEnd,
            description: isIntervalOthers ? "Fin Permiso" : typeMeta(typeEnd).label, // Usually end has generic desc
            occurred_at: endAt.toISOString(),
            date: formDate,
            entry_time: formTimeEnd,
            minutes: 0,
            company_id: activeCompanyId,
            is_manual: true,
            status: 'pending'
         });
         error = err2;
       }

    } else {
      // SINGLE SAVE (Insert or Update)
      const occurredAt = makeDate(formDate, formTime);
      
      // VALIDAR Constraints si estamos editando
      if (editingEntry && editConstraints) {
         if (editConstraints.minTime && occurredAt < editConstraints.minTime) {
            const minStrFull = editConstraints.minTime.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
            setErrorMessage(`La fecha/hora no puede ser anterior al registro previo (${minStrFull})`);
            setErrorModalOpen(true);
            return;
         }
         if (editConstraints.maxTime && occurredAt > editConstraints.maxTime) {
            const maxStrFull = editConstraints.maxTime.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
            setErrorMessage(`La fecha/hora no puede ser posterior al registro siguiente (${maxStrFull})`);
            setErrorModalOpen(true);
            return;
         }
      }

      
      // LOGICAL CONSISTENCY CHECK (Only for new manual entries)
      if (!editingEntry) {
         // 1. Fetch Previous Entry
         const { data: prevEntry } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .lt('occurred_at', occurredAt.toISOString())
            .order('occurred_at', { ascending: false })
            .limit(1)
            .maybeSingle();

         // 2. Fetch Next Entry
         const { data: nextEntry } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', user.id)
            .gt('occurred_at', occurredAt.toISOString())
            .order('occurred_at', { ascending: true })
            .limit(1)
            .maybeSingle();

         const isWorkingState = (type: string) => 
            ['clock-in', 'break-end', 'others-in'].includes(type);

         const newIsWorking = isWorkingState(entryType);

         // Validate Previous
         if (prevEntry) {
            const prevWorking = isWorkingState(prevEntry.entry_type);
            if (prevWorking === newIsWorking) {
               setErrorMessage(newIsWorking 
                  ? "No puedes registrar una Entrada si ya estás trabajando (registro anterior)." 
                  : "No puedes registrar una Salida/Pausa si ya estás fuera/pausado (registro anterior).");
               setErrorModalOpen(true);
               return;
            }
         } else {
             // Edge Case: No previous entry. 
             // If trying to Clock-Out as first ever entry -> suspicious but maybe allowed?
             // Let's stick to user request: "Prevent entry before entry".
             // If I insert "Clock In" and no prev exists -> Valid.
             // If I insert "Clock Out" and no prev exists -> Invalid?
             if (!newIsWorking) {
                 // Maybe allow for importing history, or block?
                 // Let's be safe and warn.
                 // setErrorMessage("No se encuentra un registro de entrada previo.");
                 // setErrorModalOpen(true);
                 // return;
                 // (Commented out to be permissible for first records)
             }
         }

         // Validate Next
         if (nextEntry) {
            const nextWorking = isWorkingState(nextEntry.entry_type);
            if (nextWorking === newIsWorking) {
                setErrorMessage(newIsWorking 
                  ? "No puedes registrar una Entrada si el siguiente registro ya es una Entrada." 
                  : "No puedes registrar una Salida/Pausa si el siguiente registro ya es Salida/Pausa.");
               setErrorModalOpen(true);
               return;
            }
         }
      }

      const payload: any = {
        user_id: user.id,
        entry_type: entryType,
        description: (entryType === 'others-in' || entryType === 'others-out') ? context : (typeMeta(entryType).label),
        occurred_at: occurredAt.toISOString(),
        date: formDate, // Legacy/Redundant
        entry_time: formTime, // Legacy
        minutes: 0,
        is_manual: true,
        status: 'pending'
      };

      if (!editingEntry) {
        payload.company_id = activeCompanyId;
      }

      if (editingEntry) {
        // Update
        const { error: err } = await supabase
          .from('time_entries')
          .update(payload)
          .eq('id', editingEntry.id);
        error = err;
      } else {
        // Insert
        const { error: err } = await supabase
          .from('time_entries')
          .insert(payload);
        error = err;
      }
    }

    if (error) {
      console.error(error);
      setErrorMessage("Error al guardar");
      setErrorModalOpen(true);
    } else {
      setShowModal(false);
      setContext('');
      setEditingEntry(null);
      handleRefresh();
    }
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const daysOfWeek = ["L", "M", "X", "J", "V", "S", "D"];

  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, currentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true });
    }
    return days;
  }, [currentDate]);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === currentDate.getMonth() && 
           today.getFullYear() === currentDate.getFullYear();
  };

  const isSelected = (day: number) => {
    return selectedDate.getDate() === day && 
           selectedDate.getMonth() === currentDate.getMonth() && 
           selectedDate.getFullYear() === currentDate.getFullYear();
  };

  const dailyDistribution = useMemo(() => {
    // 1. Sort ascending
    const sorted = [...historyEntries].sort((a, b) => {
      const da = a.occurred_at ? new Date(a.occurred_at) : new Date(a.created_at);
      const db = b.occurred_at ? new Date(b.occurred_at) : new Date(b.created_at);
      return da.getTime() - db.getTime();
    });

    let w = 0, b = 0, o = 0;
    
    // We want to calculate intervals.
    // Start of calculation: 00:00 of selectedDate
    let lastTime = new Date(selectedDate);
    lastTime.setHours(0,0,0,0);
    
    let lastState = 'out'; // Assumed start state

    const mapTypeToState = (t: string) => {
      t = (t || '').toLowerCase();
      if (t === 'clock-in') return 'working';
      if (t === 'break-start') return 'break';
      if (t === 'break-end') return 'working';
      if (t === 'others-out') return 'others';
      if (t === 'others-in') return 'working';
      if (t === 'clock-out') return 'out';
      return 'out';
    };

    // Calculate duration for each interval (ignoring pending entries)
    sorted.filter(e => e.status !== 'pending').forEach(e => {
        const time = e.occurred_at ? new Date(e.occurred_at) : new Date(e.created_at);
        // Clamp time to selectedDate (just in case)
        
        const diffMins = (time.getTime() - lastTime.getTime()) / 1000 / 60;
        if (diffMins > 0) {
           if (lastState === 'working') w += diffMins;
           else if (lastState === 'break') b += diffMins;
           else if (lastState === 'others') o += diffMins;
        }
        
        lastTime = time;
        lastState = mapTypeToState(e.entry_type);
    });

    // Final interval: from last event to Now (if today) or 23:59:59 (if past)
    const isSelToday = 
      selectedDate.getDate() === new Date().getDate() &&
      selectedDate.getMonth() === new Date().getMonth() &&
      selectedDate.getFullYear() === new Date().getFullYear();

    let endTime = new Date(selectedDate);
    if (isSelToday) {
       endTime = new Date(); // now
    } else {
       endTime.setHours(23, 59, 59, 999);
    }

    if (lastTime < endTime) {
       const diff = (endTime.getTime() - lastTime.getTime()) / 1000 / 60;
       if (diff > 0) {
           if (lastState === 'working') w += diff;
           else if (lastState === 'break') b += diff;
           else if (lastState === 'others') o += diff;
       }
    }

    const totalDay = 1440; // 24h * 60m
    const trackedStats = w + b + o;
    // Free is whatever is left of the day (including "out" time)
    // For "Today", should we count future time as free? 
    // Usually "Libre" implies "Not Working/Break/Others" in the 24h cycle?
    // Or just "Time passed while Out"?
    // The previous mockup had "Libre" + others summing to ~12h? 
    // Let's assume Libre = 24h - (Work+Break+Permission).
    const f = Math.max(0, totalDay - trackedStats);

    const p = (val: number) => Math.round((val / totalDay) * 100);

    return [
      { label: 'Trabajando', hours: minutesToLabel(w), value: p(w), color: '#135bec' },
      { label: 'Descansando', hours: minutesToLabel(b), value: p(b), color: '#f59e0b' },
      { label: 'Permiso', hours: minutesToLabel(o), value: p(o), color: '#ec4899' },
      { label: 'Libre', hours: minutesToLabel(f), value: p(f), color: '#475569' },
    ];
  }, [historyEntries, selectedDate]);

  const renderMiniDonut = () => {
    let cumulativePercent = 0;
    const size = 80;
    const center = size / 2;
    const radius = 30;
    const strokeWidth = 10;

    // Caso especial: 100% de CUALQUIER concepto (Libre, Trabajando, etc.)
    const fullItem = dailyDistribution.find(d => d.value >= 99); // Margen por redondeo

    if (fullItem) {
       return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 drop-shadow-sm shrink-0">
           <circle
             cx={center}
             cy={center}
             r={radius}
             fill="none"
             stroke={fullItem.color}
             strokeWidth={strokeWidth}
           />
        </svg>
       );
    }

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 drop-shadow-sm shrink-0">
        {dailyDistribution.map((item, index) => {
          const startPercent = cumulativePercent;
          const endPercent = cumulativePercent + item.value;
          cumulativePercent = endPercent;

          // Evitar dibujar segmentos vacíos
          if (item.value <= 0) return null;

          const startAngle = (startPercent / 100) * 2 * Math.PI;
          const endAngle = (endPercent / 100) * 2 * Math.PI;
          
          const x1 = center + radius * Math.cos(startAngle);
          const y1 = center + radius * Math.sin(startAngle);
          const x2 = center + radius * Math.cos(endAngle);
          const y2 = center + radius * Math.sin(endAngle);
          
          const largeArcFlag = item.value > 50 ? 1 : 0;
          
          const pathData = [`M ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`].join(' ');
          return (
            <path
              key={index}
              d={pathData}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    );
  };

  const [isEditingHistory, setIsEditingHistory] = useState(false);



  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-xl bg-background-light dark:bg-background-dark pb-32">
      <div className="fixed top-0 left-0 right-0 z-20 bg-background-light dark:bg-background-dark" style={{ height: 'env(safe-area-inset-top)' }} />
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/dashboard')} className="text-gray-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-none bg-transparent cursor-pointer">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div className="flex items-center gap-3">
            <img 
              src={user.user_metadata?.avatar_url || DEFAULT_AVATAR}
              alt="Perfil"
              onClick={() => navigate('/profile')} 
              className="rounded-full size-10 shadow-sm border-2 border-primary/20 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all object-cover" 
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-6">
        {/* Calendar Controller */}
        <div className="flex items-center justify-between px-2 bg-white dark:bg-surface-dark py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800/50">
          <button onClick={prevMonth} className="p-1 rounded-lg text-gray-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-none bg-transparent cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-gray-900 dark:text-white font-bold text-base tracking-tight flex items-center gap-2">
              {monthNames[currentDate.getMonth()]}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
              {currentDate.getFullYear()}
            </span>
          </div>
          <button onClick={nextMonth} className="p-1 rounded-lg text-gray-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-none bg-transparent cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-surface-dark rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/50 overflow-hidden flex flex-col">
          {teamMembers.length > 0 && (
            <button
              onClick={() => setIsTeamMode(!isTeamMode)}
              className={`w-full py-1.5 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-none cursor-pointer ${
                isTeamMode 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">groups</span>
              Modo Equipo
            </button>
          )}
          <div className="p-5 pt-4">
            <div className="grid grid-cols-7 gap-1 mb-4">
            {daysOfWeek.map((day, idx) => (
              <div key={idx} className="h-8 flex items-center justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{day}</span>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {calendarData.map((item, idx) => {
              if (!item.day) return <div key={idx} className="aspect-square"></div>;

              const activeToday = isToday(item.day);
              const activeSelected = isSelected(item.day);
              const dayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
              const dayShift = monthShifts[dayKey];
              const dayHoliday = monthHolidays[dayKey];
              const shiftStyle = dayShift ? getShiftStyle(dayShift.color) : null;

              const currentDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), item.day).getDay();
              const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
              const isNormallyClosed = companySchedule && companySchedule[dayKeys[currentDayOfWeek]] && !companySchedule[dayKeys[currentDayOfWeek]].active;
              
              let isClosed = isNormallyClosed;
              if (dayHoliday) {
                isClosed = false; // Cualquier festivo/fecha especial se mostrará al 100% de opacidad
              }

              const hasTeamShift = teamShifts[dayKey] && teamShifts[dayKey].length > 0;

              let cellClassName = 'relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all border-none cursor-pointer ';
              if (activeSelected) cellClassName += 'ring-1 ring-slate-400 dark:ring-white scale-105 z-10 ';
              
              if (isTeamMode) {
                cellClassName += 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 ';
                if (isClosed && !hasTeamShift) cellClassName += 'opacity-40 hover:opacity-100 ';
              } else {
                cellClassName += shiftStyle ? `${shiftStyle.bar} text-white ` : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 ';
                if (isClosed && !shiftStyle) cellClassName += 'opacity-40 hover:opacity-100 ';
              }

              let textClassName = 'transition-all ';
              if (activeToday) textClassName += 'text-lg font-black text-white';
              else if (activeSelected) textClassName += 'text-sm font-black text-slate-900 dark:text-white';
              else if (dayHoliday) textClassName += `text-sm font-black ${dayHoliday.color}`;
              else textClassName += 'text-sm font-light text-slate-700 dark:text-slate-200';

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), item.day!))}
                  className={cellClassName}
                >
                  <span className={textClassName}>
                    {item.day}
                  </span>
                  {isTeamMode && hasTeamShift && (
                    <div className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
          </div>
        </div>

        {/* Selected Day Details Section */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Detalle: {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
          </h3>

          {isTeamMode ? (
            <div className="mt-2 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
                Turnos del Equipo
              </h4>
              {teamMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
                  <span className="material-symbols-outlined text-4xl mb-2">groups</span>
                  <p className="text-sm font-medium">No perteneces a ningún equipo o eres el único miembro</p>
                </div>
              ) : !teamShifts[isoDate(selectedDate)] || teamShifts[isoDate(selectedDate)].length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
                  <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
                  <p className="text-sm font-medium">Ningún compañero tiene turno este día</p>
                </div>
              ) : (
                <>
                  {teamShifts[isoDate(selectedDate)].map((shift, idx) => {
                    const member = teamMembers.find(m => m.user_id === shift.employee_id);
                    if (!member) return null;
                    const startTimeStr = shift.start_time ? shift.start_time.substring(0, 5) : '--:--';
                    const endTimeStr = shift.end_time ? shift.end_time.substring(0, 5) : '--:--';
                    const s = getShiftStyle(shift.color);
                    
                    return (
                      <div key={idx} className={`relative overflow-hidden rounded-2xl border ${s.card} flex items-center p-3 gap-3`}>
                         <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
                         <div className="size-10 rounded-full overflow-hidden shrink-0 border border-white/10 ml-1">
                           {member.profiles?.avatar ? (
                             <img src={member.profiles.avatar} alt={member.profiles.full_name} className="w-full h-full object-cover" />
                           ) : (
                             <div className={`w-full h-full flex items-center justify-center font-bold text-sm ${s.iconBg} ${s.iconText}`}>
                               {member.profiles?.full_name?.charAt(0).toUpperCase()}
                             </div>
                           )}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className={`font-bold text-sm truncate ${s.title}`}>{member.profiles?.full_name}</p>
                           <p className={`text-xs font-medium ${s.notes}`}>{shift.shift_type || 'Turno'}</p>
                         </div>
                         <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{startTimeStr} - {endTimeStr}</p>
                         </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : (
            <>
              {/* Tab Switch */}
              <div className="flex bg-slate-100 dark:bg-slate-950/60 rounded-xl p-1 gap-1 border border-slate-200 dark:border-slate-800/80">
            <button
              onClick={() => setActiveTab('shifts')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border-none cursor-pointer ${
                activeTab === 'shifts'
                  ? 'bg-white dark:bg-[#2a364f] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Programación
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all border-none cursor-pointer ${
                activeTab === 'activity'
                  ? 'bg-white dark:bg-[#2a364f] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              Registros
            </button>
          </div>

          {/* Turnos Planificados Tab */}
          {activeTab === 'shifts' && (
            <div className="space-y-3">
              {loadingShifts ? (
                <div className="flex justify-center py-10">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 animate-spin">progress_activity</span>
                </div>
              ) : plannedShifts.length === 0 && !monthHolidays[isoDate(selectedDate)] ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
                  <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
                  <p className="text-sm font-medium">No hay turnos planificados este día</p>
                </div>
              ) : (
                <>
                  {monthHolidays[isoDate(selectedDate)] && (
                    <div className={`relative overflow-hidden rounded-2xl border ${monthHolidays[isoDate(selectedDate)].bgClass}`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${monthHolidays[isoDate(selectedDate)].barClass}`} />
                      <div className="flex items-center gap-3 px-4 py-4">
                        <div className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${monthHolidays[isoDate(selectedDate)].iconClass}`}>
                          <span className="material-symbols-outlined text-[18px]">celebration</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{monthHolidays[isoDate(selectedDate)].name || 'Día Festivo'}</p>
                          <p className={`text-xs mt-0.5 font-medium ${monthHolidays[isoDate(selectedDate)].color}`}>{monthHolidays[isoDate(selectedDate)].context}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {plannedShifts.map((shift, idx) => {
                  const startTimeStr = shift.start_time ? shift.start_time.substring(0, 5) : '--:--';
                  const endTimeStr = shift.end_time ? shift.end_time.substring(0, 5) : '--:--';
                  const s = getShiftStyle(shift.color);

                  // Parsear descanso — soporta formato simple y por tramo (T1/T2)
                  const notes = shift.notes || '';
                  const t2Match = notes.match(/\(Descanso T2:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i);
                  const t1Match = notes.match(/\(Descanso T1:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i) || notes.match(/\(Descanso:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i);
                  // El break que extiende la salida es el del último tramo
                  const breakMins = t2Match ? parseInt(t2Match[1]) : (t1Match ? parseInt(t1Match[1]) : 0);
                  const breakPaid = t2Match ? t2Match[2].toLowerCase().includes('pagado') : (t1Match ? t1Match[2].toLowerCase().includes('pagado') : false);
                  const totalBreakMins = (t1Match ? parseInt(t1Match[1]) : 0) + (t2Match ? parseInt(t2Match[1]) : 0);
                  const displayNotes = notes.replace(/\(Descanso T[12]:[^)]+\)/gi, '').replace(/\(Descanso:[^)]+\)/i, '').trim() || null;

                  // Calcular horas trabajadas y hora de salida real
                  const [sH, sM] = (shift.start_time || '00:00').split(':').map(Number);
                  const [eH, eM] = (shift.end_time || '00:00').split(':').map(Number);
                  let totalMins = (eH * 60 + eM) - (sH * 60 + sM);
                  if (totalMins < 0) totalMins += 24 * 60;
                  // Si no retribuido: el empleado trabaja totalMins + sale breakMins más tarde
                  // Si retribuido: el descanso está dentro del horario, sale a end_time
                  const workedMins = totalMins;
                  const realEndMins = !breakPaid && breakMins > 0 ? eH * 60 + eM + breakMins : eH * 60 + eM;
                  const realEndStr = `${String(Math.floor(realEndMins / 60) % 24).padStart(2, '0')}:${String(realEndMins % 60).padStart(2, '0')}`;
                  const workedLabel = workedMins >= 60
                    ? `${Math.floor(workedMins / 60)}h${workedMins % 60 > 0 ? ` ${workedMins % 60}m` : ''}`
                    : `${workedMins}m`;

                  return (
                    <div key={idx} className={`relative overflow-hidden rounded-2xl border ${s.card}`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
                      {/* Cabecera */}
                      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                        <div className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                          <span className={`material-symbols-outlined text-[18px] ${s.iconText}`}>schedule</span>
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold text-sm ${s.title}`}>{startTimeStr} — {endTimeStr}</p>
                          {displayNotes && <p className={`text-xs mt-0.5 line-clamp-1 ${s.notes}`}>{displayNotes}</p>}
                        </div>
                        <span className={`text-xs font-black ${s.iconText}`}>{workedLabel}</span>
                      </div>
                      {/* Detalles */}
                      <div className={`mx-4 mb-4 grid grid-cols-3 gap-2 pt-3 border-t ${s.card.split(' ')[1]}`}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Entrada</span>
                          <span className={`text-xs font-bold ${s.title}`}>{startTimeStr}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Salida</span>
                          <span className={`text-xs font-bold ${s.title}`}>{realEndStr}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Descanso</span>
                          <span className={`text-xs font-bold ${s.title}`}>
                            {totalBreakMins > 0 ? `${totalBreakMins}m` : 'Sin descanso'}
                          </span>
                        </div>
                      </div>
                      {totalBreakMins > 0 && (
                        <div className="mx-4 mb-3 flex items-center gap-1.5">
                          <span className={`material-symbols-outlined text-[13px] ${breakPaid ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
                            {breakPaid ? 'check_circle' : 'info'}
                          </span>
                          <span className={`text-[10px] ${breakPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            Descanso {breakPaid ? 'retribuido' : 'no retribuido'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                </>
              )}
            </div>
          )}

          {/* Actividad Tab */}
          {activeTab === 'activity' && (
          <>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Registros de Actividad</h4>
              <button
                onClick={() => setIsEditingHistory(!isEditingHistory)}
                className={`text-xs font-bold transition-colors cursor-pointer border-none bg-transparent ${isEditingHistory ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {isEditingHistory ? 'Terminar' : 'Editar'}
              </button>
            </div>


            {historyEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
                <span className="material-symbols-outlined text-4xl mb-2">history_toggle_off</span>
                <p className="text-sm font-medium">No hay actividad este día</p>
              </div>
            ) : (
              historyEntries.map((e, idx) => {
                const meta = typeMeta(e.entry_type);
                const c = colorClasses(meta.color);
                
                const occurred = e.occurred_at ? new Date(e.occurred_at) : new Date(e.created_at);
                const timeCell = occurred.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                // Duración
                let durationLabel = null;
                const type = (e.entry_type ?? "").toLowerCase();
                
                 if (
                  type === "clock-in" ||
                  type === "break-start" ||
                  type === "clock-out" ||
                  type === "others-out" ||
                  type === "break-end" ||
                  type === "others-in"
                ) {
                  const msCurrent = occurred.getTime();
                  const parsedNext = idx > 0 ? historyEntries[idx - 1] : null;
                  let msNext = new Date().getTime(); // Default to now if latest
                  
                  // Si no es hoy, y es el último registro, quizás deberíamos cerrar el día o no mostrar tiempo?
                  // Por simplicidad, si es el último del día mostrado (el más reciente) y es el día actual, usamos "ahora".
                  // Si es un día pasado, usamos fin del día o siguiente entrada.
                  // Simplificación: Usamos logica dashboard
                  
                  if (parsedNext) {
                     msNext = parsedNext.occurred_at
                      ? new Date(parsedNext.occurred_at).getTime()
                      : new Date(parsedNext.created_at).getTime();
                  } else if (!isToday(selectedDate.getDate())) {
                      // Si es el ultimo registro de un dia PASADO, no calculamos duración "hasta ahora"
                      // Podríamos setearlo a null o fin de jornada. Lo dejamos null para no mostrar info errónea.
                      durationLabel = null; 
                  }
                  
                  if (parsedNext || isToday(selectedDate.getDate())) {
                     const diff = msNext - msCurrent;
                     if (diff > 0) {
                        durationLabel = minutesToLabel(Math.floor(diff / 1000 / 60));
                     }
                  }
                }

                // FILTRADO DE INTERVALOS ABIERTOS (User Request: "si no tengo retorno no se muestre")
                if (type === 'break-start') {
                    // Solo mostramos 'Inicio descanso' si el registro INMEDIATAMENTE ANTERIOR (más nuevo) es 'break-end' O 'clock-in'
                    const nextEntry = idx > 0 ? historyEntries[idx - 1] : null;
                    const nextType = (nextEntry?.entry_type ?? "").toLowerCase();
                    if (nextType !== 'break-end' && nextType !== 'clock-in') return null;
                }

                if (type === 'others-out') {
                    // Igual para permisos
                    const nextEntry = idx > 0 ? historyEntries[idx - 1] : null;
                    const nextType = (nextEntry?.entry_type ?? "").toLowerCase();
                    if (nextType !== 'others-in' && nextType !== 'clock-in') return null; 
                }

                // Se muestran todos los eventos (incluyendo break-end y others-in)
                // if (type === 'break-end' || type === 'others-in') return null;

                const stateTitles: Record<string, string> = {
                  "clock-in": "Trabajando",
                  "clock-out": "Salida",
                  "break-start": "Descanso",
                  "break-end": "Trabajando",
                  "others-in": "Trabajando",
                };

                const isStandard = Object.keys(stateTitles).includes(type);
                let displayLabel = isStandard ? stateTitles[type] : e.description ?? meta.label;
                 if (type === "others-out") {
                   const rawDesc = e.description || "";
                   displayLabel = rawDesc.replace(/^Permiso:\s*/i, "").replace(/^Salida:\s*/i, "") || "Permiso";
                }

                return (
                  <div 
                    key={e.id} 
                    className={`flex items-center gap-4 p-3 rounded-xl border-l-4 ${c.border} bg-white dark:bg-surface-dark shadow-sm group animate-fadeInUp`}
                    style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}
                  >
                    <div className={`size-10 rounded-full ${c.iconBg} flex items-center justify-center shrink-0`}>
                      <span className={`material-symbols-outlined text-xl ${c.iconText}`}>{meta.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{displayLabel}</p>
                        {e.companies?.name && (
                          <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded-md leading-none">
                            {e.companies.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{timeCell} • {meta.label}</p>
                        {e.status === 'pending' && (
                          <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md border border-amber-500/20 leading-none flex items-center gap-0.5">
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       {durationLabel && (
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md transition-all">
                           {durationLabel}
                          </span>
                       )}
                      
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isEditingHistory ? 'w-8 opacity-100 ml-1' : 'w-0 opacity-0 ml-0'}`}>
                        {e.id === latestGlobalId ? (
                          <button 
                            onClick={() => handleDelete(e.id)}
                            className="size-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer border-none shrink-0" 
                            title="Eliminar último registro"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => openEditModal(e)}
                            className="size-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer border-none shrink-0" 
                            title="Editar registro"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          </>
          )}

            </>
          )}

          {/* Distribución del Tiempo — siempre visible */}
          <div className="bg-white dark:bg-surface-dark rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/50">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Distribución del Tiempo</h4>
            <div className="flex items-center gap-6">
              {renderMiniDonut()}
              <div className="flex flex-col gap-2.5 flex-1">
                {dailyDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.hours}</span>
                      <span className="text-[9px] font-light text-slate-400 dark:text-slate-500">{item.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#151b26] border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-[45]">
        <div className="relative flex justify-around items-center h-16 max-w-md mx-auto">
          {/* Left: Home */}
          <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center justify-center w-full h-full gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[26px]">home</span>
            <span className="text-[10px] font-medium">Inicio</span>
          </button>
          
          {/* Center: Add (Floating/Protruding Circle) */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2">
            <button 
              onClick={openAddModal} 
              className="size-16 rounded-full bg-primary text-white shadow-xl shadow-primary/30 flex items-center justify-center border-4 border-background-light dark:border-background-dark active:scale-90 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-4xl">add</span>
            </button>
          </div>


          {/* Right: History */}
          <button className="flex flex-col items-center justify-center w-full h-full gap-1 text-primary">
            <span className="material-symbols-outlined text-[26px]">calendar_month</span>
            <span className="text-[10px] font-bold">Calendario</span>
          </button>
        </div>
      </nav>

      {/* Modal Borrado UI */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 visible opacity-100">
          <div onClick={() => setDeleteModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"></div>
          <div className="relative bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom duration-300 border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-500">
                <span className="material-symbols-outlined text-2xl">delete</span>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar registro?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                   Esta acción no se puede deshacer.
                   {entryToDelete?.message && (
                     <span className="block mt-2 font-medium text-amber-600 dark:text-amber-500 text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                       {entryToDelete.message}
                     </span>
                   )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full mt-2">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="py-3 px-4 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all active:scale-95 border-none cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Error UI (Validation) */}
      {errorModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 visible opacity-100">
           <div onClick={() => setErrorModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"></div>
          <div className="relative bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom duration-300 border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="size-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Atención</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 pb-2">
                   {errorMessage}
                </p>
              </div>

              <div className="w-full mt-2">
                <button
                  onClick={() => setErrorModalOpen(false)}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-95 border-none cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      <div className={`fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 ${showModal ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div onClick={() => { setShowModal(false); setContext(''); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className={`relative w-full max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out ${showModal ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingEntry ? 'Editar Registro' : 'Añadir Registro Manual'}
            </h3>
            <button onClick={() => { setShowModal(false); setContext(''); setEditingEntry(null); }} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 border-none bg-transparent cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <form className="p-5 space-y-4 no-scrollbar max-h-[85vh] overflow-y-auto" onSubmit={handleSave}>
            
            {/* TIMELINE VISUAL GUIDE */}
            {editingEntry && editConstraints && (editConstraints.minTime || editConstraints.maxTime) && (
               <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">info</span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rango de tiempo permitido</span>
                  </div>
                  
                  {(() => {
                      // Determine theme color based on entry type
                      let themeClass = 'bg-primary border-primary text-primary';
                      let themeRing = 'ring-primary/20';
                      // type casting for check
                      const t = entryType as any;
                      if (t === 'break-start' || t === 'break-end' || t === 'break-interval') {
                          themeClass = 'bg-amber-500 border-amber-500 text-amber-500';
                          themeRing = 'ring-amber-500/20';
                      } else if (t === 'others-in' || t === 'others-out' || t === 'others-interval') {
                          themeClass = 'bg-pink-500 border-pink-500 text-pink-500';
                          themeRing = 'ring-pink-500/20';
                      } else if (t === 'clock-out') {
                          themeClass = 'bg-slate-600 border-slate-600 text-slate-600';
                          themeRing = 'ring-slate-600/20';
                      }

                      const getIcon = (type: string | null) => {
                          if (!type) return 'schedule';
                          if (type.includes('break')) return 'coffee';
                          if (type.includes('others')) return 'edit_note';
                          if (type === 'clock-out') return 'logout';
                          return 'login';
                      };
                      
                      const getThemeColors = (type: string | null) => {
                           // Returns [Text Color, Border Color] full classes
                           if (!type) return ['text-slate-400', 'border-slate-300 dark:border-slate-700'];
                           if (type.includes('break')) return ['text-amber-500', 'border-amber-500'];
                           if (type.includes('others')) return ['text-pink-500', 'border-pink-500'];
                           if (type === 'clock-out') return ['text-slate-500', 'border-slate-500'];
                           return ['text-primary', 'border-primary'];
                      }

                      return (

                        <div className="flex flex-col gap-2">
                             {/* ROW 1: ICONS & LINE */}
                             <div className="relative flex items-center justify-between px-2 py-2">
                                {/* Line connector - Authentically centered */}
                                <div className={`absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 z-0 rounded-full opacity-30 ${themeClass.replace('text-', 'bg-').split(' ')[0]}`}></div>
                                
                                {/* Min Node (Left) */}
                                <div className="relative z-10 flex flex-col items-center">
                                    {(() => {
                                    const [txt, brd] = getThemeColors(editConstraints.minType);
                                    return (
                                        <div className={`size-8 rounded-full border-2 bg-white dark:bg-[#1C1C1E] flex items-center justify-center shadow-sm ${editConstraints.minTime ? brd : 'border-slate-100 dark:border-slate-800 opacity-50'}`}>
                                            <span className={`material-symbols-outlined text-[16px] ${txt}`}>
                                                {getIcon(editConstraints.minType)}
                                            </span>
                                        </div>
                                    );
                                    })()}
                                </div>

                                {/* Current Indicator (Center) */}
                                <div className={`relative z-10 flex flex-col items-center justify-center size-10 rounded-full text-white shadow-md ${themeClass.split(' ')[0]} ring-4 ${themeRing} ring-offset-2 ring-offset-white dark:ring-offset-[#1C1C1E] transition-all transform hover:scale-105`}>
                                    <span className="material-symbols-outlined text-[20px]">
                                        {getIcon(t)}
                                    </span>
                                </div>

                                {/* Max Node (Right) */}
                                <div className="relative z-10 flex flex-col items-center">
                                    {(() => {
                                    const [txt, brd] = getThemeColors(editConstraints.maxType);
                                    return (
                                        <div className={`size-8 rounded-full border-2 bg-white dark:bg-[#1C1C1E] flex items-center justify-center shadow-sm ${editConstraints.maxTime ? brd : 'border-slate-100 dark:border-slate-800 opacity-50'}`}>
                                            <span className={`material-symbols-outlined text-[16px] ${txt}`}>
                                                {getIcon(editConstraints.maxType)}
                                            </span>
                                        </div>
                                    );
                                    })()}
                                </div>
                             </div>

                             {/* ROW 2: DATES */}
                             <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-md">
                                   {editConstraints.minTime 
                                      ? editConstraints.minTime.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })
                                      : 'Inicio'}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-md">
                                   {editConstraints.maxTime 
                                      ? editConstraints.maxTime.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' }) 
                                      : 'Fin'}
                                </span>
                             </div>
                        </div>
                      );
                  })()}
               </div>
            )}

            <div className="space-y-3">
              {!editingEntry && (
                 <>
                   <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo de Registro</label>
                   <div className="grid grid-cols-2 gap-3">
                     {/* ENTRADA */}
                     <button 
                       type="button" 
                       onClick={() => setEntryType('clock-in')} 
                       className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${
                         entryType === 'clock-in' 
                           ? 'bg-primary text-white border-primary shadow-md opacity-100 ring-2 ring-primary/20' 
                           : 'bg-primary text-white/70 border-gray-200 dark:border-gray-700 opacity-40 hover:opacity-70'
                       }`}
                     >
                       <span className="material-symbols-outlined text-[18px]">login</span> Entrada
                     </button>
     
                     {/* SALIDA */}
                     <button 
                       type="button" 
                       onClick={() => setEntryType('clock-out')} 
                       className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${
                         entryType === 'clock-out' 
                           ? 'bg-slate-600 text-white border-slate-600 shadow-md opacity-100 ring-2 ring-slate-600/20' 
                           : 'bg-slate-600 text-white/70 border-gray-200 dark:border-gray-700 opacity-40 hover:opacity-70'
                       }`}
                     >
                       <span className="material-symbols-outlined text-[18px]">logout</span> Salida
                     </button>
     
                     {/* DESCANSO (Toggle if editing, Interval if adding) */}
                     <button 
                       type="button" 
                       onClick={() => {
                           // ADD MODE: Just set interval type
                           setEntryType('break-interval' as any);
                       }} 
                       className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${
                         ((entryType as any) === 'break-interval')
                           ? 'bg-amber-500 text-white border-amber-500 shadow-md opacity-100 ring-2 ring-amber-500/20' 
                           : 'bg-amber-500 text-white/70 border-gray-200 dark:border-gray-700 opacity-40 hover:opacity-70'
                       }`}
                     >
                       <span className="material-symbols-outlined text-[18px]">coffee</span> 
                       Descanso
                     </button>
     
                     {/* PERMISO (Toggle if editing, Interval if adding) */}
                     <button 
                       type="button" 
                       onClick={() => {
                             // ADD MODE: Just set interval type
                             setEntryType('others-interval' as any);
                       }} 
                       className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${
                         ((entryType as any) === 'others-interval')
                           ? 'bg-pink-500 text-white border-pink-500 shadow-md opacity-100 ring-2 ring-pink-500/20' 
                           : 'bg-pink-500 text-white/70 border-gray-200 dark:border-gray-700 opacity-40 hover:opacity-70'
                       }`}
                     >
                       <span className="material-symbols-outlined text-[18px]">edit_note</span>
                       Permiso
                     </button>
                   </div>
                 </>
              )}
            </div>


            {/* Context for others */}
            {((entryType === 'others-in' || entryType === 'others-out' || (entryType as any) === 'others-interval')) && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contexto / Motivo</label>
                <input 
                  autoFocus
                  className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-pink-500 focus:border-pink-500 text-sm shadow-sm outline-none border transition-colors" 
                  type="text" 
                  placeholder="Ej: Visita médica, Diligencia..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha</label>
              <input 
                className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border" 
                type="date" 
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
              

            </div>
            
            {/* Conditional Time Inputs: Single vs Range */}
            {((entryType as any) === 'break-interval' || (entryType as any) === 'others-interval') ? (
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hora Inicio</label>
                    <input 
                      className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border" 
                      type="time" 
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hora Fin</label>
                    <input 
                      className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border" 
                      type="time" 
                      value={formTimeEnd}
                      onChange={(e) => setFormTimeEnd(e.target.value)}
                    />
                  </div>
               </div>
            ) : (
                <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hora</label>
                <input 
                  className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border" 
                  type="time" 
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                />
                

              </div>
            )}
            
            <div className="flex items-center gap-3 pt-2">
              {canDelete && editingEntry && (
                 <button 
                   onClick={() => {
                      setEntryToDelete({ id: editingEntry.id });
                      setDeleteModalOpen(true);
                   }} 
                   className="size-11 rounded-xl flex items-center justify-center text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border-none cursor-pointer" 
                   type="button"
                   title="Eliminar registro"
                 >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                 </button>
              )}
              <button onClick={() => { setShowModal(false); setContext(''); setEditingEntry(null); }} className="flex-1 py-3 px-4 rounded-xl text-center text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-none bg-transparent cursor-pointer" type="button">Cancelar</button>
              <button className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:opacity-90 border-none cursor-pointer ${
                (entryType === 'clock-out') ? 'bg-slate-600 shadow-slate-600/25' :
                (entryType === 'break-start' || entryType === 'break-end' || (entryType as any) === 'break-interval') ? 'bg-amber-500 shadow-amber-500/25' :
                (entryType === 'others-in' || entryType === 'others-out' || (entryType as any) === 'others-interval') ? 'bg-pink-500 shadow-pink-500/25' :
                'bg-primary shadow-primary/25'
              }`} type="submit">
                {editingEntry ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HistoryScreen;
