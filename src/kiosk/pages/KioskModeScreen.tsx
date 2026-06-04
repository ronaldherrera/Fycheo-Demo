import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { adjustDataToCurrentDate, adjustDateString, deAdjustISOString, deAdjustDateString } from '../../lib/date-adjuster';
import { Clock, LogOut, CheckCircle2, AlertCircle, Loader2, Fingerprint } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

const LETTERS_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F'],
  ['G', 'H', 'I', 'J', 'K', 'L'],
  ['M', 'N', 'Ñ', 'O', 'P', 'Q'],
  ['R', 'S', 'T', 'U', 'V', 'W'],
  ['X', 'Y', 'Z']
];

const isoDateLocal = (d: Date) => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - (offset * 60 * 1000));
  return local.toISOString().slice(0, 10);
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
    case "clock_in":
      return { label: "Entrada trabajo", icon: "login", color: "primary" as const };
    case "clock-out":
    case "clock_out":
      return { label: "Salida trabajo", icon: "logout", color: "slate" as const };
    case "break-start":
    case "break_start":
      return { label: "Inicio descanso", icon: "coffee", color: "amber" as const };
    case "break-end":
    case "break_end":
      return { label: "Entrada trabajo", icon: "login", color: "primary" as const };
    case "others-in":
    case "others_in":
    case "permission-end":
    case "permission_end":
      return { label: "Entrada trabajo", icon: "login", color: "primary" as const };
    case "others-out":
    case "others_out":
    case "permission-start":
    case "permission_start":
      return { label: "Permiso", icon: "edit_note", color: "pink" as const };
    default:
      return { label: "Registro", icon: "schedule", color: "primary" as const };
  }
};

const colorClasses = (c: "primary" | "slate" | "amber" | "emerald" | "pink") => {
  switch (c) {
    case "slate": return { border: "border-l-slate-500", iconBg: "bg-slate-500/10", iconText: "text-slate-500" };
    case "amber": return { border: "border-l-amber-500", iconBg: "bg-amber-500/10", iconText: "text-amber-500" };
    case "emerald": return { border: "border-l-emerald-500", iconBg: "bg-emerald-500/10", iconText: "text-emerald-500" };
    case "pink": return { border: "border-l-pink-500", iconBg: "bg-pink-500/10", iconText: "text-pink-500" };
    case "primary": default: return { border: "border-l-[#135bec]", iconBg: "bg-primary/10", iconText: "text-[#135bec]" };
  }
};

const getShiftStyle = (color: string | undefined | null) => {
  let c = color || '';
  if (c.startsWith('#')) {
    const hex = c.toLowerCase();
    if (hex.startsWith('#3b8') || hex.startsWith('#256') || hex.startsWith('#1d4') || hex.startsWith('#60a')) c = 'blue';
    else if (hex.startsWith('#10b') || hex.startsWith('#34d') || hex.startsWith('#059') || hex.startsWith('#047')) c = 'emerald';
    else if (hex.startsWith('#f59') || hex.startsWith('#fbb') || hex.startsWith('#d97') || hex.startsWith('#b45') || hex.startsWith('#f97')) c = 'orange';
    else if (hex.startsWith('#ef4') || hex.startsWith('#f87') || hex.startsWith('#dc2') || hex.startsWith('#b91')) c = 'red';
    else if (hex.startsWith('#8b5') || hex.startsWith('#a78') || hex.startsWith('#7c3') || hex.startsWith('#6d2') || hex.startsWith('#4f4') || hex.startsWith('#636')) c = 'purple';
    else if (hex.startsWith('#ec4') || hex.startsWith('#f47') || hex.startsWith('#db2') || hex.startsWith('#be1')) c = 'pink';
    else if (hex.startsWith('#06b') || hex.startsWith('#22d') || hex.startsWith('#089') || hex.startsWith('#0e7')) c = 'cyan';
    else if (hex.startsWith('#84c') || hex.startsWith('#a3e') || hex.startsWith('#65a') || hex.startsWith('#4d7')) c = 'lime';
    else if (hex.startsWith('#647') || hex.startsWith('#94a') || hex.startsWith('#475') || hex.startsWith('#334')) c = 'slate';
  }

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
  return                            { card: 'bg-blue-500/10 border-blue-500/30',        bar: 'bg-[#135bec]',   iconBg: 'bg-[#135bec]/10',   iconText: 'text-[#135bec]',    title: 'text-blue-955 dark:text-blue-100',       notes: 'text-blue-600 dark:text-blue-300' };
};

export default function KioskModeScreen() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dni, setDni] = useState(() => localStorage.getItem('kiosk_demo_dni') || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Exit PIN Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPin, setExitPin] = useState('');
  const [exitError, setExitError] = useState(false);
  
  // Modal State
  const [employee, setEmployee] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<{type: string, time: string} | null>(null);
  const [successTimeoutId, setSuccessTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Manual Entry State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEntryType, setManualEntryType] = useState<string>("clock-in");
  const [manualContextText, setManualContextText] = useState("");
  const [manualEntryDate, setManualEntryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [manualEntryTime, setManualEntryTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [manualSaving, setManualSaving] = useState(false);

  const [lastEntryType, setLastEntryType] = useState<string | null>(null);
  const [lastOverallEntry, setLastOverallEntry] = useState<any>(null);
  const [monthEntries, setMonthEntries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'hours' | 'absences'>('dashboard');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [companyInfo, setCompanyInfo] = useState<{name: string, logo_url: string | null} | null>(null);

   // Funcionalidad extra
   const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
   const [absenceType, setAbsenceType] = useState<string>('vacation');
   const [absenceStartDate, setAbsenceStartDate] = useState<string>(isoDateLocal(new Date()));
   const [absenceEndDate, setAbsenceEndDate] = useState<string>(isoDateLocal(new Date()));
   const [absenceReason, setAbsenceReason] = useState<string>('');
   const [absenceSubmitting, setAbsenceSubmitting] = useState(false);
   const [absenceSuccessMsg, setAbsenceSuccessMsg] = useState(false);
   const [absencesList, setAbsencesList] = useState<any[]>([]);
   const [loadingAbsences, setLoadingAbsences] = useState(false);
   const [absencesFilter, setAbsencesFilter] = useState<'all' | 'pending' | 'approved' | 'enjoyed' | 'rejected'>('all');
   const [logoutCountdown, setLogoutCountdown] = useState(30);

   // Estados del Calendario (Igual que en la App móvil)
   const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
   const [monthShifts, setMonthShifts] = useState<Record<string, any[]>>({});
   const [monthHolidays, setMonthHolidays] = useState<Record<string, any>>({});
   const [companySchedule, setCompanySchedule] = useState<any>(null);
   const [activeTabCalendar, setActiveTabCalendar] = useState<'shifts' | 'activity'>('shifts');
   const [teamMembers, setTeamMembers] = useState<any[]>([]);
   const [teamShifts, setTeamShifts] = useState<Record<string, any[]>>({});
   const [isTeamMode, setIsTeamMode] = useState<boolean>(false);
   const [yearlyStats, setYearlyStats] = useState<{
     monthlyPlanned: number[];
     monthlyWorked: number[];
     totalPlanned: number;
     totalWorked: number;
   } | null>(null);
   const [loadingYearly, setLoadingYearly] = useState(false);

   const loadCalendarData = async (dateForMonth: Date, userId: string) => {
     if (!companyId) return;
     try {
       const year = dateForMonth.getFullYear();
       const month = dateForMonth.getMonth();
       const firstDay = new Date(year, month, 1);
       const lastDay = new Date(year, month + 1, 0);
       
       const startDateStr = isoDateLocal(firstDay);
       const endDateStr = isoDateLocal(lastDay);

       // 1. Obtener los turnos del empleado (desajustar fechas para la BD)
       const { data: shiftsData } = await supabase
         .from('shifts')
         .select('*')
         .eq('employee_id', userId)
         .eq('is_published', true)
         .gte('date', deAdjustDateString(startDateStr))
         .lte('date', deAdjustDateString(endDateStr));

       if (shiftsData) {
         const map: Record<string, any[]> = {};
         shiftsData.forEach(s => {
           const adjustedDate = adjustDateString(s.date);
           map[adjustedDate] = [...(map[adjustedDate] || []), { ...s, date: adjustedDate }];
         });
         setMonthShifts(map);
       } else {
         setMonthShifts({});
       }

       // 2. Obtener los fichajes del mes (desajustar rango para la BD)
       const { data: entries, error: entriesError } = await supabase
         .from('time_entries')
         .select('*')
         .eq('user_id', userId)
         .gte('occurred_at', deAdjustISOString(firstDay.toISOString()))
         .lte('occurred_at', deAdjustISOString(lastDay.toISOString() + 'T23:59:59.999Z'))
         .order('occurred_at', { ascending: false });

       if (!entriesError && entries) {
         setMonthEntries(adjustDataToCurrentDate(entries));
       }

       // 3. Obtener el horario semanal de la empresa
       const { data: companyData } = await supabase
         .from('companies')
         .select('settings')
         .eq('id', companyId)
         .single();
       
       const schedule = companyData?.settings?.schedule || {};
       setCompanySchedule(schedule);

       // 4. Obtener los festivos de la empresa y aplicar la misma clasificación que en la App
       const { data: holidaysData } = await supabase
         .from('company_holidays')
         .select('date, type, name, start_time, end_time')
         .eq('company_id', companyId)
         .gte('date', startDateStr)
         .lte('date', endDateStr);

       if (holidaysData) {
         const map: Record<string, any> = {};
         holidaysData.forEach(h => {
           const d = new Date(h.date);
           const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
           const isNormallyClosed = !schedule[dayKeys[d.getDay()]]?.active;

           let color = 'text-emerald-500';
           let context = 'Abierto (Horario habitual)';
           let bgClass = 'bg-emerald-500/10 border-emerald-500/30';
           let iconClass = 'text-emerald-500 bg-emerald-500/20';
           let barClass = 'bg-emerald-500';

           if (h.type === 'closed') {
             color = 'text-red-500';
             context = 'Cerrado todo el día';
             bgClass = 'bg-red-500/10 border-red-500/30';
             iconClass = 'text-red-500 bg-red-500/20';
             barClass = 'bg-red-500';
           } else if (isNormallyClosed) {
             color = 'text-fuchsia-500';
             bgClass = 'bg-fuchsia-500/10 border-fuchsia-500/30';
             iconClass = 'text-fuchsia-500 bg-fuchsia-500/20';
             barClass = 'bg-fuchsia-500';
           } else if (h.type === 'special_hours') {
             color = 'text-orange-500';
             context = `Horario: ${h.start_time?.slice(0, 5) || ''} a ${h.end_time?.slice(0, 5) || ''}`;
             bgClass = 'bg-orange-500/10 border-orange-500/30';
             iconClass = 'text-orange-500 bg-orange-500/20';
             barClass = 'bg-orange-500';
           }

           map[h.date] = {
             ...h,
             color,
             context,
             bgClass,
             iconClass,
             barClass
           };
         });
         setMonthHolidays(map);
       } else {
         setMonthHolidays({});
       }

       // 5. Obtener los miembros del equipo y sus turnos
       const { data: memberData } = await supabase
         .from('company_members')
         .select('team_id')
         .eq('user_id', userId)
         .eq('company_id', companyId)
         .single();

       let teamIds: string[] = [];
       if (memberData?.team_id) {
         const { data: tMembers } = await supabase
           .from('company_members')
           .select('user_id, profiles!inner(full_name, avatar)')
           .eq('team_id', memberData.team_id)
           .eq('company_id', companyId);
         
         if (tMembers) {
           const others = tMembers.filter((m: any) => m.user_id !== userId);
           setTeamMembers(others);
           teamIds = others.map((m: any) => m.user_id);
         }
       } else {
         setTeamMembers([]);
       }

       if (teamIds.length > 0) {
         const { data: teamShiftsRes } = await supabase
           .from('shifts')
           .select('*')
           .in('employee_id', teamIds)
           .eq('is_published', true)
           .gte('date', deAdjustDateString(startDateStr))
           .lte('date', deAdjustDateString(endDateStr));

         if (teamShiftsRes) {
           const tsMap: Record<string, any[]> = {};
           teamShiftsRes.forEach((s: any) => {
             const adjustedDate = adjustDateString(s.date);
             if (!tsMap[adjustedDate]) tsMap[adjustedDate] = [];
             tsMap[adjustedDate].push({ ...s, date: adjustedDate });
           });
           setTeamShifts(tsMap);
         } else {
           setTeamShifts({});
         }
       } else {
         setTeamShifts({});
       }

     } catch (err) {
       console.error("Error al cargar la programación del calendario:", err);
     }
   };

   const loadYearlyData = async (userId: string) => {
     const year = new Date().getFullYear();
     const startOfYear = `${year}-01-01`;
     const endOfYear   = `${year}-12-31`;
     setLoadingYearly(true);
     try {
       const [shiftsRes, entriesRes] = await Promise.all([
         supabase
           .from('shifts')
           .select('date, start_time, end_time')
           .eq('employee_id', userId)
           .eq('is_published', true)
           .gte('date', deAdjustDateString(startOfYear))
           .lte('date', deAdjustDateString(endOfYear)),
         supabase
           .from('time_entries')
           .select('entry_type, occurred_at')
           .eq('user_id', userId)
           .gte('occurred_at', deAdjustISOString(`${startOfYear}T00:00:00.000Z`))
           .lte('occurred_at', deAdjustISOString(`${endOfYear}T23:59:59.999Z`))
           .order('occurred_at', { ascending: true }),
       ]);

       const monthlyPlanned: number[] = new Array(12).fill(0);
       if (shiftsRes.data) {
         shiftsRes.data.forEach(s => {
           if (!s.start_time || !s.end_time) return;
           const m = new Date(adjustDateString(s.date) + 'T00:00:00').getMonth();
           const [sH, sM] = s.start_time.split(':').map(Number);
           const [eH, eM] = s.end_time.split(':').map(Number);
           let mins = (eH * 60 + eM) - (sH * 60 + sM);
           if (mins < 0) mins += 24 * 60;
           monthlyPlanned[m] += mins / 60;
         });
       }

       const adjustedEntries = adjustDataToCurrentDate(entriesRes.data || []);
       const monthlyWorked: number[] = new Array(12).fill(0);
       if (adjustedEntries.length) {
         let inTime: number | null = null;
         let inMonth: number | null = null;
         for (const e of adjustedEntries) {
           const ts = new Date(e.occurred_at).getTime();
           const mo = new Date(e.occurred_at).getMonth();
           const t  = e.entry_type;
           if (t === 'clock_in' || t === 'clock-in' || t === 'break-end' || t === 'break_end' || t === 'permission-end' || t === 'permission_end') {
             inTime = ts; inMonth = mo;
           } else if (t === 'clock_out' || t === 'clock-out' || t === 'break-start' || t === 'break_start' || t === 'permission-start' || t === 'permission_start') {
             if (inTime !== null && inMonth !== null) {
               monthlyWorked[inMonth] += (ts - inTime) / 3600000;
               inTime = null;
             }
           }
         }
         if (inTime !== null && inMonth !== null) {
           monthlyWorked[inMonth] += (Date.now() - inTime) / 3600000;
         }
       }

       setYearlyStats({
         monthlyPlanned,
         monthlyWorked,
         totalPlanned: monthlyPlanned.reduce((a, b) => a + b, 0),
         totalWorked:  monthlyWorked.reduce((a, b) => a + b, 0),
       });
     } catch (err) {
       console.error('Error al cargar datos anuales:', err);
     } finally {
       setLoadingYearly(false);
     }
   };

   // Effect para cargar datos de turnos/festivos cuando cambia el mes o el empleado
   useEffect(() => {
     if (employee) {
       loadCalendarData(currentDate, employee.userId);
     }
   }, [currentDate, employee]);

   useEffect(() => {
     if (employee) {
       loadYearlyData(employee.userId);
       loadAbsences(employee.userId);
     }
   }, [employee]);

   const loadAbsences = async (userId: string) => {
     setLoadingAbsences(true);
     try {
       const { data } = await supabase
         .from('absences')
         .select('id, type, start_date, end_date, status, created_at')
         .eq('employee_id', userId)
         .order('start_date', { ascending: false });
       if (data) setAbsencesList(data);
     } finally {
       setLoadingAbsences(false);
     }
   };

  useEffect(() => {
    if (companyId) {
      const fetchCompany = async () => {
        const { data } = await supabase
          .from('companies')
          .select('name, logo_url')
          .eq('id', companyId)
          .single();
        if (data) {
          setCompanyInfo(data);
        }
      };
      fetchCompany();
    }
  }, [companyId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-logout por inactividad (30s)
  useEffect(() => {
    // DESACTIVADO TEMPORALMENTE
    return;
    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;

    const resetTimer = () => {
      if (employee && !successMessage) {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        setLogoutCountdown(30);
        
        intervalId = setInterval(() => {
          setLogoutCountdown(prev => {
            if (prev <= 1) {
              clearInterval(intervalId);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        timeoutId = setTimeout(() => {
          setEmployee(null);
          setDni('');
          setMonthEntries([]);
          setActiveTab('dashboard');
        }, 30000); // 30 seconds
      }
    };

    if (employee && !successMessage) {
      resetTimer();
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('mousedown', resetTimer);
      window.addEventListener('keypress', resetTimer);
      window.addEventListener('touchstart', resetTimer);
    }

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [employee, successMessage]);

  // Timer para "Tiempo en este estado"
  useEffect(() => {
    if (!employee || !lastOverallEntry) {
      setElapsedTime(0);
      return;
    }

    const startTimestamp = new Date(lastOverallEntry.occurred_at).getTime();
    
    const updateTimer = () => {
      const now = new Date().getTime();
      setElapsedTime(Math.max(0, Math.floor((now - startTimestamp) / 1000)));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [employee, lastOverallEntry]);

  const calculateTotalHours = () => {
    if (!monthEntries || monthEntries.length === 0) return 0;
    let totalSeconds = 0;
    const chronological = [...monthEntries].reverse();
    let currentInTime: number | null = null;
    
    for (const entry of chronological) {
      const ts = new Date(entry.occurred_at).getTime();
      if (entry.entry_type === 'clock_in' || entry.entry_type === 'clock-in') {
        currentInTime = ts;
      } else if (entry.entry_type === 'clock_out' || entry.entry_type === 'clock-out') {
        if (currentInTime) {
          totalSeconds += (ts - currentInTime) / 1000;
          currentInTime = null;
        }
      } else if (entry.entry_type === 'break-start' || entry.entry_type === 'break_start') {
        if (currentInTime) {
          totalSeconds += (ts - currentInTime) / 1000;
          currentInTime = null;
        }
      } else if (entry.entry_type === 'break-end' || entry.entry_type === 'break_end') {
        currentInTime = ts;
      }
    }
    
    if (currentInTime && (lastEntryType === 'clock_in' || lastEntryType === 'break-end' || lastEntryType === 'break_end' || lastEntryType === 'permission-end' || lastEntryType === 'permission_end')) {
      totalSeconds += (new Date().getTime() - currentInTime) / 1000;
    }
    
    return totalSeconds / 3600;
  };
  const workedHours = calculateTotalHours();

  // Horas esperadas según turnos planificados (dinámico, reemplaza las 160h fijas)
  const hoursStats = useMemo(() => {
    const today = isoDateLocal(new Date());
    let expectedTotal = 0;
    let expectedSoFar = 0;

    Object.entries(monthShifts).forEach(([dateKey, shifts]) => {
      (shifts || []).forEach(shift => {
        if (!shift.start_time || !shift.end_time) return;
        const [sH, sM] = shift.start_time.split(':').map(Number);
        const [eH, eM] = shift.end_time.split(':').map(Number);
        let mins = (eH * 60 + eM) - (sH * 60 + sM);
        if (mins < 0) mins += 24 * 60;
        expectedTotal += mins / 60;
        if (dateKey <= today) expectedSoFar += mins / 60;
      });
    });

    return { expectedTotal, expectedSoFar };
  }, [monthShifts]);

  // Desglose por semana del mes actual
  const weeklyBreakdown = useMemo(() => {
    const now = new Date();
    // En demo usamos el último día del mes como "hoy" para mostrar todos los datos
    const lastEntryDate = monthEntries.length > 0
      ? isoDateLocal(new Date(Math.max(...monthEntries.map(e => new Date(e.occurred_at).getTime()))))
      : isoDateLocal(now);
    const today = lastEntryDate > isoDateLocal(now) ? lastEntryDate : isoDateLocal(now);
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const weeks: { label: string; planned: number; worked: number; isFuture: boolean }[] = [];
    let cursor = new Date(firstDay);
    let weekNum = 1;

    while (cursor <= lastDay) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime());

      const dateKeys: string[] = [];
      const d = new Date(cursor);
      while (d <= weekEnd) { dateKeys.push(isoDateLocal(d)); d.setDate(d.getDate() + 1); }

      let plannedMins = 0;
      dateKeys.forEach(dk => {
        (monthShifts[dk] || []).forEach(s => {
          if (!s.start_time || !s.end_time) return;
          const [sH, sM] = s.start_time.split(':').map(Number);
          const [eH, eM] = s.end_time.split(':').map(Number);
          let m = (eH * 60 + eM) - (sH * 60 + sM);
          if (m < 0) m += 24 * 60;
          plannedMins += m;
        });
      });

      const entries = monthEntries
        .filter(e => { const ed = e.occurred_at ? isoDateLocal(new Date(e.occurred_at)) : null; return ed && dateKeys.includes(ed) && ed <= today; })
        .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

      let workedSecs = 0;
      let inTime: number | null = null;
      for (const e of entries) {
        const ts = new Date(e.occurred_at).getTime();
        const t  = e.entry_type;
        if (t === 'clock_in' || t === 'clock-in' || t === 'break-end' || t === 'break_end' || t === 'permission-end' || t === 'permission_end') {
          inTime = ts;
        } else if (t === 'clock_out' || t === 'clock-out' || t === 'break-start' || t === 'break_start' || t === 'permission-start' || t === 'permission_start') {
          if (inTime) { workedSecs += (ts - inTime) / 1000; inTime = null; }
        }
      }
      if (inTime && dateKeys.includes(today) && (lastEntryType === 'clock_in' || lastEntryType === 'break-end' || lastEntryType === 'break_end' || lastEntryType === 'permission-end' || lastEntryType === 'permission_end')) {
        workedSecs += (now.getTime() - inTime) / 1000;
      }

      weeks.push({ label: `Semana ${weekNum}`, planned: plannedMins / 60, worked: workedSecs / 3600, isFuture: dateKeys[0] > today });
      cursor.setDate(cursor.getDate() + 7);
      weekNum++;
    }
    return weeks;
  }, [monthShifts, monthEntries, lastEntryType]);

  const punctualityStats = useMemo(() => {
    const MARGIN = 10;
    const lastEntryDate = monthEntries.length > 0
      ? isoDateLocal(new Date(Math.max(...monthEntries.map(e => new Date(e.occurred_at).getTime()))))
      : isoDateLocal(new Date());
    const todayStr = lastEntryDate > isoDateLocal(new Date()) ? lastEntryDate : isoDateLocal(new Date());
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

    const clockInsByDate:  Record<string, any> = {};
    const clockOutsByDate: Record<string, any> = {};

    [...monthEntries].reverse().forEach(e => {
      const d = isoDateLocal(new Date(e.occurred_at));
      if (d > todayStr) return;
      const t = e.entry_type;
      if (t === 'clock_in'  || t === 'clock-in')  { if (!clockInsByDate[d])  clockInsByDate[d]  = e; }
      if (t === 'clock_out' || t === 'clock-out')  {                          clockOutsByDate[d] = e; } // sobrescribe → se queda el último
    });

    let entryIncidents = 0, exitIncidents = 0, daysAnalyzed = 0;
    let entryChecks = 0, exitChecks = 0;
    let totalEntryDiff = 0, totalExitDiff = 0;

    const allDates = new Set([...Object.keys(clockInsByDate), ...Object.keys(clockOutsByDate)]);

    allDates.forEach(dateKey => {
      // Hora esperada: turno planificado > horario empresa
      const shifts = monthShifts[dateKey];
      let expectedStart: string | null = null;
      let expectedEnd:   string | null = null;

      if (shifts?.length) {
        if (shifts[0].start_time) expectedStart = shifts[0].start_time;
        if (shifts[0].end_time)   expectedEnd   = shifts[0].end_time;
      }
      if (!expectedStart && !expectedEnd) {
        const dow = new Date(dateKey + 'T12:00:00').getDay();
        const sched = companySchedule?.[dayNames[dow]];
        if (sched?.active) { expectedStart = sched.start || null; expectedEnd = sched.end || null; }
      }
      if (!expectedStart && !expectedEnd) return; // día no laborable
      daysAnalyzed++;

      // Entrada: impuntual si |diff| > MARGIN (usamos UTC para comparar con los tiempos del turno)
      if (expectedStart && clockInsByDate[dateKey]) {
        const [sH, sM] = expectedStart.split(':').map(Number);
        const ci = new Date(clockInsByDate[dateKey].occurred_at);
        const diff = (ci.getUTCHours() * 60 + ci.getUTCMinutes()) - (sH * 60 + sM);
        entryChecks++;
        if (Math.abs(diff) > MARGIN) { entryIncidents++; totalEntryDiff += Math.abs(diff); }
      }

      // Salida: impuntual si |diff| > MARGIN
      if (expectedEnd && clockOutsByDate[dateKey]) {
        const [eH, eM] = expectedEnd.split(':').map(Number);
        const co = new Date(clockOutsByDate[dateKey].occurred_at);
        const diff = (co.getUTCHours() * 60 + co.getUTCMinutes()) - (eH * 60 + eM);
        exitChecks++;
        if (Math.abs(diff) > MARGIN) { exitIncidents++; totalExitDiff += Math.abs(diff); }
      }
    });

    const totalChecks = entryChecks + exitChecks;
    const incidents   = entryIncidents + exitIncidents;
    const score       = totalChecks > 0 ? Math.round(((totalChecks - incidents) / totalChecks) * 100) : null;
    const avgEntryDiff = entryIncidents > 0 ? Math.round(totalEntryDiff / entryIncidents) : 0;
    const avgExitDiff  = exitIncidents  > 0 ? Math.round(totalExitDiff  / exitIncidents)  : 0;

    return { entryIncidents, exitIncidents, daysAnalyzed, score, avgEntryDiff, avgExitDiff };
  }, [monthShifts, monthEntries, companySchedule]);

  const handleAbsenceSubmit = async () => {
    if (!absenceStartDate || !absenceEndDate) {
      setError("Por favor, selecciona las fechas");
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (absenceEndDate < absenceStartDate) {
      setError("La fecha de fin no puede ser anterior a la de inicio");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setAbsenceSubmitting(true);
    try {
      const { error } = await supabase.from('absences').insert({
        employee_id: employee.userId,
        company_id: companyId,
        type: absenceType,
        start_date: absenceStartDate,
        end_date: absenceEndDate,
        status: 'pending',
        reason: absenceReason.trim() || null,
      });
      if (error) throw error;
      setAbsenceSuccessMsg(true);
      if (employee) loadAbsences(employee.userId);
      setTimeout(() => {
        setAbsenceSuccessMsg(false);
        setAbsenceType('vacation');
        setAbsenceStartDate(isoDateLocal(new Date()));
        setAbsenceEndDate(isoDateLocal(new Date()));
        setAbsenceReason('');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Error al solicitar ausencia');
      setTimeout(() => setError(null), 3000);
    } finally {
      setAbsenceSubmitting(false);
    }
  };

  const plannedShifts = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = isoDateLocal(selectedDate);
    return monthShifts[dateKey] || [];
  }, [monthShifts, selectedDate]);

  const dailyDistribution = useMemo(() => {
    if (!selectedDate || !employee) return [];
    
    const dateKey = isoDateLocal(selectedDate);
    const dayEntries = monthEntries.filter(e => {
      const entryDate = e.occurred_at ? e.occurred_at.slice(0, 10) : e.date;
      return entryDate === dateKey;
    });

    const sorted = [...dayEntries].sort((a, b) => {
      const da = new Date(a.occurred_at);
      const db = new Date(b.occurred_at);
      return da.getTime() - db.getTime();
    });

    let w = 0, b = 0, o = 0;
    let lastTime = new Date(selectedDate);
    lastTime.setHours(0, 0, 0, 0);
    let lastState = 'out';

    const mapTypeToState = (t: string) => {
      t = (t || '').toLowerCase();
      if (t === 'clock-in' || t === 'clock_in') return 'working';
      if (t === 'break-start' || t === 'break_start') return 'break';
      if (t === 'break-end' || t === 'break_end') return 'working';
      if (t === 'permission-start' || t === 'permission_start' || t === 'others-out') return 'others';
      if (t === 'permission-end' || t === 'permission_end' || t === 'others-in') return 'working';
      if (t === 'clock-out' || t === 'clock_out') return 'out';
      return 'out';
    };

    sorted.filter(e => e.status !== 'pending').forEach(e => {
      const time = new Date(e.occurred_at);
      const diffMins = (time.getTime() - lastTime.getTime()) / 1000 / 60;
      if (diffMins > 0) {
        if (lastState === 'working') w += diffMins;
        else if (lastState === 'break') b += diffMins;
        else if (lastState === 'others') o += diffMins;
      }
      lastTime = time;
      lastState = mapTypeToState(e.entry_type);
    });

    const isToday = isoDateLocal(new Date()) === dateKey;
    let endTime = new Date(selectedDate);
    if (isToday) {
      endTime = new Date();
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

    const totalDay = 1440;
    const trackedStats = w + b + o;
    const f = Math.max(0, totalDay - trackedStats);
    const p = (val: number) => Math.round((val / totalDay) * 100);

    return [
      { label: 'Trabajando', hours: minutesToLabel(w), value: p(w), color: '#135bec' },
      { label: 'Descansando', hours: minutesToLabel(b), value: p(b), color: '#f59e0b' },
      { label: 'Permiso', hours: minutesToLabel(o), value: p(o), color: '#ec4899' },
      { label: 'Libre', hours: minutesToLabel(f), value: p(f), color: '#475569' },
    ];
  }, [monthEntries, selectedDate, employee]);

  const renderMiniDonut = () => {
    if (!selectedDate || dailyDistribution.length === 0) return null;
    let cumulativePercent = 0;
    const size = 90;
    const center = size / 2;
    const radius = 34;
    const strokeWidth = 9;

    const fullItem = dailyDistribution.find((d: any) => d.value >= 99);

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
        {dailyDistribution.map((item: any, index: number) => {
          const startPercent = cumulativePercent;
          const endPercent = cumulativePercent + item.value;
          cumulativePercent = endPercent;

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

  const formatElapsed = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (key: string) => {
    if (dni.length < 15) {
      setDni(prev => prev + key);
      setError(null);
    }
  };

  const handleDelete = () => {
    setDni(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setDni('');
    setError(null);
  };

  const refreshEntries = async (userId: string) => {
    try {
      const nowTime = new Date();
      const startOfM = startOfMonth(nowTime);

      const { data: entries, error: entriesError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .gte('occurred_at', deAdjustISOString(startOfM.toISOString()))
        .order('occurred_at', { ascending: false });

      if (!entriesError && entries) {
        setMonthEntries(adjustDataToCurrentDate(entries));
      }

      // Solo la última entrada que, tras ajuste, sea anterior a ahora
      const { data: absoluteLast } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .lte('occurred_at', deAdjustISOString(new Date().toISOString()))
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (absoluteLast) {
        const adjusted = adjustDataToCurrentDate(absoluteLast);
        setLastOverallEntry(adjusted);
        setLastEntryType(adjusted.entry_type);
      } else {
        setLastOverallEntry(null);
        setLastEntryType(null);
      }
    } catch (refreshErr) {
      console.error("Error al refrescar las entradas en tiempo real:", refreshErr);
    }
  };

  useEffect(() => {
    if (!employee) return;

    const channel = supabase
      .channel(`kiosk-realtime-${employee.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=eq.${employee.userId}`
        },
        async (payload) => {
          console.log('Cambio en time_entries detectado en tiempo real:', payload);
          await refreshEntries(employee.userId);
          await loadCalendarData(currentDate, employee.userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee, currentDate]);

  const handleValidate = async () => {
    if (dni.length < 5) {
      setError('Por favor, introduce un DNI/NIE válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verificar si este dispositivo sigue siendo el kiosko activo
      const localDeviceId = localStorage.getItem('kiosk_device_id');
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('kiosk_device_id')
        .eq('id', companyId)
        .single();
        
      if (companyError) {
        if (companyError.code === 'PGRST116') {
          setError("⚠️ La empresa asociada a este Kiosko no existe. Por favor, cambia de pestaña en el simulador o recarga la página.");
          setLoading(false);
          return;
        }
        throw companyError;
      }
      
      if (companyData.kiosk_device_id && companyData.kiosk_device_id !== localDeviceId) {
        setError("⚠️ Este dispositivo ha sido desvinculado. Se ha activado otra tablet como Kiosko.");
        setTimeout(() => {
          navigate('/');
        }, 5000);
        return;
      }

      // 2. Obtener todos los miembros de la empresa con sus perfiles y filtrar por DNI en JS
      // (no se puede hacer ilike sobre tabla embebida en Supabase; RLS impide buscar profiles directamente)
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('user_id, profiles!inner(id, full_name, avatar, dni_nie)')
        .eq('company_id', companyId);

      if (membersError) throw membersError;

      const dniNorm = dni.trim().toLowerCase();
      const match = (members || []).find((m: any) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return p?.dni_nie?.toLowerCase() === dniNorm;
      });

      if (!match) {
        throw new Error('Empleado no encontrado o no pertenece a esta empresa');
      }

      const profile: any = Array.isArray(match.profiles) ? match.profiles[0] : match.profiles;

      await refreshEntries(match.user_id);
      await loadCalendarData(currentDate, match.user_id);

      setEmployee({
        userId: match.user_id,
        name: profile.full_name,
        avatar: profile.avatar,
        dni: profile.dni_nie
      });

    } catch (err: any) {
      setError(err.message || 'Error al validar el DNI');
    } finally {
      setLoading(false);
    }
  };

  const handleClockAction = async (type: string) => {
    if (!employee || !companyId) return;
    setLoading(true);
    
    try {
      const now = new Date();
      const localTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const { error } = await supabase
        .from('time_entries')
        .insert({
          user_id: employee.userId,
          company_id: companyId,
          entry_type: type,
          occurred_at: now.toISOString(),
          date: now.toISOString().slice(0, 10),
          entry_time: localTime,
          minutes: 0,
          is_manual: false,
          status: 'approved' // Automatically approved because it's real time via Kiosk
        });

      if (error) throw error;

      // Show success modal
      setSuccessMessage({ type: type, time: localTime });
      
      // Reset after 3 seconds
      const tid = setTimeout(() => {
        setSuccessMessage(null);
        setEmployee(null);
        setDni('');
      }, 3000);
      setSuccessTimeoutId(tid);

    } catch (err: any) {
      setError('Error al registrar el fichaje. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualEntry = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!employee || !companyId) return;
    
    if ((manualEntryType === 'permission-start' || manualEntryType === 'others-out') && !manualContextText.trim()) {
       setError("Debes indicar un motivo o contexto para el permiso.");
       return;
    }
    
    setManualSaving(true);
    setError(null);
    
    try {
      const [y, m, d] = manualEntryDate.split("-").map(Number);
      const [hh, mm] = manualEntryTime.split(":").map(Number);
      const occurredAt = new Date(y, m - 1, d, hh, mm, 0, 0);
      
      const { error: insertError } = await supabase
        .from('time_entries')
        .insert({
          user_id: employee.userId,
          company_id: companyId,
          entry_type: manualEntryType,
          occurred_at: occurredAt.toISOString(),
          date: manualEntryDate,
          entry_time: manualEntryTime,
          minutes: 0,
          is_manual: true,
          status: 'pending',
          description: (manualEntryType === 'permission-start' || manualEntryType === 'others-out') ? manualContextText.trim() : undefined
        });
        
      if (insertError) throw insertError;
      
      setShowManualModal(false);
      setManualContextText("");
      handleValidate(); 
      
      setSuccessMessage({ type: manualEntryType, time: manualEntryTime });
      const tid = setTimeout(() => {
        setSuccessMessage(null);
        setEmployee(null);
        setDni('');
      }, 3000);
      setSuccessTimeoutId(tid);
      
    } catch (err) {
      setError("Error al registrar fichaje manual.");
    } finally {
      setManualSaving(false);
    }
  };



  const mode = lastEntryType === 'clock_in' || lastEntryType === 'clock-in' || lastEntryType === 'break-end' || lastEntryType === 'permission-end' || lastEntryType === 'break_end' || lastEntryType === 'permission_end' || lastEntryType === 'others-in' || lastEntryType === 'others_in'
    ? "working"
    : lastEntryType === 'break-start' || lastEntryType === 'break_start'
    ? "break"
    : lastEntryType === 'permission-start' || lastEntryType === 'permission_start' || lastEntryType === 'others-out' || lastEntryType === 'others_out'
    ? "others"
    : "out";

  const canClockIn = mode === "out";
  const canClockOut = mode === "working";
  const canBreakStart = mode === "working";
  const canBreakEnd = mode === "break";
  const canPermissionStart = mode === "working";
  const canPermissionEnd = mode === "others";

  return (
    <div className="h-dvh w-screen bg-slate-900 flex text-slate-100 overflow-hidden">
      {/* Left Sidebar - Clock and Info */}
      {(!employee && !successMessage) && (
        <div className="w-72 shrink-0 bg-slate-800 p-6 flex flex-col justify-between border-r border-slate-700 shadow-2xl z-10 relative overflow-hidden animate-in slide-in-from-left duration-500">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <img src="/icono-kiosko.svg" alt="Fycheo" className="w-9 h-9 rounded-xl shadow-lg shadow-primary/20" />
              <span className="text-base font-bold tracking-tight text-white">Fycheo Kiosko</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-[3.5rem] font-black leading-none tracking-tighter text-white tabular-nums drop-shadow-md">
                {format(currentTime, 'HH:mm')}
              </h2>
              <p className="text-base font-medium text-slate-400 capitalize">
                {format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}
              </p>
            </div>
          </div>

          {/* Company Info */}
          <div className="flex-1 flex flex-col justify-center py-4">
            {companyInfo && (
              <div className="animate-in fade-in slide-in-from-left-4 duration-700">
                {companyInfo.logo_url ? (
                  <div className="h-16 max-w-[200px] mb-4 flex items-center justify-start">
                    <img src={companyInfo.logo_url} alt={companyInfo.name} className="max-h-full max-w-full object-contain drop-shadow-xl" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-slate-600/50">
                    <span className="material-symbols-outlined text-[24px] text-slate-400">domain</span>
                  </div>
                )}
                <h3 className="text-xl font-black text-white tracking-tight leading-tight">{companyInfo.name}</h3>
                <p className="text-primary font-medium mt-1 tracking-wide uppercase text-xs">Organización Vinculada</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div>
            <p className="text-xs text-slate-500 mb-3">Introduce tu DNI/NIE para acceder a tus opciones de fichaje.</p>
            <button
              onClick={() => setShowExitModal(true)}
              className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-bold bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Salir del Kiosko
            </button>
          </div>
        </div>
      )}

      {/* Right Area - Interaction */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">

        {/* Main Interface */}
        {!employee && !successMessage && (
          <div className="w-full max-w-3xl bg-slate-800 rounded-3xl p-5 shadow-2xl border border-slate-700/50">
            <div className="text-center mb-4">
              <div className="w-11 h-11 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-2 border border-slate-600">
                <Fingerprint className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-white">Identificación</h1>
            </div>

            {/* DNI Display */}
            <div className="mb-4">
              <div className={`w-full mx-auto h-16 bg-slate-900 border-2 rounded-xl flex items-center justify-center text-3xl font-mono tracking-[0.5em] transition-all ${error ? 'border-red-500/50 text-red-400' : dni ? 'border-primary/50 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'border-slate-700 text-slate-500'}`}>
                {dni || 'DNI/NIE'}
                {dni && <span className="w-[2px] h-8 bg-primary ml-1 animate-pulse rounded-full"></span>}
              </div>
              {error && (
                <p className="text-red-400 text-center mt-2 text-sm font-medium flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}
            </div>

            {/* Virtual Keyboard: Numpad + Letters */}
            <div className="flex gap-4 items-stretch bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">

              {/* Numpad (Left) */}
              <div className="w-64 grid grid-cols-3 gap-2.5 shrink-0">
                {['1','2','3','4','5','6','7','8','9'].map(num => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="h-16 bg-slate-700 hover:bg-slate-600 active:bg-primary active:scale-95 rounded-xl text-3xl font-bold text-white shadow-md border border-slate-600 transition-all flex items-center justify-center"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={() => handleKeyPress('0')}
                  className="col-start-2 h-16 bg-slate-700 hover:bg-slate-600 active:bg-primary active:scale-95 rounded-xl text-3xl font-bold text-white shadow-md border border-slate-600 transition-all flex items-center justify-center"
                >
                  0
                </button>
              </div>

              {/* Divider */}
              <div className="w-px bg-slate-700"></div>

              {/* Letters (Right) */}
              <div className="flex-1 flex flex-col gap-2">
                {LETTERS_ROWS.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex justify-center gap-2 flex-1">
                    {row.map(l => (
                      <button
                        key={l}
                        onClick={() => handleKeyPress(l)}
                        className="w-12 h-full bg-slate-700/50 hover:bg-slate-600 active:bg-primary active:scale-95 rounded-xl text-lg font-bold text-slate-200 border border-slate-600/50 shadow-sm transition-all flex items-center justify-center"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center mt-4 gap-3">
              <div className="flex gap-3">
                <button
                  onClick={handleClear}
                  className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-xl text-base font-bold text-slate-400 shadow-md transition-all border border-slate-700 hover:border-slate-600 uppercase"
                >
                  Limpiar
                </button>
                <button
                  onClick={handleDelete}
                  className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 active:bg-red-500 active:text-white rounded-xl text-base font-bold text-slate-400 shadow-md transition-all border border-slate-700 hover:border-slate-600 uppercase"
                >
                  Borrar
                </button>
              </div>
              <button
                onClick={handleValidate}
                disabled={loading || dni.length === 0}
                className="flex-1 max-w-xs bg-primary hover:bg-primary/90 disabled:bg-primary/30 disabled:text-white/50 active:scale-95 rounded-xl text-lg font-bold text-white shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 py-3.5"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Validar Identidad'}
              </button>
            </div>


          </div>
        )}

        {/* Portal Dashboard */}
        {employee && !successMessage && (
          <div className="w-full h-full flex overflow-hidden animate-in fade-in zoom-in duration-300">
            
            {/* Sidebar Menú */}
            <div className="w-72 bg-slate-800 flex flex-col border-r border-slate-700/50 z-10 shrink-0">
              <div className="p-8 flex flex-col items-center border-b border-slate-700/50">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-600 bg-slate-700 shadow-md mb-4">
                  {employee.avatar ? (
                    <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-400">
                      {employee.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white text-center leading-tight mb-1">{employee.name}</h2>
                <p className="text-slate-400 font-mono text-sm">{employee.dni}</p>
              </div>

              <div className="flex-1 p-6 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-lg transition-all ${activeTab === 'dashboard' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-[26px]">timer</span>
                  Fichar
                </button>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-lg transition-all ${activeTab === 'calendar' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-[26px]">calendar_month</span>
                  Calendario
                </button>
                <button
                  onClick={() => setActiveTab('hours')}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-lg transition-all ${activeTab === 'hours' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-[26px]">query_stats</span>
                  Mis Horas
                </button>
                <button
                  onClick={() => setActiveTab('absences')}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-lg transition-all ${activeTab === 'absences' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-[26px]">flight_takeoff</span>
                  Ausencias
                </button>

                {/* Empresa vinculada */}
                {companyInfo && (
                  <div className="mt-auto pt-2">
                    <div className="bg-slate-900/70 rounded-2xl p-4 border border-slate-700/40 flex items-center gap-3">
                      {companyInfo.logo_url ? (
                        <img src={companyInfo.logo_url} alt={companyInfo.name} className="h-9 w-9 object-contain rounded-xl shrink-0" />
                      ) : (
                        <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-slate-400 text-[20px]">business</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-0.5">Organización</p>
                        <p className="text-sm font-bold text-white leading-tight break-words">{companyInfo.name}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-700/50">
                <button 
                  onClick={() => { setEmployee(null); setMonthEntries([]); setActiveTab('dashboard'); }} 
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-2xl font-bold transition-colors border border-slate-700 hover:border-red-500/30"
                >
                  <span className="material-symbols-outlined text-[24px]">logout</span>
                  Cerrar Sesión
                </button>
                <p className="text-center text-sm text-slate-500 mt-4">Autocierre en <span className="text-slate-400 font-bold">{logoutCountdown}s</span></p>
              </div>
            </div>

            {/* Contenido Principal */}
            <div className="flex-1 bg-slate-900 flex flex-col overflow-hidden relative">
              
              {/* TAB: FICHAR */}
              {activeTab === 'dashboard' && (
                <div className="flex-1 flex flex-col items-center justify-between px-6 py-4 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Timer */}
                  <div className="flex flex-col items-center justify-center pt-2 pb-3">
                    <p className="text-slate-400 text-xs font-medium tracking-wide mb-1">Tiempo en este estado</p>
                    <h1 className={`${elapsedTime > 86400 && mode !== 'out' ? "text-5xl" : "text-[5rem]"} leading-none font-black text-white tabular-nums tracking-tighter mb-3`}>
                      {elapsedTime > 86400 && mode !== 'out' ? "Más de 24h" : formatElapsed(elapsedTime)}
                    </h1>
                    <p className={`text-2xl font-black uppercase tracking-[0.2em] mb-2 ${
                      mode === 'working' ? 'text-blue-500' :
                      mode === 'break'   ? 'text-amber-500' :
                      mode === 'others'  ? 'text-pink-500' : 'text-slate-400'
                    }`}>
                      {mode === 'working' ? 'Trabajando' : mode === 'break' ? 'En Descanso' : mode === 'others' ? 'Con Permiso' : 'Salida'}
                    </p>
                    {companyInfo && (
                      <p className="text-sm text-slate-400 flex items-center gap-1.5 font-semibold">
                        <span className="material-symbols-outlined text-[18px]">business</span>
                        Fichando en: <strong className="text-slate-200 font-extrabold">{companyInfo.name}</strong>
                      </p>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="grid grid-cols-2 gap-3 w-full max-w-2xl flex-1 min-h-0 py-1">
                    {[
                      { action: 'clock_in',    disabled: !canClockIn,                          bg: !canClockIn    ? 'bg-[#135bec]/40 cursor-not-allowed opacity-50 shadow-none' : 'bg-[#135bec] hover:bg-[#0e4fc7] shadow-blue-900/20',    icon: 'login',       label: 'Entrada',     active: false },
                      { action: 'clock_out',   disabled: !canClockOut,                         bg: !canClockOut   ? 'bg-[#475569]/40 cursor-not-allowed opacity-50 shadow-none' : 'bg-[#475569] hover:bg-[#334155] shadow-slate-900/20',   icon: 'logout',      label: 'Salida',      active: false },
                      { action: mode === 'break'  ? 'break-end'      : 'break-start',      disabled: !canBreakStart      && !canBreakEnd,      bg: (!canBreakStart && !canBreakEnd)           ? 'bg-[#f59e0b]/40 cursor-not-allowed opacity-50 shadow-none' : mode === 'break'   ? 'bg-[#f59e0b] hover:bg-[#d97706] border-2 border-amber-300 shadow-amber-900/40'   : 'bg-[#f59e0b] hover:bg-[#d97706] shadow-amber-900/20',   icon: mode === 'break'   ? 'play_arrow' : 'coffee',     label: mode === 'break'   ? 'Fin Descanso' : 'Descanso', active: mode === 'break'   },
                      { action: mode === 'others' ? 'permission-end'  : 'permission-start', disabled: !canPermissionStart && !canPermissionEnd, bg: (!canPermissionStart && !canPermissionEnd) ? 'bg-[#ec4899]/40 cursor-not-allowed opacity-50 shadow-none' : mode === 'others' ? 'bg-[#ec4899] hover:bg-[#db2777] border-2 border-pink-300 shadow-pink-900/40' : 'bg-[#ec4899] hover:bg-[#db2777] shadow-pink-900/20',   icon: mode === 'others' ? 'history_edu' : 'edit_note',   label: mode === 'others' ? 'Fin Permiso'  : 'Permiso',   active: mode === 'others' },
                    ].map(btn => (
                      <button key={btn.action}
                        onClick={() => handleClockAction(btn.action)}
                        disabled={loading || btn.disabled}
                        className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl transition-all shadow-lg ${btn.bg}`}
                      >
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-[36px] text-white">{btn.icon}</span>
                        </div>
                        <span className="text-xl font-bold text-white tracking-wide uppercase">{btn.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Fichaje olvidado */}
                  <div className="w-full max-w-2xl flex justify-end pt-2">
                    <button
                      onClick={() => {
                        const now = new Date();
                        const offset = now.getTimezoneOffset();
                        setManualEntryDate(new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10));
                        setManualEntryTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
                        if (mode === "out") setManualEntryType("clock-in");
                        else if (mode === "working") setManualEntryType("clock-out");
                        else if (mode === "break") setManualEntryType("break-end");
                        else if (mode === "others") setManualEntryType("permission-end");
                        setShowManualModal(true);
                      }}
                      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-3 rounded-xl border border-slate-700 shadow-lg transition-colors font-semibold text-base group"
                    >
                      <span className="material-symbols-outlined text-[20px] text-blue-500 group-hover:scale-110 transition-transform">add_circle</span>
                      Añadir fichaje olvidado
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500 flex">
                  {/* Calendario (Lado Izquierdo) */}
                  <div className="flex-1 flex flex-col justify-start pr-8">
                    <div>
                      {teamMembers.length > 0 && (
                        <div className="flex justify-center mb-6">
                          <button
                            type="button"
                            onClick={() => setIsTeamMode(!isTeamMode)}
                            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer active:scale-95 shadow-sm ${
                              isTeamMode 
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 border-transparent' 
                                : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:text-white hover:bg-slate-700/50'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">groups</span>
                            Modo Equipo
                          </button>
                        </div>
                      )}
                      {/* Cabecera del Calendario */}
                      <div className="flex items-center justify-between mb-8 px-2">
                        <button 
                          type="button"
                          onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} 
                          className="w-11 h-11 rounded-full text-slate-400 bg-slate-800/40 hover:bg-slate-700/30 hover:text-white border border-slate-700/20 hover:border-slate-600 transition-all cursor-pointer flex items-center justify-center active:scale-90"
                        >
                          <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                        </button>
                        <div className="flex flex-col items-center">
                          <span className="text-white font-extrabold text-3xl capitalize leading-none tracking-tight">
                            {format(currentDate, 'MMMM', { locale: es })}
                          </span>
                          <span className="text-slate-500 text-sm font-bold uppercase tracking-wider leading-none mt-2">
                            {currentDate.getFullYear()}
                          </span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} 
                          className="w-11 h-11 rounded-full text-slate-400 bg-slate-800/40 hover:bg-slate-700/30 hover:text-white border border-slate-700/20 hover:border-slate-600 transition-all cursor-pointer flex items-center justify-center active:scale-90"
                        >
                          <span className="material-symbols-outlined text-[24px]">chevron_right</span>
                        </button>
                      </div>

                      {/* Días de la semana */}
                      <div className="grid grid-cols-7 gap-1 mb-4">
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                          <div key={day} className="h-8 flex items-center justify-center">
                            <span className="text-sm font-black text-slate-400 uppercase tracking-wider">{day}</span>
                          </div>
                        ))}
                      </div>

                      {/* Celdas del Calendario */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const start = startOfMonth(currentDate);
                          const end = endOfMonth(currentDate);
                          const days = eachDayOfInterval({ start, end });
                          
                          const startDayOfWeek = start.getDay(); // 0 is Sunday
                          const offset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
                          
                          const blanks = Array.from({ length: offset }).map((_, i) => (
                            <div key={`blank-${i}`} className="aspect-square"></div>
                          ));
                          
                          const dayCells = days.map((day, i) => {
                            const isToday = isSameDay(day, new Date());
                            const isSelected = selectedDate && isSameDay(day, selectedDate);
                            const dayKey = isoDateLocal(day);
                            
                            const dayShift = monthShifts[dayKey]?.[0];
                            const dayHoliday = monthHolidays[dayKey];
                            const shiftStyle = dayShift ? getShiftStyle(dayShift.color) : null;
                            // Determinar si el día de la semana está normalmente cerrado según la empresa
                            const currentDayOfWeek = day.getDay();
                            const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
                            const isNormallyClosed = companySchedule && companySchedule[dayKeys[currentDayOfWeek]] && !companySchedule[dayKeys[currentDayOfWeek]].active;
                            
                            let isClosed = isNormallyClosed;
                            if (dayHoliday) {
                              isClosed = false; 
                            }

                            const hasTeamShift = teamShifts[dayKey] && teamShifts[dayKey].length > 0;

                            let cellClassName = 'relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all border-none cursor-pointer ';

                            if (isSelected) {
                              cellClassName += 'ring-1 ring-white scale-105 z-10 ';
                            }

                            if (isTeamMode) {
                              cellClassName += 'bg-transparent hover:bg-slate-800/50 ';
                              if (isClosed && !hasTeamShift) cellClassName += 'opacity-40 hover:opacity-100 ';
                            } else {
                              cellClassName += shiftStyle ? `${shiftStyle.bar} text-white ` : 'bg-transparent hover:bg-slate-800/50 ';
                              if (isClosed && !shiftStyle) cellClassName += 'opacity-40 hover:opacity-100 ';
                            }

                            let textClassName = 'transition-all ';
                            if (isToday) textClassName += 'text-lg font-black text-white';
                            else if (isSelected) textClassName += 'text-sm font-black text-white';
                            else if (dayHoliday) textClassName += `text-sm font-black ${isTeamMode || !shiftStyle ? dayHoliday.color : 'text-white'}`;
                            else textClassName += 'text-sm font-light text-slate-200';

                            return (
                              <button 
                                type="button"
                                key={`day-${i}`} 
                                onClick={() => setSelectedDate(day)}
                                className={cellClassName}
                              >
                                <span className={textClassName}>{format(day, 'd')}</span>
                                {isTeamMode && hasTeamShift && (
                                  <div className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-[#135bec]" />
                                )}
                              </button>
                            );
                          });
                          
                          return [...blanks, ...dayCells];
                        })()}
                      </div>


                    </div>

                    {/* Distribución del Tiempo */}
                    {selectedDate && dailyDistribution.length > 0 && (
                      <div className="border-t border-slate-700/30 pt-6 mt-auto">
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest block mb-3">Distribución del Tiempo</span>
                        <div className="flex items-center gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-700/20">
                          <div className="relative shrink-0 flex items-center justify-center">
                            {renderMiniDonut()}
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold leading-none mb-0.5">Total</span>
                              <span className="text-xs font-bold text-slate-300 leading-none">24h</span>
                            </div>
                          </div>
                          <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                            {dailyDistribution.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-1.5 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs text-slate-400 font-bold truncate leading-none mb-0.5">{item.label}</span>
                                  <span className="text-xs font-bold text-slate-200 leading-none">{item.hours} ({item.value}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Panel Lateral Detalle Diario (Lado Derecho) */}
                  <div className="w-96 flex flex-col gap-6 border-l border-slate-700/30 pl-8">
                    <div className="border-b border-slate-700/50 pb-4">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-wider block mb-1">Detalle del Día</span>
                      <h3 className="text-lg font-bold text-white capitalize">
                        {selectedDate ? format(selectedDate, "eeee, d 'de' MMMM", { locale: es }) : 'Selecciona un día'}
                      </h3>
                    </div>

                    {selectedDate && (
                      <>
                        {isTeamMode ? (
                          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-3">
                            <h4 className="text-xs font-bold text-slate-400 flex items-center gap-2 mb-2 uppercase tracking-wider">
                              <span className="material-symbols-outlined text-primary text-[18px]">groups</span>
                              Turnos del Equipo
                            </h4>
                            {teamMembers.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 text-center">
                                <span className="material-symbols-outlined text-3xl mb-1">groups</span>
                                <p className="text-xs font-semibold">No hay otros miembros en tu equipo</p>
                              </div>
                            ) : !teamShifts[isoDateLocal(selectedDate)] || teamShifts[isoDateLocal(selectedDate)].length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-10 text-slate-500 opacity-60 text-center">
                                <span className="material-symbols-outlined text-3xl mb-1">event_busy</span>
                                <p className="text-xs font-semibold">Ningún compañero tiene turno este día</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {teamShifts[isoDateLocal(selectedDate)].map((shift, idx) => {
                                  const member = teamMembers.find(m => m.user_id === shift.employee_id);
                                  if (!member) return null;
                                  const startTimeStr = shift.start_time ? shift.start_time.substring(0, 5) : '--:--';
                                  const endTimeStr = shift.end_time ? shift.end_time.substring(0, 5) : '--:--';
                                  const s = getShiftStyle(shift.color);
                                  
                                  return (
                                    <div key={idx} className={`relative overflow-hidden rounded-2xl border ${s.card} flex items-center p-3 gap-3 animate-in fade-in duration-200`}>
                                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
                                      <div className="size-10 rounded-full overflow-hidden shrink-0 border border-slate-700/50 ml-1">
                                        {member.profiles?.avatar || member.profiles?.avatar_url ? (
                                          <img src={member.profiles.avatar || member.profiles.avatar_url} alt={member.profiles.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className={`w-full h-full flex items-center justify-center font-bold text-sm bg-slate-700 text-slate-200`}>
                                            {member.profiles?.full_name?.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-200 text-xs truncate">{member.profiles?.full_name}</p>
                                        <p className="text-xs font-medium text-slate-400 mt-0.5">{shift.shift_type || 'Turno'}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-xs font-bold text-slate-200">{startTimeStr} - {endTimeStr}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Selector de pestañas */}
                            <div className="flex bg-slate-900/60 rounded-xl p-1 gap-1 border border-slate-700/30">
                              <button
                                type="button"
                                onClick={() => setActiveTabCalendar('shifts')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                                  activeTabCalendar === 'shifts'
                                    ? 'bg-[#135bec] text-white shadow-sm'
                                    : 'bg-transparent text-slate-400 hover:text-white'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">schedule</span>
                                Programación
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveTabCalendar('activity')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                                  activeTabCalendar === 'activity'
                                    ? 'bg-[#135bec] text-white shadow-sm'
                                    : 'bg-transparent text-slate-400 hover:text-white'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[16px]">history</span>
                                Registros
                              </button>
                            </div>

                            {/* Contenido de la pestaña */}
                            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-3">
                              {activeTabCalendar === 'shifts' && (
                                <div className="space-y-3">
                                  {/* Festivos del día */}
                                  {monthHolidays[isoDateLocal(selectedDate)] && (
                                    <div className={`relative overflow-hidden rounded-2xl border ${monthHolidays[isoDateLocal(selectedDate)].bgClass} p-4`}>
                                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${monthHolidays[isoDateLocal(selectedDate)].barClass}`} />
                                      <div className="flex items-center gap-3">
                                        <div className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${monthHolidays[isoDateLocal(selectedDate)].iconClass}`}>
                                          <span className="material-symbols-outlined text-[18px]">celebration</span>
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-bold text-sm text-slate-200">{monthHolidays[isoDateLocal(selectedDate)].name || 'Día Festivo'}</p>
                                          <p className={`text-xs mt-0.5 font-medium ${monthHolidays[isoDateLocal(selectedDate)].color}`}>{monthHolidays[isoDateLocal(selectedDate)].context || 'Festivo de Empresa'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Turnos planificados */}
                                  {plannedShifts.length === 0 && !monthHolidays[isoDateLocal(selectedDate)] ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-slate-500 opacity-60">
                                      <span className="material-symbols-outlined text-3xl mb-1">event_busy</span>
                                      <p className="text-xs font-semibold">No hay turnos planificados hoy</p>
                                    </div>
                                  ) : (
                                    plannedShifts.map((shift: any, idx: number) => {
                                      const startTimeStr = shift.start_time ? shift.start_time.substring(0, 5) : '--:--';
                                      const endTimeStr = shift.end_time ? shift.end_time.substring(0, 5) : '--:--';
                                      const s = getShiftStyle(shift.color);

                                      const notes = shift.notes || '';
                                      const t2Match = notes.match(/\(Descanso T2:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i);
                                      const t1Match = notes.match(/\(Descanso T1:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i) || notes.match(/\(Descanso:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i);
                                      const breakMins = t2Match ? parseInt(t2Match[1]) : (t1Match ? parseInt(t1Match[1]) : 0);
                                      const breakPaid = t2Match ? t2Match[2].toLowerCase().includes('pagado') : (t1Match ? t1Match[2].toLowerCase().includes('pagado') : false);
                                      const totalBreakMins = (t1Match ? parseInt(t1Match[1]) : 0) + (t2Match ? parseInt(t2Match[1]) : 0);
                                      const displayNotes = notes.replace(/\(Descanso T[12]:[^)]+\)/gi, '').replace(/\(Descanso:[^)]+\)/i, '').trim() || null;

                                      const [sH, sM] = (shift.start_time || '00:00').split(':').map(Number);
                                      const [eH, eM] = (shift.end_time || '00:00').split(':').map(Number);
                                      let totalMins = (eH * 60 + eM) - (sH * 60 + sM);
                                      if (totalMins < 0) totalMins += 24 * 60;
                                      const workedMins = totalMins;
                                      const realEndMins = !breakPaid && breakMins > 0 ? eH * 60 + eM + breakMins : eH * 60 + eM;
                                      const realEndStr = `${String(Math.floor(realEndMins / 60) % 24).padStart(2, '0')}:${String(realEndMins % 60).padStart(2, '0')}`;
                                      const workedLabel = workedMins >= 60
                                        ? `${Math.floor(workedMins / 60)}h${workedMins % 60 > 0 ? ` ${workedMins % 60}m` : ''}`
                                        : `${workedMins}m`;

                                      return (
                                        <div key={idx} className={`relative overflow-hidden rounded-2xl border ${s.card} p-4`}>
                                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
                                          <div className="flex items-center gap-3 mb-3">
                                            <div className={`size-9 shrink-0 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                                              <span className={`material-symbols-outlined text-[18px] ${s.iconText}`}>schedule</span>
                                            </div>
                                            <div className="flex-1">
                                              <p className={`font-bold text-sm ${s.title}`}>{startTimeStr} — {endTimeStr}</p>
                                              {displayNotes && <p className={`text-xs mt-0.5 line-clamp-1 ${s.notes}`}>{displayNotes}</p>}
                                            </div>
                                            <span className={`text-xs font-black ${s.iconText}`}>{workedLabel}</span>
                                          </div>
                                          
                                          <div className={`grid grid-cols-3 gap-2 pt-3 border-t border-slate-700/30`}>
                                            <div className="flex flex-col">
                                              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Entrada</span>
                                              <span className={`text-xs font-bold text-slate-200`}>{startTimeStr}</span>
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Salida</span>
                                              <span className={`text-xs font-bold text-slate-200`}>{realEndStr}</span>
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Descanso</span>
                                              <span className={`text-xs font-bold text-slate-200`}>
                                                {totalBreakMins > 0 ? `${totalBreakMins}m` : 'Sin descanso'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}

                              {activeTabCalendar === 'activity' && (
                                <div className="space-y-3">
                                  {(() => {
                                    const dayEntries = monthEntries.filter(e => {
                                      const entryDate = e.occurred_at ? e.occurred_at.slice(0, 10) : e.date;
                                      return entryDate === isoDateLocal(selectedDate);
                                    });

                                    if (dayEntries.length === 0) {
                                      return <div className="text-center py-8 text-slate-500 opacity-60 text-xs font-semibold">Sin fichajes en este día</div>;
                                    }
                                    const sortedEntries = [...dayEntries].reverse();
                                    return sortedEntries.map((entry, idx) => {
                                      const meta = typeMeta(entry.entry_type);
                                      const c = colorClasses(meta.color);
                                      
                                      const occurred = new Date(entry.occurred_at);
                                      const timeCell = occurred.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                                      
                                      // Calcular duración
                                      let durationLabel = null;
                                      const type = (entry.entry_type ?? "").toLowerCase();
                                      if (['clock-in', 'clock_in', 'break-start', 'break_start', 'clock-out', 'clock_out', 'permission-start', 'permission_start', 'others-out', 'break-end', 'break_end', 'permission-end', 'permission_end', 'others-in'].includes(type)) {
                                        const msCurrent = occurred.getTime();
                                        const parsedNext = idx < sortedEntries.length - 1 ? sortedEntries[idx + 1] : null;
                                        let msNext = new Date().getTime();

                                        const isSelToday = isoDateLocal(new Date()) === isoDateLocal(selectedDate);
                                        if (parsedNext) {
                                          msNext = new Date(parsedNext.occurred_at).getTime();
                                        } else if (!isSelToday) {
                                          durationLabel = null;
                                        }

                                        if (parsedNext || isSelToday) {
                                          const diff = msNext - msCurrent;
                                          if (diff > 0) {
                                            durationLabel = minutesToLabel(Math.floor(diff / 1000 / 60));
                                          }
                                        }
                                      }

                                      const stateTitles: Record<string, string> = {
                                        "clock-in": "Trabajando",
                                        "clock_in": "Trabajando",
                                        "clock-out": "Salida",
                                        "clock_out": "Salida",
                                        "break-start": "Descanso",
                                        "break_start": "Descanso",
                                        "break-end": "Trabajando",
                                        "break_end": "Trabajando",
                                        "others-in": "Trabajando",
                                        "others_in": "Trabajando",
                                        "permission-end": "Trabajando",
                                        "permission_end": "Trabajando",
                                      };

                                      const typeKey = (entry.entry_type ?? "").toLowerCase();
                                      const isStandard = Object.keys(stateTitles).includes(typeKey);

                                      let displayLabel = isStandard
                                        ? stateTitles[typeKey]
                                        : entry.description || meta.label;

                                      if (typeKey === "others-out" || typeKey === "others_out" || typeKey === "permission-start" || typeKey === "permission_start") {
                                        const rawDesc = entry.description || "";
                                        displayLabel = rawDesc.replace(/^Permiso:\s*/i, "").replace(/^Salida:\s*/i, "") || "Permiso";
                                      }

                                      return (
                                        <div 
                                          key={idx} 
                                          className={`flex items-center gap-4 p-3.5 rounded-2xl border-l-4 ${c.border} bg-slate-800/40 border-t border-b border-r border-t-slate-700/20 border-b-slate-700/20 border-r-slate-700/20 shadow-sm animate-in fade-in duration-200`}
                                        >
                                          <div className={`w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center shrink-0`}>
                                            <span className={`material-symbols-outlined text-xl ${c.iconText}`}>
                                              {meta.icon}
                                            </span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <p className="font-bold text-white text-sm">
                                                {displayLabel}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <p className="text-xs text-slate-400 font-semibold">
                                                {timeCell} • {meta.label}
                                              </p>
                                              {entry.status === 'pending' && (
                                                <span className="text-xs font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md border border-amber-500/20 leading-none">
                                                  Pendiente
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {durationLabel && (
                                            <div className="text-right shrink-0">
                                              <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded-md">
                                                {durationLabel}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: MIS HORAS */}
              {activeTab === 'hours' && (
                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="px-8 pt-6 pb-3 shrink-0">
                    <h3 className="text-xl font-bold text-white">Mis Horas</h3>
                    <p className="text-slate-500 text-xs">Balance de horas trabajadas en {format(new Date(), 'MMMM', { locale: es })}</p>
                  </div>

                  <div className="flex-1 min-h-0 grid grid-cols-2 gap-3 px-8 pb-6">

                    {/* ── Acumulado Mensual ── */}
                    {(() => {
                      const pct      = hoursStats.expectedTotal > 0 ? Math.min(100, Math.max(0, (workedHours / hoursStats.expectedTotal) * 100)) : Math.min(100, Math.max(0, (workedHours / 160) * 100));
                      const balance  = workedHours - hoursStats.expectedSoFar;
                      const balSign  = balance >= 0 ? '+' : '-';
                      const balH     = Math.floor(Math.abs(balance));
                      const balM     = Math.round((Math.abs(balance) % 1) * 60);
                      const balColor = balance >= 0 ? 'text-emerald-400' : 'text-red-400';
                      const objLabel = hoursStats.expectedTotal > 0 ? `${Math.floor(hoursStats.expectedTotal)}h ${Math.round((hoursStats.expectedTotal % 1) * 60)}m` : '160h';
                      return (
                        <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700/50 flex flex-col">
                          {/* Cabecera */}
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Acumulado Mensual</p>
                          {/* Círculo centrado */}
                          <div className="flex-1 flex items-center justify-center">
                            <div className="relative w-36 h-36">
                              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-700" />
                                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="9"
                                  strokeDasharray={`${pct * 2.639} 263.9`} strokeLinecap="round"
                                  className="text-primary transition-all duration-1000 ease-out" />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-white tabular-nums leading-none">{Math.floor(workedHours)}<span className="text-lg text-slate-400">h</span></span>
                                <span className="text-sm text-slate-400 font-semibold leading-none mt-0.5">{Math.floor((workedHours % 1) * 60)}m</span>
                                <span className="text-sm text-slate-600 font-medium mt-1">de {objLabel}</span>
                              </div>
                            </div>
                          </div>
                          {/* Métricas */}
                          <div className="grid grid-cols-3 mt-4 bg-slate-900/60 rounded-2xl p-3 border border-slate-700/40">
                            <div className="text-center">
                              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Fichajes</p>
                              <p className="text-white text-base font-bold">{monthEntries.length}</p>
                            </div>
                            <div className="text-center border-x border-slate-700/50">
                              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Balance</p>
                              <p className={`text-base font-bold ${balColor}`}>{balSign}{balH}h {balM}m</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Objetivo</p>
                              <p className="text-white text-base font-bold">{objLabel}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Desglose Semanal ── */}
                    <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700/50 flex flex-col">
                      <div className="flex items-center gap-2.5 mb-3 shrink-0">
                        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-[16px]">bar_chart</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">Desglose Semanal</p>
                          <p className="text-xs text-slate-500">Trabajadas vs planificadas</p>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-around gap-1">
                        {weeklyBreakdown.map((week, i) => {
                          const pct = week.planned > 0 ? Math.min(100, (week.worked / week.planned) * 100) : 0;
                          const wH  = Math.floor(week.worked);
                          const wM  = Math.round((week.worked % 1) * 60);
                          const pH  = Math.floor(week.planned);
                          const pM  = Math.round((week.planned % 1) * 60);
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-slate-400">{week.label}</span>
                                {week.isFuture ? (
                                  <span className="text-sm text-slate-600">Pendiente · {week.planned > 0 ? `${pH}h ${pM}m` : '—'}</span>
                                ) : (
                                  <span className="text-xs">
                                    <span className={pct >= 100 ? 'text-emerald-400 font-bold' : 'text-white font-semibold'}>{wH}h {wM}m</span>
                                    <span className="text-slate-600"> / {week.planned > 0 ? `${pH}h ${pM}m` : '—'}</span>
                                  </span>
                                )}
                              </div>
                              <div className="h-2 bg-slate-700/80 rounded-full overflow-hidden">
                                {!week.isFuture && week.planned > 0 && (
                                  <div className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : 'bg-[#135bec]'}`} style={{ width: `${pct}%` }} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {weeklyBreakdown.length === 0 && <p className="text-slate-600 text-xs text-center">Sin turnos este mes</p>}
                      </div>
                    </div>

                    {/* ── Salud de Puntualidad ── */}
                    {(() => {
                      const { score, entryIncidents, exitIncidents, daysAnalyzed, avgEntryDiff, avgExitDiff } = punctualityStats;
                      const scoreColor = score === null ? 'text-slate-400' : score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : 'text-red-400';
                      const barColor   = score === null ? 'bg-slate-600'   : score >= 90 ? 'bg-emerald-500'  : score >= 70 ? 'bg-amber-500'   : 'bg-red-500';
                      const msg        = score === null ? null : score >= 90 ? '¡Excelente puntualidad!' : score >= 70 ? 'Buena, puedes mejorar.' : 'Necesita mejorar.';
                      return (
                        <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700/50 flex flex-col">
                          {/* Cabecera */}
                          <div className="flex items-center gap-2.5 shrink-0 mb-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-primary text-[16px]">schedule</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white leading-tight">Salud de Puntualidad</p>
                              <p className="text-xs text-slate-500">{daysAnalyzed > 0 ? `${daysAnalyzed} días · margen ±10 min` : 'Sin datos este mes'}</p>
                            </div>
                          </div>
                          {/* Score centrado */}
                          <div className="flex-1 flex flex-col items-center justify-center gap-2">
                            <span className={`text-5xl font-black tabular-nums ${scoreColor}`}>{score !== null ? `${score}%` : '—'}</span>
                            {msg && <p className={`text-xs font-semibold text-center ${scoreColor}`}>{msg}</p>}
                            <div className="w-full h-2.5 bg-slate-700/80 rounded-full overflow-hidden mt-1">
                              <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${score ?? 0}%` }} />
                            </div>
                          </div>
                          {/* Métricas */}
                          <div className="grid grid-cols-3 mt-4 bg-slate-900/60 rounded-2xl p-3 border border-slate-700/40">
                            <div className="text-center">
                              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Entradas</p>
                              <p className={`text-base font-bold ${entryIncidents > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{entryIncidents > 0 ? `${entryIncidents} inc.` : 'OK'}</p>
                              <p className="text-slate-600 text-xs">{entryIncidents > 0 ? `~${avgEntryDiff >= 60 ? `${Math.floor(avgEntryDiff/60)}h ${avgEntryDiff%60}m` : `${avgEntryDiff}m`}` : '±10 min'}</p>
                            </div>
                            <div className="text-center border-x border-slate-700/50">
                              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Salidas</p>
                              <p className={`text-base font-bold ${exitIncidents > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{exitIncidents > 0 ? `${exitIncidents} inc.` : 'OK'}</p>
                              <p className="text-slate-600 text-xs">{exitIncidents > 0 ? `~${avgExitDiff >= 60 ? `${Math.floor(avgExitDiff/60)}h ${avgExitDiff%60}m` : `${avgExitDiff}m`}` : '±10 min'}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Días OK</p>
                              <p className="text-emerald-400 text-base font-bold">{daysAnalyzed - Math.min(daysAnalyzed, entryIncidents + exitIncidents)}</p>
                              <p className="text-slate-600 text-xs">de {daysAnalyzed}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Resumen Anual ── */}
                    <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700/50 flex flex-col">
                      <div className="flex items-center gap-2.5 shrink-0 mb-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-[16px]">calendar_today</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">Resumen Anual</p>
                          <p className="text-xs text-slate-500">Planificadas vs trabajadas · {new Date().getFullYear()}</p>
                        </div>
                      </div>

                      {loadingYearly ? (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl text-slate-600 animate-spin">progress_activity</span>
                        </div>
                      ) : !yearlyStats ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-slate-600 text-xs text-center">Sin datos anuales</p>
                        </div>
                      ) : (() => {
                        const { totalPlanned, totalWorked, monthlyPlanned, monthlyWorked } = yearlyStats;
                        const annualPct  = totalPlanned > 0 ? Math.min(100, (totalWorked / totalPlanned) * 100) : 0;
                        const annualBal  = totalWorked - totalPlanned;
                        const balColor   = annualBal >= 0 ? 'text-emerald-400' : 'text-red-400';
                        const monthNames = ['E','F','M','A','M','J','J','A','S','O','N','D'];
                        const maxPlanned = Math.max(...monthlyPlanned, 1);
                        const currentMonth = new Date().getMonth();
                        return (
                          <div className="flex-1 flex flex-col min-h-0">
                            {/* Métricas anuales */}
                            <div className="grid grid-cols-3 bg-slate-900/60 rounded-2xl p-3 border border-slate-700/40 shrink-0">
                              <div className="text-center">
                                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Trabajadas</p>
                                <p className="text-white text-sm font-bold">{Math.floor(totalWorked)}h {Math.round((totalWorked % 1) * 60)}m</p>
                              </div>
                              <div className="text-center border-x border-slate-700/50">
                                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Planificadas</p>
                                <p className="text-white text-sm font-bold">{Math.floor(totalPlanned)}h {Math.round((totalPlanned % 1) * 60)}m</p>
                              </div>
                              <div className="text-center">
                                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Balance</p>
                                <p className={`text-sm font-bold ${balColor}`}>{annualBal >= 0 ? '+' : '-'}{Math.floor(Math.abs(annualBal))}h {Math.round((Math.abs(annualBal) % 1) * 60)}m</p>
                              </div>
                            </div>
                            {/* Barra de progreso anual */}
                            <div className="h-2 bg-slate-700/80 rounded-full overflow-hidden my-3 shrink-0">
                              <div className={`h-full rounded-full transition-all duration-1000 ${annualPct >= 100 ? 'bg-emerald-500' : 'bg-[#135bec]'}`} style={{ width: `${annualPct}%` }} />
                            </div>
                            {/* Barras mensuales — llenan el espacio restante */}
                            <div className="flex-1 min-h-0 flex items-end gap-1 pb-1">
                              {monthNames.map((name, i) => {
                                const planned   = monthlyPlanned[i];
                                const worked    = monthlyWorked[i];
                                const barHPct   = planned > 0 ? Math.max(8, Math.round((planned / maxPlanned) * 100)) : 8;
                                const fillPct   = planned > 0 ? Math.min(100, (worked / planned) * 100) : 0;
                                const isCurrent = i === currentMonth;
                                const isFuture  = i > currentMonth;
                                return (
                                  <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                                    <div className="w-full relative rounded-t overflow-hidden bg-slate-700/40" style={{ height: `${barHPct}%` }}>
                                      {!isFuture && planned > 0 && (
                                        <div
                                          className={`absolute bottom-0 left-0 right-0 transition-all duration-700 ${fillPct >= 100 ? 'bg-emerald-500' : isCurrent ? 'bg-[#135bec]' : 'bg-[#135bec]/60'}`}
                                          style={{ height: `${fillPct}%` }}
                                        />
                                      )}
                                    </div>
                                    <span className={`text-xs font-bold ${isCurrent ? 'text-primary' : isFuture ? 'text-slate-700' : 'text-slate-500'}`}>{name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                  </div>
                </div>
              )}

              {/* TAB: AUSENCIAS */}
              {activeTab === 'absences' && (() => {
                const today = isoDateLocal(new Date());
                const TYPE_META: Record<string, { label: string; icon: string }> = {
                  vacation:      { label: 'Vacaciones',         icon: 'beach_access'     },
                  medical:       { label: 'Baja Médica',        icon: 'medical_services' },
                  manual_paid:   { label: 'Permiso Retribuido', icon: 'work_off'         },
                  manual_unpaid: { label: 'Asuntos Propios',    icon: 'event_busy'       },
                };
                const getEffectiveStatus = (a: any) =>
                  a.status === 'approved' && a.end_date < today ? 'enjoyed' : a.status;
                const STATUS_META: Record<string, { label: string; classes: string }> = {
                  pending:  { label: 'Pendiente',  classes: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'   },
                  approved: { label: 'Aprobada',   classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
                  enjoyed:  { label: 'Disfrutada', classes: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'       },
                  rejected: { label: 'Denegada',   classes: 'bg-red-500/10 text-red-400 border border-red-500/20'          },
                };
                const FILTERS = [
                  { key: 'all',      label: 'Todas'      },
                  { key: 'pending',  label: 'Pendientes' },
                  { key: 'approved', label: 'Aprobadas'  },
                  { key: 'enjoyed',  label: 'Disfrutadas'},
                  { key: 'rejected', label: 'Denegadas'  },
                ] as const;
                const filtered = absencesList.filter(a =>
                  absencesFilter === 'all' ? true : getEffectiveStatus(a) === absencesFilter
                );
                const diffDays = (s: string, e: string) => {
                  const ms = new Date(e).getTime() - new Date(s).getTime();
                  return Math.round(ms / 86400000) + 1;
                };
                return (
                  <div className="flex-1 flex overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* ── Columna izquierda: formulario (igual que la App) ── */}
                    <div className="w-[400px] shrink-0 flex flex-col border-r border-slate-700/40 overflow-y-auto custom-scrollbar">
                      {/* Cabecera */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40 shrink-0">
                        <h2 className="text-base font-bold text-white">Nueva Solicitud</h2>
                      </div>

                      {absenceSuccessMsg ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 animate-in zoom-in duration-300">
                          <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-[28px]">check</span>
                          </div>
                          <p className="text-emerald-400 font-bold text-base">¡Solicitud enviada!</p>
                          <p className="text-slate-500 text-xs text-center">Tu responsable la revisará pronto.</p>
                        </div>
                      ) : (
                        <div className="px-5 py-4 space-y-4">
                          {/* Tipo de permiso */}
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Tipo de permiso</label>
                            <div className="space-y-2">
                              {[
                                { id: 'vacation',      label: 'Vacaciones',           icon: 'beach_access'     },
                                { id: 'manual_paid',   label: 'Permiso Retribuido',   icon: 'work_off'         },
                                { id: 'manual_unpaid', label: 'Permiso No Retribuido', icon: 'event_busy'      },
                              ].map(t => (
                                <button key={t.id} type="button" onClick={() => setAbsenceType(t.id)}
                                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${absenceType === t.id ? 'border-primary bg-primary/10' : 'border-slate-700 hover:border-slate-600'}`}>
                                  <span className={`material-symbols-outlined text-[20px] ${absenceType === t.id ? 'text-primary' : 'text-slate-400'}`}>{t.icon}</span>
                                  <span className={`text-sm font-medium flex-1 ${absenceType === t.id ? 'text-primary' : 'text-slate-300'}`}>{t.label}</span>
                                  {absenceType === t.id && <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Fechas */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Desde</label>
                              <input type="date" value={absenceStartDate}
                                onChange={e => { setAbsenceStartDate(e.target.value); if (absenceEndDate < e.target.value) setAbsenceEndDate(e.target.value); }}
                                onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                                style={{ colorScheme: 'dark' }}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Hasta</label>
                              <input type="date" value={absenceEndDate} min={absenceStartDate}
                                onChange={e => setAbsenceEndDate(e.target.value)}
                                onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                                style={{ colorScheme: 'dark' }}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                            </div>
                          </div>

                          {/* Motivo */}
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                              Motivo <span className="normal-case font-normal">(opcional)</span>
                            </label>
                            <textarea value={absenceReason} onChange={e => setAbsenceReason(e.target.value)}
                              placeholder="Describe brevemente el motivo..."
                              rows={3}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-white/5 text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none placeholder:text-slate-500" />
                          </div>

                          {error && (
                            <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
                          )}

                          {/* Enviar */}
                          <button onClick={handleAbsenceSubmit} disabled={absenceSubmitting || !absenceStartDate || !absenceEndDate}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-primary/30 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm shadow-primary/30 transition-all active:scale-[0.98]">
                            {absenceSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span className="material-symbols-outlined text-[18px]">send</span>Enviar solicitud</>}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Columna derecha: listado ── */}
                    <div className="flex-1 flex flex-col overflow-hidden p-6">
                      <div className="flex items-center justify-between mb-4 shrink-0">
                        <div>
                          <p className="text-base font-bold text-white">Mis Ausencias</p>
                          <p className="text-xs text-slate-500">{absencesList.length} solicitudes en total</p>
                        </div>
                        {loadingAbsences && <span className="material-symbols-outlined text-slate-600 animate-spin text-[20px]">progress_activity</span>}
                      </div>

                      {/* Filtros */}
                      <div className="flex gap-2 mb-4 shrink-0 flex-wrap">
                        {FILTERS.map(f => (
                          <button key={f.key} type="button" onClick={() => setAbsencesFilter(f.key)}
                            className={`px-3 py-2.5 rounded-full text-sm font-bold transition-all border ${absencesFilter === f.key ? 'bg-primary text-white border-transparent shadow-md shadow-primary/20' : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:text-white hover:border-slate-600'}`}>
                            {f.label}
                            {f.key !== 'all' && (
                              <span className="ml-1.5 opacity-60">
                                {absencesList.filter(a => getEffectiveStatus(a) === f.key).length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Lista */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {filtered.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                            <span className="material-symbols-outlined text-4xl">event_busy</span>
                            <p className="text-sm font-medium">Sin ausencias en esta categoría</p>
                          </div>
                        ) : filtered.map(a => {
                          const meta   = TYPE_META[a.type] || { label: a.type, icon: 'event_note' };
                          const status = getEffectiveStatus(a);
                          const sMeta  = STATUS_META[status] || STATUS_META.pending;
                          const days   = diffDays(a.start_date, a.end_date);
                          return (
                            <div key={a.id} className="flex items-center gap-3 p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/30">
                              <div className="w-9 h-9 bg-slate-700/60 rounded-xl flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-slate-300 text-[18px]">{meta.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white leading-tight truncate">{meta.label}</p>
                                <p className="text-sm text-slate-500 mt-0.5">
                                  {a.start_date} → {a.end_date}
                                  <span className="ml-1.5 text-slate-600">· {days} día{days !== 1 ? 's' : ''}</span>
                                </p>
                              </div>
                              <span className={`px-3 py-1.5 rounded-full text-sm font-bold shrink-0 ${sMeta.classes}`}>
                                {sMeta.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                );
              })()}

            </div>
          </div>
        )}

        {/* Success Modal */}
        {successMessage && (
          <div className="w-full max-w-md bg-emerald-500 rounded-[2.5rem] p-10 shadow-2xl shadow-emerald-500/20 animate-in fade-in zoom-in duration-300 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">¡Registrado!</h2>
            <p className="text-emerald-50 text-lg font-medium mb-6">
              Fichaje completado a las {successMessage.time}
            </p>
            <div className="w-full h-1 bg-emerald-400/50 rounded-full overflow-hidden mb-6">
               <div className="h-full bg-white animate-[shrink_3s_linear_forwards]" />
            </div>
            
            <button
              onClick={() => {
                if (successTimeoutId) clearTimeout(successTimeoutId);
                setSuccessMessage(null);
                handleValidate();
              }}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              Volver al panel
            </button>
          </div>
        )}

        {/* Manual Entry Modal */}
        {showManualModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-800 rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                <h3 className="text-xl font-bold text-white">Añadir Registro Manual</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualModal(false);
                    setManualContextText("");
                  }}
                  className="p-2 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveManualEntry} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Tipo de Registro
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* ENTRADA */}
                    <button
                      type="button"
                      disabled={!canClockIn}
                      onClick={() => setManualEntryType("clock-in")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border ${
                        manualEntryType === "clock-in"
                          ? "bg-[#135bec] text-white border-white ring-2 ring-blue-400/50 shadow-lg shadow-blue-900/30"
                          : "bg-[#135bec] text-white/70 border-transparent hover:border-white/20"
                      } ${!canClockIn ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">login</span>
                      Entrada
                    </button>

                    {/* SALIDA */}
                    <button
                      type="button"
                      disabled={!canClockOut}
                      onClick={() => setManualEntryType("clock-out")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border ${
                        manualEntryType === "clock-out"
                          ? "bg-[#475569] text-white border-white ring-2 ring-slate-400/50 shadow-lg shadow-slate-900/30"
                          : "bg-[#475569] text-white/70 border-transparent hover:border-white/20"
                      } ${!canClockOut ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Salida
                    </button>

                    {/* DESCANSO / TERMINAR DESCANSO */}
                    <button
                      type="button"
                      disabled={!canBreakStart && !canBreakEnd}
                      onClick={() => setManualEntryType(canBreakStart ? "break-start" : "break-end")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border ${
                        (manualEntryType === "break-start" || manualEntryType === "break-end")
                          ? "bg-[#f59e0b] text-white border-white ring-2 ring-amber-400/50 shadow-lg shadow-amber-900/30"
                          : "bg-[#f59e0b] text-white/70 border-transparent hover:border-white/20"
                      } ${(!canBreakStart && !canBreakEnd) ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {canBreakStart ? "coffee" : "play_arrow"}
                      </span>
                      {canBreakStart ? "Descanso" : "Terminar Descanso"}
                    </button>

                    {/* PERMISO / TERMINAR PERMISO */}
                    <button
                      type="button"
                      disabled={!canPermissionStart && !canPermissionEnd}
                      onClick={() => setManualEntryType(canPermissionStart ? "permission-start" : "permission-end")}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border ${
                        (manualEntryType === "permission-start" || manualEntryType === "permission-end" || manualEntryType === "others-out" || manualEntryType === "others-in")
                          ? "bg-[#ec4899] text-white border-white ring-2 ring-pink-400/50 shadow-lg shadow-pink-900/30"
                          : "bg-[#ec4899] text-white/70 border-transparent hover:border-white/20"
                      } ${(!canPermissionStart && !canPermissionEnd) ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {canPermissionEnd ? "history_edu" : "edit_note"}
                      </span>
                      {canPermissionEnd ? "Terminar Permiso" : "Permiso"}
                    </button>
                  </div>
                </div>

                {(manualEntryType === "permission-start" || manualEntryType === "others-out") && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Contexto / Motivo</label>
                    <input
                      type="text"
                      placeholder="Ej: Visita médica, Diligencia..."
                      value={manualContextText}
                      onChange={(e) => setManualContextText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-colors"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Fecha</label>
                    <input
                      required
                      type="date"
                      value={manualEntryDate}
                      onChange={(e) => setManualEntryDate(e.target.value)}
                      onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Hora</label>
                    <input
                      required
                      type="time"
                      value={manualEntryTime}
                      onChange={(e) => setManualEntryTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualModal(false);
                      setManualContextText("");
                    }}
                    className="flex-1 py-4 px-4 rounded-xl text-center text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={manualSaving}
                    className={`flex-1 py-4 px-4 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:opacity-90 flex justify-center items-center gap-2 disabled:opacity-50 border-none cursor-pointer ${
                      manualEntryType === "clock-in"
                        ? "bg-[#135bec] hover:bg-[#0e4fc7] shadow-blue-900/30"
                        : manualEntryType === "clock-out"
                        ? "bg-[#475569] hover:bg-[#334155] shadow-slate-900/30"
                        : manualEntryType === "break-start" || manualEntryType === "break-end"
                        ? "bg-[#f59e0b] hover:bg-[#d97706] shadow-amber-900/30"
                        : manualEntryType === "permission-start" || manualEntryType === "permission-end" || manualEntryType === "others-out" || manualEntryType === "others-in"
                        ? "bg-[#ec4899] hover:bg-[#db2777] shadow-pink-900/30"
                        : "bg-[#135bec] hover:bg-[#0e4fc7] shadow-blue-900/30"
                    }`}
                  >
                    {manualSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Exit PIN Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-700 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-white text-center mb-2">Desbloquear Kiosko</h2>
            <p className="text-slate-400 text-center mb-6 text-sm">
              Introduce el PIN de 4 dígitos que configuraste para salir.
            </p>

            <div className="mb-6">
              <input
                type="password"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={exitPin}
                onChange={(e) => {
                  setExitError(false);
                  setExitPin(e.target.value.replace(/\D/g, ''));
                }}
                className={`w-full text-center tracking-[1em] text-3xl py-4 bg-slate-900 border ${exitError ? 'border-red-500' : 'border-slate-700'} rounded-xl text-white focus:outline-none focus:ring-2 ${exitError ? 'focus:ring-red-500/50' : 'focus:ring-primary/50'} placeholder:tracking-normal`}
              />
              {exitError && <p className="text-red-400 text-sm text-center mt-2 font-medium">PIN incorrecto</p>}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setShowExitModal(false);
                  setExitPin('');
                  setExitError(false);
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  const savedPin = localStorage.getItem('kiosk_pin');
                  if (exitPin === savedPin) {
                    navigate('/');
                  } else {
                    setExitError(true);
                  }
                }}
                disabled={exitPin.length !== 4}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
