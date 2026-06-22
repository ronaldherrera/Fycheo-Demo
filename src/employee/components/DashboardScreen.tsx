/**
 * DashboardScreen.tsx (arreglado)
 *
 * Cambios clave:
 * - Elimina duplicado de lastOthersEntry (había 2 useMemo con mismo nombre).
 * - lastOthersEntry tipado: useMemo<TimeEntry | null>()
 * - Quita dependencia de eventTimeMs antes de declararse.
 * - Botones "Otros" del modal con type="button" + disabled + estilo opaco.
 */

import React, { useEffect, useMemo, useState, useContext, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from '../EmployeeApp';
import { useNotifications } from "../contexts/NotificationsContext";
import { supabase } from "../services/supabase";
import { adjustDataToCurrentDate, deAdjustISOString } from "../../lib/date-adjuster";
import { startBreakNotification, stopBreakNotification } from "../services/breakNotification";
import { DEFAULT_AVATAR } from "../constants";
import { Logo } from "./Logo";
import ChatPanel from "./ChatPanel";
import TasksPanel from "./TasksPanel";

type EntryType =
  | "clock-in"
  | "clock-out"
  | "break-start"
  | "break-end"
  | "others-in"
  | "others-out";

type TimeEntry = {
  id: string;
  user_id: string;
  occurred_at: string | null;
  date?: string | null;
  entry_time?: string | null;
  entry_type: EntryType | string | null;
  description: string | null;
  minutes?: number | null;
  created_at: string;
  companies?: { name: string }[] | null;
  status?: string | null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const nowHHMM = () => {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const startOfWeekMonday = (d: Date) => {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfYear = (d: Date) => {
  const date = new Date(d.getFullYear(), 0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const minutesToLabel = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const saveButtonClasses = (type: EntryType) => {
  switch (type) {
    case "clock-in":
      return "bg-primary shadow-primary/25";
    case "clock-out":
      return "bg-slate-600 shadow-slate-600/25";
    case "break-start":
      return "bg-amber-500 shadow-amber-500/25";
    case "break-end":
      return "bg-amber-500 shadow-amber-500/25";
    case "others-in":
    case "others-out":
      return "bg-pink-500 shadow-pink-500/25";
    default:
      return "bg-primary shadow-primary/25";
  }
};

const typeMeta = (t: string | null | undefined) => {
  const type = (t ?? "").toLowerCase();
  switch (type) {
    case "clock-in":
      return { label: "Entrada trabajo", icon: "login", color: "primary" as const };
    case "clock-out":
      return { label: "Salida trabajo", icon: "logout", color: "slate" as const };
    case "break-start":
      return {
        label: "Inicio descanso",
        icon: "coffee",
        color: "amber" as const,
      };
    case "break-end":
      return {
        label: "Entrada trabajo",
        icon: "login",
        color: "primary" as const,
      };
    case "others-in":
      return {
        label: "Entrada trabajo",
        icon: "login",
        color: "primary" as const,
      };
    case "others-out":
      return {
        label: "Permiso",
        icon: "edit_note",
        color: "pink" as const,
      };
    default:
      return { label: "Registro", icon: "schedule", color: "primary" as const };
  }
};

const colorClasses = (
  c: "primary" | "slate" | "amber" | "emerald" | "pink",
) => {
  switch (c) {
    case "slate":
      return {
        border: "border-slate-500",
        iconBg: "bg-slate-500/10",
        iconText: "text-slate-200",
      };
    case "amber":
      return {
        border: "border-amber-500",
        iconBg: "bg-amber-500/10",
        iconText: "text-amber-200",
      };
    case "emerald":
      return {
        border: "border-emerald-500",
        iconBg: "bg-emerald-500/10",
        iconText: "text-emerald-200",
      };
    case "pink":
      return {
        border: "border-pink-500",
        iconBg: "bg-pink-500/10",
        iconText: "text-pink-200",
      };
    case "primary":
    default:
      return {
        border: "border-primary",
        iconBg: "bg-primary/10",
        iconText: "text-primary",
      };
  }
};

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AppContext);
  const { total: notifTotal } = useNotifications();

  // --- Manejo adaptativo del teclado en PWA ---
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      setViewportHeight(vv.height);
      setViewportOffsetTop(vv.offsetTop);
      const offset = window.innerHeight - vv.height;
      setKeyboardOffset(offset > 0 ? offset : 0);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Estado visual
  const [status, setStatus] = useState<"working" | "break" | "out" | "others">("out");
  const [sessionStartTime, setSessionStartTime] = useState<Date>(
    new Date(new Date().getTime() - 4.25 * 60 * 60 * 1000),
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Modal manual
  const [showModal, setShowModal] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>("clock-in");
  const [contextText, setContextText] = useState("");
  const [entryDate, setEntryDate] = useState<string>(() => isoDate(new Date()));
  const [entryTime, setEntryTime] = useState<string>(() => nowHHMM());
  const [dateTimeTouched, setDateTimeTouched] = useState(false);
  const [initialEntryDate, setInitialEntryDate] = useState<string | null>(null);
  const [initialEntryTime, setInitialEntryTime] = useState<string | null>(null);

  // Modal específico para "Salida (Otros)" - Solo motivo
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonText, setReasonText] = useState("");


  // Supabase data
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [liveMode, setLiveMode] = useState<"working" | "break" | "out" | "others">("out");
  const [liveModeSince, setLiveModeSince] = useState<Date>(new Date());

  // Estado de vinculación de empresa
  const [hasCompany, setHasCompany] = useState<boolean>(true);
  const [loadingCompanyCheck, setLoadingCompanyCheck] = useState<boolean>(true);
  const [pendingInvite, setPendingInvite] = useState<{ companyId: string; companyName: string } | null>(null);
  const [respondingInvite, setRespondingInvite] = useState<boolean>(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(null);

  // Chat efímero
  const [showChatPanel, setShowChatPanel] = useState(false);
  const showChatPanelRef = useRef(false);
  useEffect(() => { showChatPanelRef.current = showChatPanel; }, [showChatPanel]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const showTasksPanelRef = useRef(false);
  useEffect(() => { showTasksPanelRef.current = showTasksPanel; }, [showTasksPanel]);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [pendingNoticesCount, setPendingNoticesCount] = useState(0);

  const lastOpenedTasksAtRef = useRef<string | null>(null);
  const tasksChannelRef = useRef<any>(null);

  useEffect(() => {
    if (user?.user_metadata?.last_opened_tasks_at) {
      lastOpenedTasksAtRef.current = user.user_metadata.last_opened_tasks_at;
    }
  }, [user]);

  const handlePendingChange = useCallback((total: number, notices: number) => {
    setPendingTasksCount(total);
    setPendingNoticesCount(showTasksPanelRef.current ? 0 : notices);
  }, []);


  // Conteo de compañeros trabajando ahora
  const [workingCount, setWorkingCount] = useState(0);

  // ── Listener persistente de mensajes no leídos (siempre activo) ──────────
  // Carga el total inicial y se suscribe a cambios aunque el ChatPanel esté cerrado.
  useEffect(() => {
    if (!user?.id || !activeCompanyId) return;

    const loadUnreadChatCount = () => {
      supabase
        .from('ephemeral_messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('company_id', activeCompanyId)
        .is('read_at', null)
        .then(({ count }) => setUnreadChatCount(count ?? 0));
    };

    // Carga inicial: cuántos mensajes sin leer hay para este usuario
    loadUnreadChatCount();

    // Suscripción realtime: recalcular al llegar un cambio
    const channel = supabase
      .channel(`dashboard:chat:unread:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ephemeral_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as { id: string };
            supabase
              .from('ephemeral_messages')
              .update({ delivered_at: new Date().toISOString() })
              .eq('id', newMsg.id);
          }
          
          if (!showChatPanelRef.current) {
            loadUnreadChatCount();
          } else {
            setUnreadChatCount(0);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeCompanyId]);



  // --- Funciones controladas para paneles con desenfoque de teclado (blur) ---
  const closeChatPanel = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowChatPanel(false);
  };

  const closeTasksPanel = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowTasksPanel(false);
    
    const nowStr = new Date().toISOString();
    lastOpenedTasksAtRef.current = nowStr;
    supabase.auth.updateUser({ data: { last_opened_tasks_at: nowStr } });
    
    if (tasksChannelRef.current) {
      tasksChannelRef.current.send({
        type: 'broadcast',
        event: 'tasks_opened',
        payload: { openedAt: nowStr }
      });
    }
    setPendingNoticesCount(0);
  };

  const handleToggleChatPanel = () => {
    if (showChatPanel) {
      closeChatPanel();
    } else {
      setShowChatPanel(true);
      setShowTasksPanel(false); // Asegura cerrar el otro
    }
  };

  const handleToggleTasksPanel = () => {
    if (showTasksPanel) {
      closeTasksPanel();
    } else {
      const nowStr = new Date().toISOString();
      lastOpenedTasksAtRef.current = nowStr;
      supabase.auth.updateUser({ data: { last_opened_tasks_at: nowStr } });
      
      if (tasksChannelRef.current) {
        tasksChannelRef.current.send({
          type: 'broadcast',
          event: 'tasks_opened',
          payload: { openedAt: nowStr }
        });
      }
      setPendingNoticesCount(0);
      setShowTasksPanel(true);
      setShowChatPanel(false); // Asegura cerrar el otro
    }
  };

  // --- Bloquear scroll del body y anular desplazamientos por foco en teclado ---
  useEffect(() => {
    if (showChatPanel || showTasksPanel) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Posiciona inmediatamente en (0,0)
      window.scrollTo(0, 0);

      const preventScroll = () => {
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      };

      const handleFocusIn = () => {
        // En iOS, el teclado virtual fuerza un scroll. Lo devolvemos a 0 tras unos milisegundos.
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 40);
      };

      window.addEventListener('scroll', preventScroll);
      window.addEventListener('focusin', handleFocusIn);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('scroll', preventScroll);
        window.removeEventListener('focusin', handleFocusIn);
      };
    }
  }, [showChatPanel, showTasksPanel]);

  // Soporte Offline
  const saveOfflineEntry = (payload: any) => {
    try {
      const existing = localStorage.getItem("fycheo_offline_entries");
      const list = existing ? JSON.parse(existing) : [];
      list.push(payload);
      localStorage.setItem("fycheo_offline_entries", JSON.stringify(list));
    } catch (e) {
      console.error("Error al guardar fichaje offline:", e);
    }
  };

  const syncOfflineEntries = async () => {
    const existing = localStorage.getItem("fycheo_offline_entries");
    if (!existing) return;
    try {
      const list = JSON.parse(existing);
      if (!Array.isArray(list) || list.length === 0) return;

      setMessage({
        type: "success",
        text: "Sincronizando fichajes offline guardados... 🔄",
      });

      for (const entry of list) {
        const { error } = await supabase.from("time_entries").insert(entry);
        if (error) {
          console.error("Error al sincronizar entrada offline:", error);
          if (error.message?.includes("fetch") || error.message?.includes("network")) {
            setMessage({
              type: "error",
              text: "Error de red al sincronizar. Se reintentará al recuperar conexión.",
            });
            return;
          }
        }
      }

      localStorage.removeItem("fycheo_offline_entries");
      setMessage({
        type: "success",
        text: "Fichajes sincronizados con éxito. ✅",
      });
      
      const today = isoDate(new Date());
      await loadTodayEntries(today);
      await loadLiveMode();
      await loadWeekYearTotals();
    } catch (e) {
      console.error("Error en sincronización offline:", e);
    }
  };

  useEffect(() => {
    if (navigator.onLine) {
      syncOfflineEntries();
    }
    
    const handleOnline = () => {
      syncOfflineEntries();
    };
    
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Cargar conteo de tareas y avisos pendientes
  const loadPendingTasksCount = useCallback(() => {
    if (!user?.id) return;
    supabase
      .from('tasks')
      .select('id, type, created_at')
      .eq('assigned_to', user.id)
      .eq('status', 'pending')
      .then(({ data }) => {
        const list = data || [];
        setPendingTasksCount(list.length);
        
        if (showTasksPanelRef.current) {
          setPendingNoticesCount(0);
        } else {
          const lastOpenedStr = lastOpenedTasksAtRef.current || user?.user_metadata?.last_opened_tasks_at;
          const lastOpenedTime = lastOpenedStr ? new Date(lastOpenedStr).getTime() : 0;
          const newNotices = list.filter(t => {
            const createdAtTime = new Date(t.created_at).getTime();
            return createdAtTime > lastOpenedTime;
          }).length;
          setPendingNoticesCount(newNotices);
        }
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    loadPendingTasksCount();

    const channel = supabase
      .channel('realtime_tasks_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          loadPendingTasksCount();
        }
      )
      .on(
        'broadcast',
        { event: 'tasks_opened' },
        (payload) => {
          const openedAt = payload.payload.openedAt;
          lastOpenedTasksAtRef.current = openedAt;
          if (!showTasksPanelRef.current) {
            loadPendingTasksCount();
          } else {
            setPendingNoticesCount(0);
          }
        }
      )
      .subscribe();

    tasksChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      tasksChannelRef.current = null;
    };
  }, [user?.id, loadPendingTasksCount]);

  // Cargar compañeros trabajando ahora
  const loadWorkingCount = useCallback(() => {
    if (!user?.id || !activeCompanyId) return;

    // Usar la fecha "demo" ajustada (el sistema demo puede simular otra fecha)
    const demoToday = deAdjustISOString(new Date().toISOString()).slice(0, 10);

    supabase
      .from('time_entries')
      .select('user_id, entry_type')
      .eq('company_id', activeCompanyId)
      .eq('date', demoToday)
      .neq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        // Keep only last entry per user
        const lastByUser = new Map<string, string>();
        for (const e of data) {
          if (!lastByUser.has(e.user_id)) lastByUser.set(e.user_id, e.entry_type);
        }
        const working = [...lastByUser.values()].filter(t => t === 'clock-in' || t === 'others-in' || t === 'break-end').length;
        setWorkingCount(working);
      });
  }, [user?.id, activeCompanyId]);

  useEffect(() => {
    if (!user?.id || !activeCompanyId) return;

    loadWorkingCount();

    const channel = supabase
      .channel('realtime_working_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `company_id=eq.${activeCompanyId}`,
        },
        (payload) => {
          loadWorkingCount();
          
          // Refresco personal si el cambio en la tabla es sobre mis propios fichajes
          // (ej. el manager aprueba mi solicitud pendiente)
          const record = (payload.new as any) || (payload.old as any);
          if (record && user?.id && record.user_id === user.id) {
            const today = isoDate(new Date());
            loadTodayEntries(today).then(() => {
              // Tras cargar los de hoy, actualizamos el resto
              if (typeof loadLiveMode === 'function') loadLiveMode();
              if (typeof loadWeekYearTotals === 'function') loadWeekYearTotals();
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeCompanyId, loadWorkingCount]);


  // --- Estado lógico según últimos fichajes (para validar acciones) ---
  const currentMode = useMemo<"working" | "break" | "out" | "others">(() => {
  const ms = (e: TimeEntry) => {
    const d = e.occurred_at ? new Date(e.occurred_at) : new Date(e.created_at);
    return d.getTime();
  };

  const relevant =
    [...todayEntries]
      .filter((e) => {
        const t = (e.entry_type ?? "").toLowerCase();
        return (
          t === "clock-in" ||
          t === "clock-out" ||
          t === "break-start" ||
          t === "break-end" ||
          t === "others-out"
        );
      })
      .sort((a, b) => ms(b) - ms(a))[0] ?? null;

  if (!relevant) return "out";

  const t = (relevant.entry_type ?? "").toLowerCase();
  if (t === "clock-in") return "working";
  if (t === "break-start") return "break";
  if (t === "break-end") return "working";
  if (t === "others-out") return "others"; // Nuevo estado lógico
  if (t === "clock-out") return "out";

  return "out";
}, [todayEntries]);


  // Último registro de tipo "others-*" (del día cargado)
  const lastOthersEntry = useMemo<TimeEntry | null>(() => {
    const ms = (e: TimeEntry) => {
      const d = e.occurred_at
        ? new Date(e.occurred_at)
        : new Date(e.created_at);
      return d.getTime();
    };

    return (
      [...todayEntries]
        .filter((e) => {
          const t = (e.entry_type ?? "").toLowerCase();
          return t === "others-in" || t === "others-out";
        })
        .sort((a, b) => ms(b) - ms(a))[0] ?? null
    );
  }, [todayEntries]);

  // --- UX: habilitar/deshabilitar botones según estado lógico ---
  // --- UX: habilitar/deshabilitar botones según estado lógico ---
  const canClockIn = liveMode === "out";
  const canClockOut = liveMode === "working";
  const canBreakStart = liveMode === "working";
  const canBreakEnd = liveMode === "break";


  // Regla (Otros):
  // - Salida (Otros) solo cuando estás trabajando
  // - Entrada (Otros) solo cuando estás fuera y el último "otros" fue "others-out"
  const canOthersIn =
    liveMode === "out" &&
    !!lastOthersEntry &&
    (lastOthersEntry.entry_type ?? "").toLowerCase() === "others-out";

  const canOthersOut = liveMode === "working";

  // --- UX: sincroniza el estado visual con el estado lógico (al recargar / multi-dispositivo) ---
  useEffect(() => {
    if (status !== liveMode) {
      setStatus(liveMode);
    }
    setSessionStartTime(liveModeSince);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMode, liveModeSince]);


  const lastEntryOfType = (type: string) => {
    const t = type.toLowerCase();
    return todayEntries.find((e) => (e.entry_type ?? "").toLowerCase() === t);
  };

  const eventTimeMs = (e: TimeEntry) => {
    const d = e.occurred_at ? new Date(e.occurred_at) : new Date(e.created_at);
    return d.getTime();
  };

  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage(null);
    }, 3000); // ⏱ 3 segundos

    return () => clearTimeout(timer);
  }, [message]);

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cronómetro
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor(
        (now.getTime() - sessionStartTime.getTime()) / 1000,
      );
      setElapsedSeconds(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const formatElapsed = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  };

  const getStatusLabel = () => {
    switch (status) {
      case "working":
        return "Trabajando";
      case "break":
        return "Descanso";
      case "out":
        return "Salida";
      case "others":
        return "En Permiso";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "working":
        return "text-primary";
      case "break":
        return "text-amber-500";
      case "out":
        return "text-slate-400";
      case "others":
        return "text-pink-500";
      default:
        return "";
    }
  };

  const handleAction = (newStatus: "working" | "break" | "out" | "others") => {
    setStatus(newStatus);
    setSessionStartTime(new Date());
  };

  const formatDateShort = (date: Date) => {
    const s = date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const formatTimeShort = (date: Date) => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Totales (por ahora: sumamos minutos legacy si existieran; cuando eliminemos minutes ya lo quitamos)
  const [weekTotalMins, setWeekTotalMins] = useState(0);

  const [yearTotalMins, setYearTotalMins] = useState(0);
  
  // Totales desglozados Anual
  const [yearWorkMins, setYearWorkMins] = useState(0);
  const [yearBreakMins, setYearBreakMins] = useState(0);
  const [yearOthersMins, setYearOthersMins] = useState(0);
  const [yearOutMins, setYearOutMins] = useState(0);

  const totalsLabels = useMemo(() => {
    return {
      week: minutesToLabel(weekTotalMins),
      year: minutesToLabel(yearTotalMins),
    };
  }, [weekTotalMins, yearTotalMins]);

  // Chart decorativo
  const chartData = useMemo(
    () => {
      const totalDay = 1440; // 24h
      // Asumimos que yearWorkMins et al. ahora contienen valores DIARIOS
      const w = yearWorkMins;
      const b = yearBreakMins;
      const o = yearOthersMins;
      const trackedStats = w + b + o;
      const f = Math.max(0, totalDay - trackedStats);

      const p = (val: number) => Math.round((val / totalDay) * 100);

      return [
        { label: "Trabajando", hours: minutesToLabel(w), value: p(w), color: "#135bec" },
        { label: "Descansando", hours: minutesToLabel(b), value: p(b), color: "#f59e0b" },
        { label: "Permiso", hours: minutesToLabel(o), value: p(o), color: "#ec4899" },
        { label: "Libre", hours: minutesToLabel(f), value: p(f), color: "#475569" },
      ];
    },
    [yearWorkMins, yearBreakMins, yearOthersMins],
  );

  const renderDonut = () => {
    let cumulativePercent = 0;
    const size = 120;
    const center = size / 2;
    const radius = 45;
    const strokeWidth = 18; // Más gordo como pidió el usuario

    // Caso especial: 100% de CUALQUIER concepto
    const fullItem = chartData.find(d => d.value >= 99); 
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
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90 drop-shadow-sm"
      >
        {chartData.map((item, index) => {
           if (item.value <= 0) return null;
           
            const startPercent = cumulativePercent;
            const endPercent = cumulativePercent + item.value;
            cumulativePercent = endPercent;

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

  const loadTodayEntries = async (dateISO: string) => {
    setLoadingEntries(true);
    setMessage(null);

    const authUser = user;
    if (!authUser) {
      setLoadingEntries(false);
      setMessage({
        type: "error",
        text: "No hay sesión activa. Vuelve a iniciar sesión.",
      });
      return;
    }

    // Filtramos por el día del evento (occurred_at) usando rango (desajustamos para la BD demo)
    const start = new Date(`${dateISO}T00:00:00`);
    const end = new Date(`${dateISO}T23:59:59.999`);

    const { data, error } = await supabase
      .from("time_entries")
      .select(
        "id,user_id,occurred_at,entry_type,description,created_at,date,entry_time,minutes,company_id,status,is_manual,companies:company_id(name)",
      )
      .eq("user_id", authUser.id)
      .gte("occurred_at", deAdjustISOString(start.toISOString()))
      .lte("occurred_at", deAdjustISOString(end.toISOString()))
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    setLoadingEntries(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setTodayEntries((adjustDataToCurrentDate(data ?? []) as TimeEntry[]) ?? []);
  };



  const loadWeekYearTotals = async () => {
    const authUser = user;
    if (!authUser) return;

    const now = new Date();
    const weekStart = startOfWeekMonday(now);
    const yearStart = startOfYear(now);

    // 1. Semana: mantenemos lógica simple (o podríamos replicar la compleja si usuario quiere, pero foco es año)
    // Para no romper, dejamos la suma de "minutes" de la semana si existen, o 0.
    // (Idealmente deberíamos aplicar la misma lógica compleja a la semana, pero paso a paso)
     const { data: weekData, error: weekErr } = await supabase
      .from("time_entries")
      .select("minutes")
      .eq("user_id", authUser.id)
      .neq("status", "pending")
      .gte("occurred_at", deAdjustISOString(weekStart.toISOString()))
      .lte("occurred_at", deAdjustISOString(now.toISOString()));

    if (!weekErr) {
      const total = (weekData ?? []).reduce(
        (acc: number, row: any) => acc + (Number(row.minutes) || 0),
        0,
      );
      setWeekTotalMins(total);
    }

    // 2. Diario (Antes Año): CÁLCULO REAL ITERATIVO (HOY)
    // Recuperamos TODAS las entradas de HOY ordenadas cronológicamente
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check initial state from BEFORE today? 
    // Ideally yes, but for simplicity we assume 'out' or fetch last entry before today.
    // Let's try to fetch last entry before today to be clearer?
    // For now, let's proceed with current logic but scoped to today.
    
    const { data: rawDayEntries, error: dayEntriesErr } = await supabase
      .from("time_entries")
      .select("entry_type, occurred_at, created_at, status")
      .eq("user_id", authUser.id)
      .neq("status", "pending")
      .gte("occurred_at", deAdjustISOString(dayStart.toISOString()))
      .lte("occurred_at", deAdjustISOString(now.toISOString()))
      .order("occurred_at", { ascending: true }); // Importante: ascendente para reconstruir historia
    const dayEntries = adjustDataToCurrentDate(rawDayEntries);

    if (dayEntriesErr || !dayEntries) return;

    let wMins = 0;
    let bMins = 0;
    let oMins = 0;
    
    // Estado inicial al principio del día
    // (Asumimos 'out' si no hay registros o deberíamos buscar el último de ayer... 
    //  Si el usuarió fichó ayer y no salió, hoy amanecería trabajando. 
    //  Simplificación: 'out')
    let lastState: "working" | "break" | "others" | "out" = "out";
    let lastTime = dayStart.getTime(); 

    // Helper para mapear tipo a estado
    const mapTypeToState = (type: string): "working" | "break" | "others" | "out" => {
       const t = type.toLowerCase();
       if (t === "clock-in") return "working";
       if (t === "break-start") return "break";
       if (t === "break-end") return "working"; // Vuele a trabajar
       if (t === "others-out") return "others";
       if (t === "others-in") return "working"; // Vuelve a trabajar
       if (t === "clock-out") return "out";
       return "out"; 
    };

    // INTENTO DE MEJORA: Buscar estado inicial real si hay entradas previas hoy? No, "dayEntries" son las de hoy.
    // Si queremos precisión de turno nocturno, deberíamos consultar último estado antes de dayStart.
    // (Dejamos pendiente si el usuario lo pide).

    for (const e of dayEntries) {
       const eTime = e.occurred_at ? new Date(e.occurred_at).getTime() : new Date(e.created_at).getTime();
       
       // Calcular delta desde el último evento
       const diffMins = Math.floor((eTime - lastTime) / 1000 / 60);
       
       if (diffMins > 0) {
          if (lastState === "working") wMins += diffMins;
          else if (lastState === "break") bMins += diffMins;
          else if (lastState === "others") oMins += diffMins;
       }

       // Actualizar estado y tiempo
       lastState = mapTypeToState(e.entry_type ?? "");
       lastTime = eTime;
    }

    // Sumar tramo final hasta AHORA
    const nowTime = now.getTime();
    const finalDiff = Math.floor((nowTime - lastTime) / 1000 / 60);
    if (finalDiff > 0) {
        if (lastState === "working") wMins += finalDiff;
        else if (lastState === "break") bMins += finalDiff;
        else if (lastState === "others") oMins += finalDiff;
    }

    // Calcular tiempo total del año transcurrido (para sacar 'out' por descarte o proporción)
    // REFINAMIENTO: El usuario NO quiere ver el tiempo "Fuera", solo la distribución de los registros.
    // Así que el total será la suma de los 3 estados activos.
    
    // const totalPossibleMins = Math.floor((nowTime - yearStart.getTime()) / 1000 / 60);
    // const outMins = Math.max(0, totalPossibleMins - (wMins + bMins + oMins));

    setYearWorkMins(wMins);
    setYearBreakMins(bMins);
    setYearOthersMins(oMins);
    // setYearOutMins(outMins); // Ya no se usa
    
    // Total para el gráfico = Solo la suma de actividades
    setYearTotalMins(wMins + bMins + oMins);
  };

  const checkCompanyLink = async () => {
    try {
      setLoadingCompanyCheck(true);
      if (!user) return;

      const { data, error } = await supabase
        .from('company_members')
        .select('company_id, accepted, companies:company_id(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking company link:", error);
        return;
      }

      if (data) {
        const companiesObj = Array.isArray(data.companies) 
          ? data.companies[0] 
          : data.companies;

        if (data.accepted === false) {
          // Hay una invitación pendiente
          setHasCompany(false);
          setPendingInvite({
            companyId: data.company_id,
            companyName: companiesObj?.name || 'Empresa sin nombre'
          });
          setActiveCompanyId(null);
          setActiveCompanyName(null);
        } else {
          // Vinculado activamente
          setHasCompany(true);
          setPendingInvite(null);
          setActiveCompanyId(data.company_id);
          setActiveCompanyName(companiesObj?.name || 'Empresa sin nombre');
        }
      } else {
        // No hay vinculación ni invitación
        setHasCompany(false);
        setPendingInvite(null);
        setActiveCompanyId(null);
        setActiveCompanyName(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompanyCheck(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;
    try {
      setRespondingInvite(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      // 1. Aceptar en company_members
      const { error: memberError } = await supabase
        .from('company_members')
        .update({ accepted: true })
        .eq('user_id', userData.user.id)
        .eq('company_id', pendingInvite.companyId);

      if (memberError) throw memberError;

      // 2. Actualizar profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: pendingInvite.companyId,
          role: 'employee'
        })
        .eq('id', userData.user.id);

      if (profileError) {
        console.error("Error updating profile with accepted company:", profileError);
      }

      setMessage({ type: 'success', text: `¡Te has unido a ${pendingInvite.companyName}! 🎉` });
      setPendingInvite(null);
      setHasCompany(true);
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: e.message || 'Error al aceptar la invitación.' });
    } finally {
      setRespondingInvite(false);
    }
  };

  const handleRejectInvite = async () => {
    if (!pendingInvite) return;
    if (!window.confirm(`¿Estás seguro de que deseas rechazar la invitación de la empresa "${pendingInvite.companyName}"?`)) {
      return;
    }

    try {
      setRespondingInvite(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      // Eliminar de company_members
      const { error: memberError } = await supabase
        .from('company_members')
        .delete()
        .eq('user_id', userData.user.id)
        .eq('company_id', pendingInvite.companyId);

      if (memberError) throw memberError;

      setMessage({ type: 'success', text: `Invitación rechazada.` });
      setPendingInvite(null);
      setHasCompany(false);
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: e.message || 'Error al rechazar la invitación.' });
    } finally {
      setRespondingInvite(false);
    }
  };

  const refreshAll = async () => {
    const today = isoDate(new Date());
    setEntryDate(today);
    setEntryTime(nowHHMM());
    await checkCompanyLink();
    await loadTodayEntries(today);
    await loadLiveMode();
    await loadWeekYearTotals();
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('company_members_dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_members',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("Realtime change detected in company_members:", payload);
          await checkCompanyLink();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // --- Helpers auth / validación robusta (a prueba de multi pestaña / multi dispositivo) ---
  const getAuthUser = async () => {
    if (user) return { user, error: null };
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user)
      return { user: null as any, error: error ?? new Error("No user") };
    return { user: data.user, error: null };
  };

  const relevantTypes = [
    "clock-in",
    "clock-out",
    "break-start",
    "break-end",
    "others-out", // Necesario para detectar modo 'others'
    "others-in",
  ] as const;
  type RelevantType = (typeof relevantTypes)[number];

  const fetchLastRelevantBefore = async (
    userId: string,
    occurredAtISO: string,
  ) => {
    const { data, error } = await supabase
      .from("time_entries")
      .select("id, entry_type, occurred_at, created_at")
      .eq("user_id", userId)
      .in("entry_type", [...relevantTypes])
      .lte("occurred_at", occurredAtISO)
      .order("occurred_at", { ascending: false })
      .limit(1);

    if (error) return { row: null as any, error };
    const row = data?.[0] ? adjustDataToCurrentDate(data[0]) : null;
    return { row: row as any, error: null };
  };

  const loadLiveMode = async () => {
  const authUser = user;
  if (!authUser) return;

  const now = new Date();
  const lastRel = await fetchLastRelevantBefore(authUser.id, deAdjustISOString(now.toISOString()));
  if (lastRel.error) return;

  const lastType = (lastRel.row?.entry_type ?? "").toLowerCase();

  let mode: "working" | "break" | "out" | "others" = "out";
  if (lastType === "clock-in") mode = "working";
  else if (lastType === "break-start") mode = "break";
  else if (lastType === "break-end") mode = "working";
  else if (lastType === "others-out") mode = "others";
  else if (lastType === "clock-out") mode = "out";

  setLiveMode(mode);

  const since = lastRel.row?.occurred_at
    ? new Date(lastRel.row.occurred_at)
    : lastRel.row?.created_at
      ? new Date(lastRel.row.created_at)
      : now;

  setLiveModeSince(since);
};


  const fetchLastOfType = async (userId: string, type: string) => {
    const { data, error } = await supabase
      .from("time_entries")
      .select("id, entry_type, occurred_at, created_at")
      .eq("user_id", userId)
      .eq("entry_type", type)
      .order("occurred_at", { ascending: false })
      .limit(1);

    if (error) return { row: null as any, error };
    return { row: (data?.[0] ?? null) as any, error: null };
  };

  const msFromRow = (row: any) => {
    const d = row?.occurred_at
      ? new Date(row.occurred_at)
      : new Date(row?.created_at);
    return d.getTime();
  };

  const validateAction = async (
    userId: string,
    type: RelevantType,
    occurredAt: Date,
  ) => {
    const occurredAtISO = occurredAt.toISOString();

    // 1) Anti-duplicados "a prueba": mismo tipo en <10s mirando BD
    const lastSame = await fetchLastOfType(userId, type);
    if (lastSame.error) return { ok: false, reason: lastSame.error.message };
    if (lastSame.row) {
      const diffSeconds =
        Math.abs(msFromRow(lastSame.row) - occurredAt.getTime()) / 1000;
      if (diffSeconds < 10) {
        return {
          ok: false,
          reason: "Espera unos segundos: ya registraste esta acción.",
        };
      }
    }

    // 2) Reglas de flujo "a prueba": valida contra último relevante ANTES del occurredAt
    const lastRel = await fetchLastRelevantBefore(userId, occurredAtISO);
    if (lastRel.error) return { ok: false, reason: lastRel.error.message };

    const lastType = (lastRel.row?.entry_type ?? "") as RelevantType | "";

    // Derivar modo en ese momento
    let mode: "working" | "break" | "out" | "others" = "out";
    if (lastType === "clock-in") mode = "working";
    else if (lastType === "break-start") mode = "break";
    else if (lastType === "break-end") mode = "working";
    else if (lastType === "others-out") mode = "others";
    else if (lastType === "clock-out") mode = "out";

    if (type === "clock-in" && mode !== "out" && mode !== "break" && mode !== "others") {
      return {
        ok: false,
        reason:
          "Ya estás en jornada. Registra una salida antes de volver a entrar.",
      };
    }

    if (type === "clock-out" && mode !== "working") {
      return {
        ok: false,
        reason:
          mode === "break"
            ? "No puedes salir mientras estás en descanso. Registra primero Fin descanso."
            : "No puedes registrar salida si no estás trabajando.",
      };
    }

    if (type === "break-start" && mode !== "working") {
      return { ok: false, reason: "Debes entrar antes de iniciar descanso" };
    }
    if (type === "break-end" && mode !== "break") {
      return { ok: false, reason: "Inicia descanso antes de terminarlo" };
    }

    return { ok: true as const };
  };

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Error obteniendo localización:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const insertTimeEntryValidated = async (args: {
    type: RelevantType | EntryType;
    occurredAt: Date;
    description: string;
    dateISO: string;
    timeHHMM: string;
    isManual?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  }) => {
    setMessage(null);

    const { user: authUser, error: userErr } = await getAuthUser();
    if (userErr || !authUser) {
      setMessage({
        type: "error",
        text: "No hay sesión activa. Vuelve a iniciar sesión.",
      });
      return { ok: false };
    }

    // Solo validamos reglas para tipos relevantes (los otros no afectan al flujo)
    const lower = (args.type ?? "").toLowerCase();
    if (relevantTypes.includes(lower as any)) {
      const v = await validateAction(
        authUser.id,
        lower as RelevantType,
        args.occurredAt,
      );
      if (!v.ok) {
        setMessage({
          type: "error",
          text: (v as any).reason ?? "Acción no permitida",
        });
        return { ok: false };
      }
    }

    const payload = {
      user_id: authUser.id,
      occurred_at: args.occurredAt.toISOString(),
      date: args.dateISO,
      entry_time: args.timeHHMM,
      entry_type: args.type,
      description: args.description,
      minutes: 0,
      company_id: activeCompanyId,
      is_manual: args.isManual ?? false,
      latitude: args.latitude ?? null,
      longitude: args.longitude ?? null,
      status: (args.isManual ?? false) ? 'pending' : 'approved',
    };

    if (!navigator.onLine) {
      saveOfflineEntry(payload);
      
      // Actualizar UI localmente
      const tempEntry: TimeEntry = {
        id: Math.random().toString(36).substring(2, 9),
        user_id: authUser.id,
        occurred_at: args.occurredAt.toISOString(),
        entry_type: args.type,
        description: args.description,
        created_at: new Date().toISOString(),
        company_id: activeCompanyId,
      } as any;
      setTodayEntries(prev => [tempEntry, ...prev]);

      const insertedType = args.type.toLowerCase();
      let mode: "working" | "break" | "out" | "others" = "out";
      if (insertedType === "clock-in") mode = "working";
      else if (insertedType === "break-start") mode = "break";
      else if (insertedType === "break-end") mode = "working";
      else if (insertedType === "others-out") mode = "others";
      else if (insertedType === "clock-out") mode = "out";

      setLiveMode(mode);
      setLiveModeSince(args.occurredAt);

      setMessage({
        type: "success",
        text: "Sin conexión. Fichaje guardado localmente, se sincronizará cuando vuelvas a tener internet. 📲",
      });

      return { ok: true, offline: true };
    }

    try {
      const { data: inserted, error } = await supabase
        .from("time_entries")
        .insert(payload)
        .select("id, entry_type, occurred_at, created_at")
        .single();

      if (error) {
        if (error.message?.includes("fetch") || error.message?.includes("network") || (error as any).status === 0) {
          saveOfflineEntry(payload);
          
          // Actualizar UI localmente
          const tempEntry: TimeEntry = {
            id: Math.random().toString(36).substring(2, 9),
            user_id: authUser.id,
            occurred_at: args.occurredAt.toISOString(),
            entry_type: args.type,
            description: args.description,
            created_at: new Date().toISOString(),
            company_id: activeCompanyId,
          } as any;
          setTodayEntries(prev => [tempEntry, ...prev]);

          const insertedType = args.type.toLowerCase();
          let mode: "working" | "break" | "out" | "others" = "out";
          if (insertedType === "clock-in") mode = "working";
          else if (insertedType === "break-start") mode = "break";
          else if (insertedType === "break-end") mode = "working";
          else if (insertedType === "others-out") mode = "others";
          else if (insertedType === "clock-out") mode = "out";

          setLiveMode(mode);
          setLiveModeSince(args.occurredAt);

          setMessage({
            type: "success",
            text: "Sin conexión. Fichaje guardado localmente, se sincronizará cuando vuelvas a tener internet. 📲",
          });

          return { ok: true, offline: true };
        }

        setMessage({ type: "error", text: error.message });
        return { ok: false };
      }

      // ✅ Actualización inmediata del estado/contador (sin recargar)
      const insertedType = ((inserted?.entry_type ?? "") as string).toLowerCase();
      const insertedAt = inserted?.occurred_at
        ? new Date(inserted.occurred_at)
        : inserted?.created_at
          ? new Date(inserted.created_at)
          : args.occurredAt;

      // Solo si es un tipo relevante, es más reciente, y NO ES MANUAL (los manuales deben aprobarse primero)
      if (!args.isManual && relevantTypes.includes(insertedType as any)) {
        if (insertedAt.getTime() >= liveModeSince.getTime()) {
          let mode: "working" | "break" | "out" | "others" = "out";
          if (insertedType === "clock-in") mode = "working";
          else if (insertedType === "break-start") mode = "break";
          else if (insertedType === "break-end") mode = "working";
          else if (insertedType === "others-out") mode = "others";
          else if (insertedType === "clock-out") mode = "out";

          setLiveMode(mode);
          setLiveModeSince(insertedAt);
        }
      }

      if (args.isManual) {
        setMessage({ type: "success", text: "Solicitud enviada. Pendiente de validación ⏳" });
      } else {
        setMessage({ type: "success", text: "Registro guardado ✅" });
      }

      // 1) Actividad: siempre HOY
      const today = isoDate(new Date());
      await loadTodayEntries(today);

      // 2) Estado real: recálculo (por si había algo más reciente)
      await loadLiveMode();

      await loadWeekYearTotals();
      return { ok: true };
    } catch (e) {
      console.error(e);
      saveOfflineEntry(payload);
      
      // Actualizar UI localmente
      const tempEntry: TimeEntry = {
        id: Math.random().toString(36).substring(2, 9),
        user_id: authUser.id,
        occurred_at: args.occurredAt.toISOString(),
        entry_type: args.type,
        description: args.description,
        created_at: new Date().toISOString(),
        company_id: activeCompanyId,
      } as any;
      setTodayEntries(prev => [tempEntry, ...prev]);

      const insertedType = args.type.toLowerCase();
      let mode: "working" | "break" | "out" | "others" = "out";
      if (insertedType === "clock-in") mode = "working";
      else if (insertedType === "break-start") mode = "break";
      else if (insertedType === "break-end") mode = "working";
      else if (insertedType === "others-out") mode = "others";
      else if (insertedType === "clock-out") mode = "out";

      setLiveMode(mode);
      setLiveModeSince(args.occurredAt);

      setMessage({
        type: "success",
        text: "Sin conexión. Fichaje guardado localmente, se sincronizará cuando vuelvas a tener internet. 📲",
      });
      return { ok: true, offline: true };
    }
  };

  const quickRegister = async (
    type: "clock-in" | "clock-out" | "break-start" | "break-end",
  ) => {
    // Mantengo las validaciones inmediatas con estado local para UX rápida,
    // pero la validación real "a prueba" la hace insertTimeEntryValidated contra BD.

    if (type === "clock-in" && liveMode !== "out" && liveMode !== "break" && liveMode !== "others") {
      setMessage({
        type: "error",
        text: "Ya estás en jornada. Registra una salida antes de volver a entrar.",
      });
      return false;
    }
    if (type === "break-start" && liveMode !== "working") {
      setMessage({
        type: "error",
        text: "Debes entrar antes de inicar descanso",
      });
      return false;
    }

    if (type === "break-end" && liveMode !== "break") {
      setMessage({
        type: "error",
        text: "Inicia descanso antes de terminarlo",
      });
      return false;
    }

    if (type === "clock-out" && liveMode !== "working") {
      setMessage({
        type: "error",
        text:
          liveMode === "break"
            ? "No puedes salir mientras estás en descanso. Registra primero Fin descanso."
            : "No puedes registrar salida si no estás trabajando.",
      });
      return false;
    }

    const lastSame = lastEntryOfType(type);
    if (lastSame) {
      const diffSeconds = (Date.now() - eventTimeMs(lastSame)) / 1000;
      if (diffSeconds >= 0 && diffSeconds < 10) {
        setMessage({
          type: "error",
          text: "Espera unos segundos: ya registraste esta acción.",
        });
        return false;
      }
    }

    const now = new Date();
    const coords = await getCurrentLocation();
    const res = await insertTimeEntryValidated({
      type,
      occurredAt: now,
      description: typeMeta(type).label,
      dateISO: isoDate(now),
      timeHHMM: nowHHMM(),
      isManual: false,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    });

    return !!res.ok;
  };
  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Validación de motivo para OTROS
    if ((entryType === "others-in" || entryType === "others-out") && !contextText.trim()) {
      setMessage({ type: "error", text: "Debes indicar un contexto o motivo." });
      setSaving(false);
      return;
    }

    // Si el usuario NO tocó fecha/hora, asumimos que quiere registrar "ahora"
    const now = new Date();
    const useNow =
      !dateTimeTouched ||
      (initialEntryDate === entryDate && initialEntryTime === entryTime);


    let occurredAt: Date;
    let dateISOToSave: string;
    let timeHHMMToSave: string;

    if (useNow) {
      occurredAt = now;
      dateISOToSave = isoDate(now);
      timeHHMMToSave = nowHHMM();
    } else {
      const [y, m, d] = entryDate.split("-").map(Number);
      const [hh, mm] = entryTime.split(":").map(Number);
      occurredAt = new Date(y, m - 1, d, hh, mm, 0, 0);
      dateISOToSave = entryDate;
      timeHHMMToSave = entryTime;
    }

    if (Number.isNaN(occurredAt.getTime())) {
      setSaving(false);
      setMessage({ type: "error", text: "Fecha u hora inválida." });
      return;
    }

    const baseLabel = typeMeta(entryType).label;
    const finalDesc =
      entryType === "others-in" || entryType === "others-out"
        ? contextText.trim() || baseLabel
        : baseLabel;

    // ✅ Validación "a prueba" (BD) también para manual
    const res = await insertTimeEntryValidated({
      type: entryType,
      occurredAt,
      description: finalDesc,
      dateISO: dateISOToSave,
      timeHHMM: timeHHMMToSave,
      isManual: true, // EL BOTÓN + SIEMPRE ES MANUAL
    });

    setSaving(false);

    if (!res.ok) return;

    // Reset del modal para la próxima vez
    const n = new Date();
    setEntryDate(isoDate(n));
    setEntryTime(nowHHMM());
    setDateTimeTouched(false);

    setShowModal(false);
    setContextText("");
  };

  const handleDeleteEntry = async (id: string) => {
    setMessage(null);

    const { error } = await supabase.from("time_entries").delete().eq("id", id);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setTodayEntries((prev) => prev.filter((e) => e.id !== id));
    setMessage({ type: "success", text: "Registro eliminado" });
    await loadWeekYearTotals();
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-x-hidden min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl pb-32">
      {/* Relleno de safe area para iOS — evita que el contenido se mezcle con la status bar */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-background-light dark:bg-background-dark" style={{ height: 'env(safe-area-inset-top)' }} />
      <header className="w-full flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-4 bg-background-light dark:bg-background-dark sticky top-0 z-10">
        {/* Izquierda: Logo */}
        <div className="flex items-center justify-center">
           <Logo className="h-10 w-10 drop-shadow-md" />
        </div>

        {/* Centro: Título App */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pt-2">
           <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Fycheo
          </h2>
        </div>

        {/* Derecha: Avatar */}
        <div className="relative cursor-pointer" onClick={() => navigate("/profile")}>
          <img
            src={user.user_metadata?.avatar_url || DEFAULT_AVATAR}
            alt="Perfil"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = DEFAULT_AVATAR; }}
            className="rounded-full size-10 shadow-sm border-2 border-primary/20 hover:ring-2 hover:ring-primary/40 transition-all object-cover"
          />
          {notifTotal > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold shadow-md">
              {notifTotal > 99 ? '99+' : notifTotal}
            </span>
          )}
        </div>
      </header>

      {/* AVISOS */}
      {message && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] w-[70%] max-w-sm pointer-events-none">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold ring-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 ${
              message.type === "error"
                ? "bg-red-500/25 text-red-200 ring-red-500/100"
                : "bg-emerald-500/25 text-emerald-200 ring-emerald-500/100"
            }`}
          >
            {message.text}
          </div>
        </div>
      )}

      <main className="flex-1 px-5 flex flex-col gap-6">
        {/* Banner de Invitación de Empresa Pendiente */}
        {pendingInvite && !loadingCompanyCheck && (
          <div 
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white border border-indigo-500/30 rounded-2xl p-5 flex flex-col gap-4 shadow-xl shadow-indigo-600/10 animate-in fade-in slide-in-from-top-4 duration-300"
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-white shrink-0 text-[26px] bg-white/10 p-1.5 rounded-xl">business</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-bold tracking-tight">
                  Invitación de Empresa
                </span>
                <span className="text-xs text-indigo-100 leading-normal">
                  La empresa <strong className="text-white font-extrabold">{pendingInvite.companyName}</strong> te ha invitado a unirte a su organización como empleado. Si aceptas, podrás sincronizar tus jornadas de fichaje con su gestor.
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={handleAcceptInvite}
                disabled={respondingInvite}
                className="flex-1 bg-white text-indigo-700 hover:bg-indigo-50 font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-[0.98] border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-black/10 disabled:opacity-50"
              >
                {respondingInvite ? (
                  <div className="w-3.5 h-3.5 border-2 border-indigo-700/30 border-t-indigo-700 rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Aceptar Invitación
                  </>
                )}
              </button>
              
              <button
                onClick={handleRejectInvite}
                disabled={respondingInvite}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-transparent text-indigo-200 hover:text-white hover:bg-white/10 transition-all border-none cursor-pointer disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        )}

        {/* Timer Section */}
        <div className="flex flex-col gap-2">
          {/* Fila: fecha + botones rápidos de Compañeros y Tareas */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col text-[12px] font-bold text-slate-400 dark:text-slate-500 tracking-tighter leading-tight">
              <span>{formatDateShort(currentTime)}</span>
              <span className="text-[11px] opacity-90">{formatTimeShort(currentTime)}</span>
            </div>
            {/* Botones pequeños (solo si hay empresa activa) */}
            {activeCompanyId && (
              <div className="flex items-center gap-2">
                {/* Compañeros (Chat) */}
                <button
                  onClick={handleToggleChatPanel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 relative"
                  style={{
                    background: showChatPanel
                      ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                      : 'rgba(99,102,241,0.12)',
                    color: showChatPanel ? '#fff' : '#818cf8',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>forum</span>
                  Chat{workingCount > 0 && ` (${workingCount})`}
                  {unreadChatCount > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5,
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      color: '#fff', borderRadius: '50%',
                      minWidth: 15, height: 15, fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid #0f172a',
                    }}>
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleToggleTasksPanel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 relative"
                  style={{
                    background: showTasksPanel
                      ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                      : 'rgba(245,158,11,0.12)',
                    color: showTasksPanel ? '#fff' : '#fbbf24',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>checklist</span>
                  Tareas{pendingTasksCount > 0 && ` (${pendingTasksCount > 9 ? '9+' : pendingTasksCount})`}
                  {pendingNoticesCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 'bold',
                      borderRadius: 10,
                      width: 17,
                      height: 17,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid #0f172a',
                      lineHeight: 1,
                      boxSizing: 'border-box',
                    }}>
                      {pendingNoticesCount > 9 ? '9+' : pendingNoticesCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
          <section className="flex flex-col items-center justify-center py-10 bg-white dark:bg-surface-dark rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800/50">
          <p className="text-slate-400 text-xs font-medium">
            Tiempo en este estado
          </p>
          <h1 className={`${elapsedSeconds > 86400 && status !== 'out' ? "text-2xl" : "text-5xl"} font-black tracking-tighter tabular-nums mb-2 text-center`}>
            {elapsedSeconds > 86400 && status !== 'out'
              ? "Más de 24h"
              : formatElapsed(elapsedSeconds)}
          </h1>
          <p
            className={`text-sm font-bold uppercase tracking-widest mb-2 ${getStatusColor()}`}
          >
            {getStatusLabel()}
          </p>

          {hasCompany && activeCompanyName ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1 font-semibold">
              <span className="material-symbols-outlined text-[15px] text-slate-400 dark:text-slate-500">business</span>
              Fichando en: <strong className="text-slate-600 dark:text-slate-300 font-extrabold">{activeCompanyName}</strong>
            </p>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1 font-semibold">
              <span className="material-symbols-outlined text-[15px] text-slate-400 dark:text-slate-500">business</span>
              Sin vinculación a ninguna empresa
            </p>
          )}
        </section>
        </div>

        {/* Actions (registran en Supabase) */}
        <section className="w-full max-w-md mx-auto grid grid-cols-2 gap-4">
          <button
            disabled={!canClockIn}
            onClick={async () => {
              setRegistering("clock-in");
              const ok = await quickRegister("clock-in");
              setRegistering(null);
              if (ok) handleAction("working");
            }}
            className={`group flex flex-col items-center justify-center gap-2 p-5 rounded-xl transition-all ring-4
              ${
                canClockIn && !registering
                  ? `bg-primary shadow-lg shadow-primary/20 ${
                      status === "working"
                        ? "ring-primary/40"
                        : "ring-transparent opacity-90 hover:opacity-100"
                    }`
                  : "bg-primary shadow-none ring-transparent opacity-50 cursor-not-allowed pointer-events-none"
              }`}
          >
            <div className="size-10 rounded-full flex items-center justify-center bg-white/10">
              <span className={`material-symbols-outlined text-2xl text-white ${registering === "clock-in" ? "animate-spin" : ""}`}>
                {registering === "clock-in" ? "progress_activity" : "login"}
              </span>
            </div>
            <span className="font-bold text-sm tracking-wide text-white text-center">
              {registering === "clock-in" ? "FICHANDO" : "ENTRADA"}
            </span>
          </button>

          <button
            disabled={!canClockOut}
            onClick={async () => {
              setRegistering("clock-out");
              const ok = await quickRegister("clock-out");
              setRegistering(null);
              if (ok) handleAction("out");
            }}
            className={`group flex flex-col items-center justify-center gap-2 p-5 rounded-xl transition-all
              ${
                canClockOut && !registering
                  ? `shadow-sm cursor-pointer bg-slate-600 dark:bg-slate-700 ${
                      status === "out"
                        ? "ring-4 ring-slate-400/20"
                        : "opacity-90 hover:opacity-100"
                    }`
                  : "bg-slate-600 dark:bg-slate-700 shadow-none ring-0 opacity-50 cursor-not-allowed pointer-events-none"
              }`}
          >
            <div className="size-10 rounded-full flex items-center justify-center bg-white/10">
              <span className={`material-symbols-outlined text-2xl text-white ${registering === "clock-out" ? "animate-spin" : ""}`}>
                {registering === "clock-out" ? "progress_activity" : "logout"}
              </span>
            </div>
            <span className="font-bold text-sm tracking-wide text-white text-center">
              {registering === "clock-out" ? "FICHANDO" : "SALIDA"}
            </span>
          </button>

          <button
            disabled={!canBreakStart && !canBreakEnd}
            onClick={async () => {
              if (canBreakEnd) {
                setRegistering("break-end");
                const ok = await quickRegister("clock-in");
                setRegistering(null);
                if (ok) {
                  handleAction("working");
                  stopBreakNotification();
                }
              } else {
                setRegistering("break-start");
                const ok = await quickRegister("break-start");
                setRegistering(null);
                if (ok) {
                  handleAction("break");
                  startBreakNotification();
                }
              }
            }}
            className={`group flex flex-col items-center justify-center gap-2 p-5 rounded-xl transition-all ring-4
              ${
                (canBreakStart || canBreakEnd) && !registering
                  ? `bg-amber-500 shadow-lg shadow-amber-500/20 ${
                      canBreakEnd
                        ? "ring-amber-400/50 ring-4"
                        : "ring-transparent opacity-90 hover:opacity-100"
                    }`
                  : "bg-amber-500 shadow-none ring-transparent opacity-50 cursor-not-allowed pointer-events-none"
              }`}
          >
            <div className="size-10 rounded-full flex items-center justify-center bg-white/10">
              <span className={`material-symbols-outlined text-2xl text-white ${(registering === "break-start" || registering === "break-end") ? "animate-spin" : ""}`}>
                {(registering === "break-start" || registering === "break-end") ? "progress_activity" : canBreakEnd ? "play_arrow" : "coffee"}
              </span>
            </div>
            <span className="font-bold text-sm tracking-wide leading-none text-center text-white">
              {(registering === "break-start" || registering === "break-end") ? "FICHANDO" : canBreakEnd ? "FIN DESCANSO" : "DESCANSO"}
            </span>
          </button>

          <button
            disabled={!canOthersOut && liveMode !== "others"}
            onClick={async () => {
              if (liveMode === "others") {
                const ok = await quickRegister("clock-in");
                if (ok) handleAction("working");
              } else {
                setReasonText("");
                setShowReasonModal(true);
              }
            }}
            className={`group flex flex-col items-center justify-center gap-2 p-5 rounded-xl bg-pink-500 active:scale-95 transition-all shadow-lg shadow-pink-500/25 cursor-pointer ${
              !canOthersOut && liveMode !== "others"
                ? "opacity-40 cursor-not-allowed pointer-events-none"
                : liveMode === "others"
                  ? "ring-4 ring-pink-400/50 hover:bg-pink-600"
                  : "hover:bg-pink-600"
            }`}
          >
            <div className="size-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <span className="material-symbols-outlined text-white text-2xl">
                {liveMode === "others" ? "play_arrow" : "edit_note"}
              </span>
            </div>
            <span className="text-white font-bold text-sm tracking-wide leading-none text-center">
              {liveMode === "others" ? "FIN PERMISO" : "PERMISO"}
            </span>
          </button>
        </section>

        {/* Activity (icono + borde por contexto; sin minutos) */}
        <section className="w-full max-w-md mx-auto mt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Actividad del Día Actual
            </h4>
            <button
              type="button"
              onClick={() => loadTodayEntries(isoDate(new Date()))}

              className="text-xs font-bold text-primary hover:opacity-80 transition-opacity"
            >
              {loadingEntries ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {todayEntries.length === 0 && !loadingEntries ? (
              <div className="p-4 rounded-xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 text-sm font-medium">
                Aún no hay registros hoy. Pulsa el botón + para añadir uno.
              </div>
            ) : (
              todayEntries.map((e, idx) => {
                const meta = typeMeta(e.entry_type);
                const c = colorClasses(meta.color);

                const occurred = e.occurred_at
                  ? new Date(e.occurred_at)
                  : new Date(e.created_at);
                const timeCell = occurred.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                // Cálculo de duración (tiempo en ese estado)
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
                  // El evento "siguiente" en cronología es el índice anterior en la lista (porque está ordenado descendente)
                  const parsedNext =
                    idx > 0 ? todayEntries[idx - 1] : null;

                  let msNext = new Date().getTime(); // Por defecto "ahora" si es el último
                  if (parsedNext) {
                    msNext = parsedNext.occurred_at
                      ? new Date(parsedNext.occurred_at).getTime()
                      : new Date(parsedNext.created_at).getTime();
                  }
                  
                  // Si el registro NO es el más reciente (idx > 0) y no hay "next" (caso raro si hay >1), no calculamos (o usamos ahora? no, debería haber previo si idx>0)
                  // idx=0 es el mas reciente. idx=1 es anterior. 
                  // "next" cronológico es idx-1 (el mas nuevo).
                  // Ej: [10:00, 09:00]. idx=1 (09:00). Next=idx-1=0 (10:00). Diff=1h.
                  
                  const diff = msNext - msCurrent;
                  if (diff > 0) {
                     durationLabel = minutesToLabel(Math.floor(diff / 1000 / 60));
                  }
                }

                // Ocultar "break-end" y "others-in" de la lista visual (limpieza)
                // Se muestran todos (incluyendo break-end y others-in)
                // if (
                //   (e.entry_type ?? "").toLowerCase() === "break-end" ||
                //   (e.entry_type ?? "").toLowerCase() === "others-in"
                // ) {
                //   return null;
                // }

                // Títulos de estado específicos
                const stateTitles: Record<string, string> = {
                  "clock-in": "Trabajando",
                  "clock-out": "Salida",
                  "break-start": "Descanso",
                  "break-end": "Trabajando", // Unificado visualmente
                  "others-in": "Trabajando",
                };

                const typeKey = (e.entry_type ?? "").toLowerCase();
                const isStandard = Object.keys(stateTitles).includes(typeKey);

                let displayLabel = isStandard
                  ? stateTitles[typeKey]
                  : e.description ?? meta.label;
                
                // Si es "others-out", mostramos la descripción limpia (el motivo)
                if (typeKey === "others-out") {
                   const rawDesc = e.description || "";
                   displayLabel = rawDesc.replace(/^Permiso:\s*/i, "").replace(/^Salida:\s*/i, "") || "Permiso";
                }

                // Lógica de tarjetas INTERACTIVAS (Estados activos)
                
                // 1. DESCANSANDO (RESTAURADO: Tarjeta Amarilla Interactiva)
                const isActiveBreakCard =
                  idx === 0 &&
                  typeKey === "break-start";

                if (isActiveBreakCard) {
                  return (
                    <div
                      key={e.id}
                      onClick={async () => {
                         if (registering) return;
                         setRegistering("break-end");
                         const ok = await quickRegister("clock-in");
                         setRegistering(null);
                         if (ok) {
                           handleAction("working");
                           stopBreakNotification();
                         }
                      }}
                      className={`group flex items-center gap-4 p-3 rounded-xl border-l-4 border-amber-500 bg-amber-500 shadow-md shadow-amber-500/20 animate-fadeInUp active:scale-[0.99] ${registering ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}
                    >
                      <div className="size-10 rounded-full bg-black/10 flex items-center justify-center shrink-0 group-hover:bg-black/20 transition-colors">
                        <span className={`material-symbols-outlined text-xl text-slate-900 ${registering === "break-end" ? "animate-spin" : ""}`}>
                          {registering === "break-end" ? "progress_activity" : "play_arrow"}
                        </span>
                      </div>

                      <div className="flex-1 flex justify-center">
                        <p className="font-bold text-slate-900 text-base">
                          {registering === "break-end" ? "Fichando" : "Terminar descanso"}
                        </p>
                      </div>

                      {durationLabel && (
                        <div className="text-right">
                           <span className="text-xs font-bold text-slate-900 bg-white/20 px-2 py-1 rounded-md">
                             {durationLabel}
                           </span>
                        </div>
                      )}
                    </div>
                  );
                }

                // 2. SALIDA (OTROS)
                const isActiveOthersOut = idx === 0 && typeKey === "others-out";

                if (isActiveOthersOut) {
                   return (
                    <div
                      key={e.id}
                      onClick={async () => {
                        // Registrar vuelta como "clock-in" (Entrada Trabajo)
                        // Para unificar flujo según petición usuario.
                        const ok = await quickRegister("clock-in");
                        if (ok) handleAction("working");
                      }}
                      className="group flex items-center gap-4 p-3 rounded-xl border-l-4 border-pink-600 bg-pink-500 shadow-md shadow-pink-500/20 cursor-pointer animate-fadeInUp active:scale-[0.99]"
                      style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}
                    >
                      <div
                        className="size-10 rounded-full bg-black/10 flex items-center justify-center shrink-0 group-hover:bg-black/20 transition-colors"
                      >
                         {/* Icono de vuelta */}
                        <span
                          className="material-symbols-outlined text-xl text-slate-900"
                        >
                          play_arrow
                        </span>
                      </div>

                      <div className="flex-1 flex justify-center">
                        <p className="font-bold text-slate-900 text-base">
                          Terminar permiso
                        </p>
                      </div>

                      {durationLabel && (
                        <div className="text-right">
                           <span className="text-xs font-bold text-slate-900 bg-white/20 px-2 py-1 rounded-md">
                             {durationLabel}
                           </span>
                        </div>
                      )}
                    </div>
                   );
                }
                
                // Renderizado normal (historial)
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-4 p-3 rounded-xl border-l-4 ${c.border} bg-white dark:bg-surface-dark shadow-sm animate-fadeInUp`}
                    style={{ animationDelay: `${idx * 0.05}s`, animationFillMode: 'both' }}
                  >
                    <div
                      className={`size-10 rounded-full ${c.iconBg} flex items-center justify-center shrink-0`}
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${c.iconText}`}
                      >
                        {meta.icon}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          {displayLabel}
                        </p>
                        {e.companies?.[0]?.name && (
                          <span className="text-[9px] font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded-md leading-none">
                            {e.companies[0].name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          {timeCell} • {meta.label}
                        </p>
                        {e.status === 'pending' && (
                          <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md border border-amber-500/20 leading-none flex items-center gap-0.5">
                            Pendiente
                          </span>
                        )}
                      </div>
                    </div>

                    {durationLabel && (
                      <div className="text-right">
                         <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                           {durationLabel}
                         </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Chart (decorativo) */}
        <section className="bg-white dark:bg-surface-dark p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm mb-4">
          <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-5">
            Distribución del Día
          </h4>
          <div className="flex items-center justify-around gap-4">
            <div className="relative flex items-center justify-center">
              {renderDonut()}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  Total
                </span>
                <span className="text-base font-black tracking-tight leading-none">
                  {totalsLabels.year}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 flex-1 w-full ml-4">
              {chartData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 shrink-0 ml-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.hours}</span>
                    <span className="text-[9px] font-light text-slate-400 dark:text-slate-500">
                      {item.value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Backdrop global opaco para el Chat (tapa el dashboard por completo) */}
      {showChatPanel && activeCompanyId && (
        <div
          onClick={closeChatPanel}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#060e1c',
            zIndex: 48,
          }}
        />
      )}

      {/* Chat Panel Drawer */}
      {showChatPanel && activeCompanyId && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            top: `${viewportOffsetTop}px`,
            bottom: 'auto',
            height: `${viewportHeight}px`,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          {/* Backdrop interno */}
          <div
            onClick={closeChatPanel}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
            }}
          />
          {/* Panel */}
          <div
            style={{
              position: 'relative',
              width: '100%', maxWidth: 448, margin: '0 auto',
              height: '100%',
              maxHeight: '100%',
              background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
              borderRadius: '0',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 -8px 40px rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.15)',
              borderBottom: 'none',
              animation: 'slideUpChat 0.3s cubic-bezier(0.32,0.72,0,1)',
              paddingTop: 'calc(env(safe-area-inset-top) + 6px)',
            }}
          >
            <ChatPanel
              companyId={activeCompanyId}
              onUnreadChange={setUnreadChatCount}
              onClose={closeChatPanel}
            />
          </div>
        </div>
      )}

      {/* Backdrop global opaco para Tareas (solo cuando el teclado está abierto) */}
      {showTasksPanel && activeCompanyId && keyboardOffset > 0 && (
        <div
          onClick={closeTasksPanel}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#060e1c',
            zIndex: 48,
          }}
        />
      )}

      {/* Tasks Panel Drawer */}
      {showTasksPanel && activeCompanyId && (
        <div style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: `${viewportOffsetTop}px`,
          bottom: 'auto',
          height: `${viewportHeight}px`,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}>
          <div
            onClick={closeTasksPanel}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'relative',
            width: '100%', maxWidth: 448, margin: '0 auto',
            height: keyboardOffset > 0 ? '100%' : '80vh',
            maxHeight: '100%',
            background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
            borderRadius: keyboardOffset > 0 ? '0' : '20px 20px 0 0',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -8px 40px rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderBottom: 'none',
            animation: 'slideUpChat 0.3s cubic-bezier(0.32,0.72,0,1)',
            paddingTop: keyboardOffset > 0 ? 'calc(env(safe-area-inset-top) + 6px)' : 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.2)' }} />
            </div>
            <TasksPanel 
              onPendingChange={handlePendingChange} 
            />
          </div>
        </div>
      )}

      {/* CSS para animación de drawers */}
      <style>{`
        @keyframes slideUpChat {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#151b26] border-t border-slate-200 dark:border-slate-800 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-[45]">
        <div className="relative flex justify-around items-center h-16 max-w-md mx-auto">
          <button className="flex flex-col items-center justify-center w-full h-full gap-1 text-primary">
            <span className="material-symbols-outlined text-[26px]">home</span>
            <span className="text-[10px] font-bold">Inicio</span>
          </button>

          <div className="absolute -top-7 left-1/2 -translate-x-1/2">
            <button
              onClick={() => {
                const now = new Date();
                setEntryDate(isoDate(now));
                setEntryTime(nowHHMM());
                setDateTimeTouched(false);
                setInitialEntryDate(isoDate(now));
                setInitialEntryTime(nowHHMM());
                if (liveMode === "out") setEntryType("clock-in");
                else if (liveMode === "working") setEntryType("clock-out");
                else if (liveMode === "break") setEntryType("break-end");
                setShowModal(true);
              }}
              className="size-16 rounded-full bg-primary text-white shadow-xl shadow-primary/30 flex items-center justify-center border-4 border-background-light dark:border-background-dark active:scale-90 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-4xl">add</span>
            </button>
          </div>

          <button
            onClick={() => navigate("/history")}
            className="flex flex-col items-center justify-center w-full h-full gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[26px]">calendar_month</span>
            <span className="text-[10px] font-medium">Calendario</span>
          </button>
        </div>
      </nav>

      {/* Manual Entry Modal */}
      <div
        className={`fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 ${
          showModal ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div
          onClick={() => {
            setShowModal(false);
            setContextText("");
          }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        ></div>

        <div
          className={`relative w-full max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out ${
            showModal ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Añadir Registro Manual
            </h3>
            <button
              onClick={() => {
                setShowModal(false);
                setContextText("");
              }}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 border-none bg-transparent cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <form
            className="p-5 space-y-4 no-scrollbar max-h-[85vh] overflow-y-auto"
            onSubmit={handleSaveManualEntry}
          >
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tipo de Registro
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canClockIn}
                  onClick={() => setEntryType("clock-in")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border
                    ${
                      entryType === "clock-in"
                        ? "bg-primary text-white border-primary shadow-md"
                        : "bg-primary text-white-500 border-gray-200 dark:border-gray-700 hover:border-primary"
                    }
                    ${!canClockIn ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    login
                  </span>{" "}
                  Entrada
                </button>

                <button
                  type="button"
                  disabled={!canClockOut}
                  onClick={() => setEntryType("clock-out")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border
                    ${
                      entryType === "clock-out"
                        ? "bg-slate-600 text-white border-slate-600 shadow-md"
                        : "bg-slate-600 text-white-500 border-gray-200 dark:border-gray-700 hover:border-slate-600"
                    }
                    ${!canClockOut ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    logout
                  </span>{" "}
                  Salida
                </button>

                <button
                  type="button"
                  disabled={!canBreakStart && !canBreakEnd}
                  onClick={() => {
                     // Toggle lógico 
                     if (canBreakStart) setEntryType("break-start");
                     else if (canBreakEnd) setEntryType("break-end");
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border
                    ${
                      (entryType === "break-start" || entryType === "break-end")
                        ? "bg-amber-500 text-white border-amber-500 shadow-md"
                        : "bg-amber-500 text-white-500 border-gray-200 dark:border-gray-700 hover:border-amber-500"
                    }
                    ${(!canBreakStart && !canBreakEnd) ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {canBreakStart ? "coffee" : "play_arrow"}
                  </span>{" "}
                  {canBreakStart ? "Descanso" : "Terminar Descanso"}
                </button>

                {/* PERMISO (Toggle) */}
                <button
                  type="button"
                  disabled={!canOthersOut && !canOthersIn}
                  onClick={() => {
                     if (canOthersOut) {
                        setReasonText("");
                        setShowReasonModal(true);
                     } else if (canOthersIn) {
                        setEntryType("others-in");
                     }
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ring-4
                    ${
                      (canOthersOut || canOthersIn)
                        ? `bg-pink-500 text-white border-pink-500 shadow-md ${
                            (entryType === "others-out" || entryType === "others-in")
                              ? "ring-pink-500/30"
                              : "ring-transparent hover:opacity-90"
                          }`
                        : "bg-pink-500 text-white border-pink-500 shadow-none ring-transparent opacity-50 cursor-not-allowed pointer-events-none"
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {canOthersOut ? "edit_note" : "history_edu"}
                  </span>{" "}
                  {canOthersOut ? "Permiso" : "Terminar Permiso"}
                </button>
              </div>
            </div>

            {(entryType === "others-in" || entryType === "others-out") && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Contexto / Motivo
                </label>
                <input
                  autoFocus
                  className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-pink-500 focus:border-pink-500 text-sm shadow-sm outline-none border transition-colors"
                  type="text"
                  placeholder="Ej: Visita médica, Diligencia..."
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Fecha
              </label>
              <input
                className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border"
                type="date"
                value={entryDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== entryDate) setDateTimeTouched(true);
                  setEntryDate(v);
                }}

              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Hora
              </label>
              <input
                className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border"
                type="time"
                value={entryTime}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== entryTime) setDateTimeTouched(true);
                  setEntryTime(v);
                }}

              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setContextText("");
                }}
                className="flex-1 py-3 px-4 rounded-xl text-center text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-none bg-transparent cursor-pointer"
                type="button"
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:opacity-90 border-none cursor-pointer ${saveButtonClasses(
                  entryType,
                )}`}
                type="submit"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Reason Modal (Simple) */}
      
       <div
        className={`fixed inset-0 z-[70] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 ${
          showReasonModal ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div
          onClick={() => setShowReasonModal(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        ></div>

        <div
          className={`relative w-full max-w-sm bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out border border-slate-100 dark:border-slate-800 ${
            showReasonModal ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Motivo del permiso
              </h3>
              <button
                onClick={() => setShowReasonModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <input
              autoFocus
              className="block w-full px-4 py-3 rounded-xl border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-pink-500 focus:border-pink-500 text-base shadow-sm outline-none border transition-colors mb-6"
              type="text"
              placeholder="Ej: Visita médica..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              onKeyDown={(e) => {
                 if(e.key === 'Enter' && reasonText.trim()) {
                    // Trigger save
                    const btn = document.getElementById('save-reason-btn');
                    btn?.click();
                 }
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowReasonModal(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                id="save-reason-btn"
                disabled={!reasonText.trim()}
                onClick={async () => {
                  if (!reasonText.trim()) return;
                  
                  const now = new Date();
                  const coords = await getCurrentLocation();
                  const res = await insertTimeEntryValidated({
                    type: "others-out",
                    occurredAt: now,
                    description: "Permiso: " + reasonText,
                    dateISO: isoDate(now),
                    timeHHMM: nowHHMM(),
                    isManual: false,
                    latitude: coords?.latitude ?? null,
                    longitude: coords?.longitude ?? null,
                  });

                  if (res.ok) {
                    setShowReasonModal(false);
                    // Asumimos que al salir por otros, queda en estado "out" (o similar para activar others-in)
                    handleAction("out"); 
                    // Forzamos refresh para ver la tarjeta rosa
                    loadTodayEntries(isoDate(now));
                  }
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-lg shadow-pink-500/30 transition-all active:scale-95 ${
                  reasonText.trim() 
                    ? "bg-pink-500 hover:bg-pink-600 cursor-pointer" 
                    : "bg-pink-400 opacity-50 cursor-not-allowed"
                }`}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
