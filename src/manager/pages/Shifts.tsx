import { useEffect, useState, useRef, Fragment, useLayoutEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, User, ChevronDown, Copy, CalendarDays, Save, Download, Trash2, Minus, Loader2, Check, FileText, Undo, Redo, Users, AlertTriangle, CalendarOff, Palmtree, Stethoscope } from 'lucide-react';
import { motion } from 'framer-motion';
import { CustomSelect } from '../components/ui/CustomSelect';
import { employeeService } from '../services/employeeService';
import { teamService } from '../services/teamService';
import { settingsService } from '../services/settingsService';
import { shiftService } from '../services/shiftService';
import { absenceService } from '../services/absenceService';
import type { Employee, Shift, Team, Absence } from '../types';
import type { LeavePolicy } from '../services/settingsService';
import { AbsencesModal } from '../components/AbsencesModal';

// Datos de prueba temporales para visualizar el diseño





const mapLegacyColor = (color: string | undefined): string => {
  if (!color) return 'bg-blue-500';
  if (color.includes('indigo')) return 'bg-purple-600';
  if (color.includes('fuchsia')) return 'bg-pink-400';
  return color;
};

const getLocalDateString = (d: Date) => {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

const getDatesInRange = (start: Date, end: Date): Date[] => {
  const dates: Date[] = [];
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);

  const startTime = s.getTime();
  const endTime = e.getTime();
  const minTime = Math.min(startTime, endTime);
  const maxTime = Math.max(startTime, endTime);

  let curr = new Date(minTime);
  while (curr.getTime() <= maxTime) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
};

type DayVariant = 'closed_normal' | 'closed_holiday' | 'open_holiday' | 'open_partial_holiday' | 'open_unexpected';

type SpecialDayData = { variant: DayVariant; start?: string; end?: string };


type DailySchedule = { active: boolean; start: string; end: string };


// MOCK_SHIFTS removed as it was unused

const calculateTotalHours = (shifts: Shift[]) => {
  let total = 0;
  shifts.forEach(shift => {
    const startHour = parseInt(shift.start_time.split(':')[0], 10);
    const startMin = parseInt(shift.start_time.split(':')[1], 10);
    const endHour = parseInt(shift.end_time.split(':')[0], 10);
    const endMin = parseInt(shift.end_time.split(':')[1], 10);

    let startFraction = startHour + (startMin / 60);
    let endFraction = endHour + (endMin / 60);
    if (endFraction < startFraction) endFraction += 24;

    let duration = endFraction - startFraction;

    // Restar el descanso si se encuentra registrado en notes y NO es pagado (fuera de jornada)
    if (shift.notes) {
      const breakMatch = shift.notes.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*([^)]+))?\)/i);
      if (breakMatch) {
        const breakMinutes = parseInt(breakMatch[1], 10);
        const type = breakMatch[2] || '';
        const isPaid = type.toLowerCase().includes('pagado');
        if (!isPaid) {
          duration -= (breakMinutes / 60);
        }
      }
    }

    total += duration;
    if (shift.overtime) {
      total += shift.overtime;
    }
  });
  return total;
};

const getAdjustedEndTime = (endTime: string, overtime?: number, unpaidBreakMins?: number): string => {
  if (!endTime) return endTime;
  const [hStr, mStr] = endTime.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  let totalMinutes = h * 60 + m;
  if (overtime && overtime > 0) totalMinutes += Math.round(overtime * 60);
  if (unpaidBreakMins && unpaidBreakMins > 0) totalMinutes += unpaidBreakMins;

  if (totalMinutes === h * 60 + m) return endTime;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;

  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
};

const formatProposedHours = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}h`;
};

const classifyDates = (
  dates: Date[],
  specialDays: Record<string, SpecialDayData>,
  weeklySchedule: Record<number, DailySchedule>
) => {
  const laborables: Date[] = [];
  const festivosAbiertos: Date[] = [];
  const cerrados: Date[] = [];

  dates.forEach(d => {
    const dateStr = getLocalDateString(d);
    const dayOfWeek = d.getDay();

    let specialType = specialDays[dateStr]?.variant;
    const isBaseOpen = weeklySchedule[dayOfWeek]?.active;

    if (!specialType && !isBaseOpen) {
      specialType = 'closed_normal';
    }

    if (specialType === 'closed_normal' || specialType === 'closed_holiday') {
      cerrados.push(d);
    } else if (
      specialType === 'open_holiday' ||
      specialType === 'open_partial_holiday' ||
      specialType === 'open_unexpected'
    ) {
      festivosAbiertos.push(d);
    } else {
      laborables.push(d);
    }
  });

  return { laborables, festivosAbiertos, cerrados };
};

const isRangeConsecutive = (dates: Date[]): boolean => {
  if (dates.length <= 1) return true;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = new Date(sorted[i].getFullYear(), sorted[i].getMonth(), sorted[i].getDate());
    const d2 = new Date(sorted[i + 1].getFullYear(), sorted[i + 1].getMonth(), sorted[i + 1].getDate());
    const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays !== 1) return false;
  }
  return true;
};

const Shifts = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  
  const companyId = localStorage.getItem('active_company_id') || '1';
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [year, month, day] = e.target.value.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      setSelectedDate(d);
      setSelectedDates([d]);
      setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  // Estados para selección de rango en el calendario principal
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);

  // Selector de periodo para el panel de Resumen por Trabajador (con persistencia)
  const [summaryPeriod, setSummaryPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'calendar'>(() => {
    const saved = localStorage.getItem('fycheo_summary_period');
    return (saved as any) || 'day';
  });

  const [summaryCustomDates, setSummaryCustomDates] = useState<Date[]>(() => {
    const saved = localStorage.getItem('fycheo_summary_custom_dates');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d: string) => new Date(d));
        }
      } catch (e) {
        console.error('Error parsing summaryCustomDates from localStorage', e);
      }
    }
    return [new Date()];
  });

  useEffect(() => {
    localStorage.setItem('fycheo_summary_period', summaryPeriod);
  }, [summaryPeriod]);

  useEffect(() => {
    localStorage.setItem('fycheo_summary_custom_dates', JSON.stringify(summaryCustomDates.map(d => d.toISOString())));
  }, [summaryCustomDates]);

  // Calcular las fechas a procesar en base al periodo seleccionado
  const summaryDates = useMemo(() => {
    if (summaryPeriod === 'day') {
      return [selectedDate];
    }
    if (summaryPeriod === 'week') {
      const d = new Date(selectedDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.getFullYear(), d.getMonth(), diff);
      const weekDates: Date[] = [];
      for (let i = 0; i < 7; i++) {
        weekDates.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
      }
      return weekDates;
    }
    if (summaryPeriod === 'month') {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthDates: Date[] = [];
      for (let i = 1; i <= daysInMonth; i++) {
        monthDates.push(new Date(year, month, i));
      }
      return monthDates;
    }
    if (summaryPeriod === 'year') {
      const year = selectedDate.getFullYear();
      const yearDates: Date[] = [];
      const curr = new Date(year, 0, 1);
      while (curr.getFullYear() === year) {
        yearDates.push(new Date(curr));
        curr.setDate(curr.getDate() + 1);
      }
      return yearDates;
    }
    // 'calendar'
    return summaryCustomDates;
  }, [summaryPeriod, selectedDate, summaryCustomDates]);

  // Etiqueta descriptiva en español del periodo calculado
  const summaryPeriodLabel = useMemo(() => {
    if (summaryPeriod === 'day') {
      return selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
    if (summaryPeriod === 'week' && summaryDates.length > 0) {
      const start = summaryDates[0];
      const end = summaryDates[summaryDates.length - 1];
      return `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
    }
    if (summaryPeriod === 'month') {
      return selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
    if (summaryPeriod === 'year') {
      return `Año ${selectedDate.getFullYear()}`;
    }
    // calendar
    if (summaryCustomDates.length === 0) return 'Sin fechas';
    if (summaryCustomDates.length === 1) {
      return summaryCustomDates[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
    const sorted = [...summaryCustomDates].sort((a, b) => a.getTime() - b.getTime());
    const start = sorted[0];
    const end = sorted[sorted.length - 1];
    return `${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`;
  }, [summaryPeriod, selectedDate, summaryCustomDates, summaryDates]);


  // Estados para confirmación de festivos en selección múltiple
  const [isHolidayConfirmModalOpen, setIsHolidayConfirmModalOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{
    employeeId: string;
    shiftTypeData: any;
  } | null>(null);

  const applyPendingAssignment = (targetDates: Date[]) => {
    if (!pendingAssignment) return;
    const { employeeId, shiftTypeData } = pendingAssignment;
    const companyId = localStorage.getItem('active_company_id') || '1';

    if (targetDates.length === 0) {
      setIsHolidayConfirmModalOpen(false);
      setPendingAssignment(null);
      return;
    }

    const newShiftsToAdd: Shift[] = [];
    targetDates.forEach((dateObj, dIdx) => {
      const dateStr = getLocalDateString(dateObj);
      const isSplitShift = shiftTypeData.isSplit || shiftTypeData.is_split;
      const breakNotes = shiftTypeData.breakMins ? `(Descanso: ${shiftTypeData.breakMins} min - ${shiftTypeData.breakPaid ? 'Pagado' : 'No pagado'})` : '';
      const typePrefix = shiftTypeData.name ? `[${shiftTypeData.name}]` : '';

      // Tramo 1
      newShiftsToAdd.push({
        id: `shift-${Date.now()}-${dIdx}-1-${Math.random().toString(36).substr(2, 9)}`,
        employee_id: employeeId,
        company_id: companyId,
        date: dateStr,
        start_time: shiftTypeData.start || shiftTypeData.start_time || '09:00',
        end_time: shiftTypeData.end || shiftTypeData.end_time || '17:00',
        status: 'scheduled',
        color: mapLegacyColor(shiftTypeData.color || shiftTypeData.bg),
        notes: [typePrefix, shiftTypeData.notes || breakNotes].filter(Boolean).join(' '),
        is_published: false
      });

      // Tramo 2 (si es jornada partida)
      if (isSplitShift) {
        newShiftsToAdd.push({
          id: `shift-${Date.now()}-${dIdx}-2-${Math.random().toString(36).substr(2, 9)}`,
          employee_id: employeeId,
          company_id: companyId,
          date: dateStr,
          start_time: shiftTypeData.start2 || shiftTypeData.start_time2 || '16:00',
          end_time: shiftTypeData.end2 || shiftTypeData.end_time2 || '20:00',
          status: 'scheduled',
          color: mapLegacyColor(shiftTypeData.color || shiftTypeData.bg),
          notes: [typePrefix, shiftTypeData.notes || ''].filter(Boolean).join(' '),
          is_published: false
        });
      }
    });

    setShifts(prev => {
      const targetDateStrings = targetDates.map(d => getLocalDateString(d));
      const filtered = prev.filter(s => !(s.employee_id === employeeId && targetDateStrings.includes(s.date)));
      return [...filtered, ...newShiftsToAdd];
    });

    setIsHolidayConfirmModalOpen(false);
    setPendingAssignment(null);
  };

  // Escuchar mouseup globalmente para terminar la selección
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelectingRange) {
        setIsSelectingRange(false);
        setRangeStart(null);

      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isSelectingRange]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, DailySchedule>>({});
  const [specialDays, setSpecialDays] = useState<Record<string, SpecialDayData>>({});
  const [shifts, setShiftsInternal] = useState<Shift[]>([]);

  // Pilas para Deshacer / Rehacer (Undo / Redo)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStackRef = useRef<Shift[][]>([]);
  const redoStackRef = useRef<Shift[][]>([]);
  const publishedShiftsRef = useRef<string>('[]'); // Baseline state from DB

  // Interceptor del actualizador de turnos para guardar el historial y revertir borradores
  const setShifts = useCallback((updater: Shift[] | ((prev: Shift[]) => Shift[])) => {
    setShiftsInternal(prev => {
      let nextRaw = typeof updater === 'function' ? updater(prev) : updater;
      
      try {
        const publishedShifts = JSON.parse(publishedShiftsRef.current) as Shift[];
        const publishedShiftsMap = new Map(publishedShifts.map(s => [s.id, s]));

        nextRaw = nextRaw.map(shift => {
           if (shift.is_published === false && shift.status !== 'pending_deletion') {
             const original = publishedShiftsMap.get(shift.id);
             if (original) {
               const normalizeVal = (val: any) => (val === undefined || val === null || val === '') ? null : val;
               if (
                 original.employee_id === shift.employee_id &&
                 original.date === shift.date &&
                 original.start_time === shift.start_time &&
                 original.end_time === shift.end_time &&
                 normalizeVal(original.color) === normalizeVal(shift.color) &&
                 normalizeVal(original.notes) === normalizeVal(shift.notes) &&
                 normalizeVal(original.overtime) === normalizeVal(shift.overtime)
               ) {
                 return { ...shift, is_published: true, status: original.status };
               }
             }
           }
           return shift;
        });
      } catch (e) {
        console.error("Error smart draft comparison", e);
      }

      const next = nextRaw;
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        undoStackRef.current.push(prev);
        if (undoStackRef.current.length > 50) {
          undoStackRef.current.shift();
        }
        redoStackRef.current = []; // Limpiar historial de rehacer
        setCanUndo(true);
        setCanRedo(false);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (undoStackRef.current.length > 0) {
      const prev = undoStackRef.current.pop()!;
      setShiftsInternal(current => {
        redoStackRef.current.push(current);
        setCanRedo(true);
        return prev;
      });
      setCanUndo(undoStackRef.current.length > 0);
    }
  }, []);

  const redo = useCallback(() => {
    if (redoStackRef.current.length > 0) {
      const next = redoStackRef.current.pop()!;
      setShiftsInternal(current => {
        undoStackRef.current.push(current);
        setCanUndo(true);
        return next;
      });
      setCanRedo(redoStackRef.current.length > 0);
    }
  }, []);

  // Limpiar historial al cambiar de día o filtrar por equipo
  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [selectedDate, selectedTeamId]);

  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(true);
      if (e.key === 'Alt') setAltPressed(true);

      // Deshacer / Rehacer
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const target = e.target as HTMLElement;
        const isEditingText = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if (!isEditingText) {
          if (e.key === 'z' || e.key === 'Z') {
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
          } else if (e.key === 'y' || e.key === 'Y') {
            e.preventDefault();
            redo();
          }
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPressed(false);
      if (e.key === 'Alt') setAltPressed(false);
    };
    const handleWindowBlur = () => {
      setCtrlPressed(false);
      setAltPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [undo, redo]);
  const [shiftTypes, setShiftTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Ref para el viewport del timeline
  const timelineViewportRef = useRef<HTMLDivElement>(null);

  // Ref para guardar el pivote del zoom y evitar desfase visual
  const zoomPivotRef = useRef<{ clientX: number; scrollLeft: number; oldZoom: number } | null>(null);

  // Escuchador de eventos de la rueda del ratón (Wheel) con soporte para Ctrl + Scroll para hacer zoom centrado en el ratón
  useEffect(() => {
    const el = timelineViewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const scrollLeft = el.scrollLeft;

        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        const oldZoom = zoom;
        const newZoom = Math.min(4, Math.max(1, oldZoom + delta));

        if (oldZoom !== newZoom) {
          zoomPivotRef.current = { clientX, scrollLeft, oldZoom };
          setZoom(newZoom);
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [loading, shifts.length === 0, zoom]);

  // Sincronizar el scrollLeft antes del pintado del navegador para evitar saltos visuales
  useLayoutEffect(() => {
    if (zoomPivotRef.current && timelineViewportRef.current) {
      const { clientX, scrollLeft, oldZoom } = zoomPivotRef.current;
      const targetScrollLeft = (scrollLeft + clientX) * (zoom / oldZoom) - clientX;
      timelineViewportRef.current.scrollLeft = targetScrollLeft;
      zoomPivotRef.current = null;
    }
  }, [zoom]);

  // Lógica para arrastrar (grab-to-scroll) el timeline
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a') || target.closest('[draggable="true"]')) {
      return;
    }
    if (!timelineViewportRef.current) return;

    isDragging.current = true;
    startX.current = e.pageX - timelineViewportRef.current.offsetLeft;
    scrollLeftStart.current = timelineViewportRef.current.scrollLeft;

    timelineViewportRef.current.style.cursor = 'grabbing';
    timelineViewportRef.current.style.userSelect = 'none';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !timelineViewportRef.current) return;
    e.preventDefault();

    const x = e.pageX - timelineViewportRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.0;
    timelineViewportRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (timelineViewportRef.current) {
      timelineViewportRef.current.style.cursor = 'grab';
      timelineViewportRef.current.style.userSelect = 'auto';
    }
  };

  // Estados para gestión de plantillas
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState([
    { id: 't-1', name: 'Jornada Estándar Completa', shiftsCount: 4, createdAt: '10/05/2026' },
    { id: 't-2', name: 'Refuerzo Fin de Semana', shiftsCount: 6, createdAt: '15/05/2026' },
  ]);

  // Estados para horas extras
  const [overtimeModalOpen, setOvertimeModalOpen] = useState(false);
  const [selectedOvertimeShiftId, setSelectedOvertimeShiftId] = useState<string | null>(null);
  const [overtimeInputValue, setOvertimeInputValue] = useState('2');

  // Configuración global de política de descanso de la empresa
  const [companyBreakIncluded] = useState<boolean>(() => {
    return localStorage.getItem('fycheo_company_break_included') === 'true';
  });

  // Estados para confirmación de eliminación
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shiftIdToDelete, setShiftIdToDelete] = useState<string | null>(null);

  // Estados para creación de turno personalizado al arrastrar
  const [customShiftEmpId, setCustomShiftEmpId] = useState<string | null>(null);
  const [isCustomShiftModalOpen, setIsCustomShiftModalOpen] = useState(false);
  const [customShiftStart, setCustomShiftStart] = useState('09:00');
  const [customShiftEnd, setCustomShiftEnd] = useState('14:00');
  const [customShiftIsSplit, setCustomShiftIsSplit] = useState(false);
  const [customShiftStart2, setCustomShiftStart2] = useState('16:00');
  const [customShiftEnd2, setCustomShiftEnd2] = useState('20:00');
  const [customShiftBreak, setCustomShiftBreak] = useState(0);
  const [customShiftBreakPaid, setCustomShiftBreakPaid] = useState(false);
  const [customShiftBreak2, setCustomShiftBreak2] = useState(0);
  const [customShiftBreakPaid2, setCustomShiftBreakPaid2] = useState(false);
  const [customShiftColor, setCustomShiftColor] = useState('bg-lime-400');
  const [customShiftNotes, setCustomShiftNotes] = useState('');
  const [customShiftError, setCustomShiftError] = useState<string | null>(null);
  const [customShiftHasPlus, setCustomShiftHasPlus] = useState(false);

  // Sincronizar descanso de creación con política de empresa al abrir modal
  useEffect(() => {
    if (isCustomShiftModalOpen) {
      setCustomShiftBreakPaid(companyBreakIncluded);
      setCustomShiftError(null);
    }
  }, [isCustomShiftModalOpen, companyBreakIncluded]);

  // Estados para edición de turno
  const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false);
  const [isAbsencesModalOpen, setIsAbsencesModalOpen] = useState(false);
  const [selectedShiftToEdit, setSelectedShiftToEdit] = useState<Shift | null>(null);
  const [selectedShiftBToEdit, setSelectedShiftBToEdit] = useState<Shift | null>(null);
  const [editShiftStart, setEditShiftStart] = useState('09:00');
  const [editShiftEnd, setEditShiftEnd] = useState('17:00');
  const [editShiftIsSplit, setEditShiftIsSplit] = useState(false);
  const [editShiftStart2, setEditShiftStart2] = useState('16:00');
  const [editShiftEnd2, setEditShiftEnd2] = useState('20:00');
  const [editShiftBreak, setEditShiftBreak] = useState(0);
  const [editShiftBreakPaid, setEditShiftBreakPaid] = useState(false);
  const [editShiftBreak2, setEditShiftBreak2] = useState(0);
  const [editShiftBreakPaid2, setEditShiftBreakPaid2] = useState(false);
  const [editShiftColor, setEditShiftColor] = useState('bg-lime-400');
  const [editShiftNotes, setEditShiftNotes] = useState('');
  const [editShiftError, setEditShiftError] = useState<string | null>(null);
  const [editShiftHasPlus, setEditShiftHasPlus] = useState(false);

  // Estados para el Toast y las Acciones en Lote (UX)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [copiedShifts, setCopiedShifts] = useState<Shift[] | null>(() => {
    try {
      const saved = localStorage.getItem('fycheo_copied_shifts');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Estados para reordenar empleados
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);
  const [draggedEmployeeId, setDraggedEmployeeId] = useState<string | null>(null);
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState<string | null>(null);

  // Cargar orden guardado de localStorage al cambiar el equipo o los empleados
  useEffect(() => {
    if (employees.length > 0) {
      const key = `fycheo_employee_order_${selectedTeamId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const orderedIds = JSON.parse(saved) as string[];
          const existingIds = new Set(employees.map(e => e.id));
          const validOrderedIds = orderedIds.filter(id => existingIds.has(id));

          const orderedSet = new Set(validOrderedIds);
          const newIds = employees.filter(e => !orderedSet.has(e.id)).map(e => e.id);

          setEmployeeOrder([...validOrderedIds, ...newIds]);
        } catch {
          setEmployeeOrder(employees.map(e => e.id));
        }
      } else {
        setEmployeeOrder(employees.map(e => e.id));
      }
    }
  }, [employees, selectedTeamId]);

  // Funciones de Drag & Drop para empleados
  const handleEmployeeDragStart = (e: React.DragEvent, id: string) => {
    setDraggedEmployeeId(id);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'reorder_employee', id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleEmployeeDragEnd = () => {
    setDraggedEmployeeId(null);
    setDragOverEmployeeId(null);
  };

  const handleEmployeeDragOver = (e: React.DragEvent, targetId: string) => {
    if (draggedEmployeeId && draggedEmployeeId !== targetId) {
      e.preventDefault();
      setDragOverEmployeeId(targetId);
    }
  };

  const handleEmployeeDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedEmployeeId || draggedEmployeeId === targetId) return;

    setEmployeeOrder(prev => {
      const newOrder = [...prev];
      const dragIdx = newOrder.indexOf(draggedEmployeeId);
      const dropIdx = newOrder.indexOf(targetId);

      if (dragIdx !== -1 && dropIdx !== -1) {
        newOrder.splice(dragIdx, 1);
        newOrder.splice(dropIdx, 0, draggedEmployeeId);
      }

      const key = `fycheo_employee_order_${selectedTeamId}`;
      localStorage.setItem(key, JSON.stringify(newOrder));
      return newOrder;
    });

    setDraggedEmployeeId(null);
    setDragOverEmployeeId(null);
    setToast({ message: 'Orden de empleados actualizado', type: 'success' });
  };

  // Limpiar Toast automáticamente después de 3 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Cerrar el dropdown de acciones al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Función para copiar todos los turnos del día seleccionado
  const handleCopyDay = () => {
    const dateStr = getLocalDateString(selectedDate);
    const dayShifts = shifts.filter(s => s.date === dateStr);

    if (dayShifts.length === 0) {
      setToast({ message: 'No hay turnos para copiar en este día', type: 'info' });
      setShowActionsDropdown(false);
      return;
    }

    setCopiedShifts(dayShifts);
    localStorage.setItem('fycheo_copied_shifts', JSON.stringify(dayShifts));
    setToast({ message: `Copiados ${dayShifts.length} turnos del día`, type: 'success' });
    setShowActionsDropdown(false);
  };

  // Función para pegar los turnos copiados en el día seleccionado
  const handlePasteDay = () => {
    if (!copiedShifts || copiedShifts.length === 0) {
      setToast({ message: 'No hay turnos en el portapapeles', type: 'info' });
      setShowActionsDropdown(false);
      return;
    }

    const targetDateStr = getLocalDateString(selectedDate);
    const companyId = localStorage.getItem('active_company_id') || '1';

    // Validar si el día destino está cerrado
    const specialDay = specialDays[targetDateStr];
    const dayOfWeek = selectedDate.getDay();
    const isBaseOpen = weeklySchedule[dayOfWeek]?.active;
    const isClosed = (specialDay?.variant === 'closed_normal' || specialDay?.variant === 'closed_holiday') || (!specialDay && !isBaseOpen);

    if (isClosed) {
      setToast({ message: 'No se pueden pegar turnos en un día cerrado', type: 'error' });
      setShowActionsDropdown(false);
      return;
    }

    const newShiftsToPaste = copiedShifts.map((s, idx) => ({
      ...s,
      id: `shift-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      date: targetDateStr,
      company_id: companyId,
      is_published: false
    }));

    setShifts(prev => {
      // Reemplazar todos los turnos de este día
      const filtered = prev.filter(s => s.date !== targetDateStr);
      return [...filtered, ...newShiftsToPaste];
    });

    setToast({ message: `Pegados ${newShiftsToPaste.length} turnos correctamente`, type: 'success' });
    setShowActionsDropdown(false);
  };

  // Función para repetir la planificación del día al resto de la semana
  const handleRepeatWeek = () => {
    const originDateStr = getLocalDateString(selectedDate);
    const originShifts = shifts.filter(s => s.date === originDateStr);

    if (originShifts.length === 0) {
      setToast({ message: 'No hay turnos que repetir hoy', type: 'info' });
      setShowActionsDropdown(false);
      return;
    }

    // Calcular el lunes de la semana correspondiente
    const currentDay = selectedDate.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() + distanceToMonday);

    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d);
    }

    const companyId = localStorage.getItem('active_company_id') || '1';
    const shiftsToInsert: Shift[] = [];
    const targetDatesStrings: string[] = [];

    weekDates.forEach(dateObj => {
      const dateStr = getLocalDateString(dateObj);
      if (dateStr === originDateStr) return; // Omitir el día origen

      // Omitir si el día está cerrado
      const specialDay = specialDays[dateStr];
      const isBaseOpen = weeklySchedule[dateObj.getDay()]?.active;
      const isClosed = (specialDay?.variant === 'closed_normal' || specialDay?.variant === 'closed_holiday') || (!specialDay && !isBaseOpen);
      if (isClosed) return;

      targetDatesStrings.push(dateStr);

      originShifts.forEach((s, idx) => {
        shiftsToInsert.push({
          ...s,
          id: `shift-${Date.now()}-${dateStr}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          date: dateStr,
          company_id: companyId,
          is_published: false
        });
      });
    });

    if (shiftsToInsert.length === 0) {
      setToast({ message: 'No hay días laborables destino en esta semana', type: 'info' });
      setShowActionsDropdown(false);
      return;
    }

    setShifts(prev => {
      const filtered = prev.filter(s => !targetDatesStrings.includes(s.date));
      return [...filtered, ...shiftsToInsert];
    });

    setToast({ message: `Planificación replicada a la semana (${shiftsToInsert.length} turnos creados)`, type: 'success' });
    setShowActionsDropdown(false);
  };

  // Función para repetir la planificación del día al resto del mes
  const handleRepeatMonth = () => {
    const originDateStr = getLocalDateString(selectedDate);
    const originShifts = shifts.filter(s => s.date === originDateStr);

    if (originShifts.length === 0) {
      setToast({ message: 'No hay turnos que repetir hoy', type: 'info' });
      setShowActionsDropdown(false);
      return;
    }

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const companyId = localStorage.getItem('active_company_id') || '1';
    const shiftsToInsert: Shift[] = [];
    const targetDatesStrings: string[] = [];

    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = getLocalDateString(dateObj);
      if (dateStr === originDateStr) continue;

      // Omitir si el día está cerrado
      const specialDay = specialDays[dateStr];
      const dayOfWeek = dateObj.getDay();
      const isBaseOpen = weeklySchedule[dayOfWeek]?.active;
      const isClosed = (specialDay?.variant === 'closed_normal' || specialDay?.variant === 'closed_holiday') || (!specialDay && !isBaseOpen);
      if (isClosed) continue;

      targetDatesStrings.push(dateStr);

      originShifts.forEach((s, idx) => {
        shiftsToInsert.push({
          ...s,
          id: `shift-${Date.now()}-${dateStr}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          date: dateStr,
          company_id: companyId,
          is_published: false
        });
      });
    }

    if (shiftsToInsert.length === 0) {
      setToast({ message: 'No hay días laborables destino en este mes', type: 'info' });
      setShowActionsDropdown(false);
      return;
    }

    setShifts(prev => {
      const filtered = prev.filter(s => !targetDatesStrings.includes(s.date));
      return [...filtered, ...shiftsToInsert];
    });

    setToast({ message: `Planificación replicada al mes (${shiftsToInsert.length} turnos creados)`, type: 'success' });
    setShowActionsDropdown(false);
  };

  const handleApplyTemplate = (template: any) => {
    const companyId = localStorage.getItem('active_company_id') || '1';
    const targetDateStr = getLocalDateString(selectedDate);

    // Validar si el día destino está cerrado
    const specialDay = specialDays[targetDateStr];
    const dayOfWeek = selectedDate.getDay();
    const isBaseOpen = weeklySchedule[dayOfWeek]?.active;
    const isClosed = (specialDay?.variant === 'closed_normal' || specialDay?.variant === 'closed_holiday') || (!specialDay && !isBaseOpen);

    if (isClosed) {
      setToast({ message: 'No se pueden programar turnos en un día cerrado', type: 'error' });
      setIsLoadModalOpen(false);
      return;
    }

    let employeesForTemplate = employees;
    if (selectedTeamId !== 'all') {
      employeesForTemplate = employees.filter(e => e.team_id === selectedTeamId);
    }

    if (employeesForTemplate.length === 0) {
      setToast({ message: 'No hay empleados para aplicar la plantilla', type: 'error' });
      setIsLoadModalOpen(false);
      return;
    }

    // Tomamos tipos de turnos y los asignamos a los empleados del equipo
    const newShifts: Shift[] = employeesForTemplate.slice(0, template.shiftsCount || 4).map((emp, idx) => {
      const shiftType = shiftTypes[idx % shiftTypes.length] || { start: '09:00', end: '17:00', color: 'bg-blue-500', hex: '#3b82f6', name: 'Jornada' };
      return {
        id: `shift-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
        employee_id: emp.id,
        company_id: companyId,
        date: targetDateStr,
        start_time: shiftType.start || '09:00',
        end_time: shiftType.end || '17:00',
        status: 'scheduled',
        color: mapLegacyColor(shiftType.color || shiftType.bg),
        is_published: false
      };
    });

    setShifts(prev => {
      const filtered = prev.filter(s => !(s.date === targetDateStr && employeesForTemplate.map(e => e.id).includes(s.employee_id)));
      return [...filtered, ...newShifts];
    });

    setToast({ message: `Plantilla "${template.name}" aplicada correctamente`, type: 'success' });
    setIsLoadModalOpen(false);
  };

  const handleSaveEditShift = () => {
    if (!selectedShiftToEdit) return;

    // Verificar si el turno guardado es de tipo "Personalizado"
    const tempShift = {
      ...selectedShiftToEdit,
      start_time: editShiftStart,
      end_time: editShiftEnd,
      color: editShiftColor,
    };
    const typeIndicator = getShiftTypeIndicator(tempShift);

    if (typeIndicator.label === 'Personalizado' && (!editShiftNotes || !editShiftNotes.trim())) {
      setEditShiftError("El contexto del turno (Notas) es obligatorio para turnos personalizados.");
      return;
    }

    if (editShiftIsSplit) {
      const startHour = parseInt(editShiftStart.split(':')[0], 10);
      const startMin = parseInt(editShiftStart.split(':')[1], 10);
      const endHour = parseInt(editShiftEnd.split(':')[0], 10);
      const endMin = parseInt(editShiftEnd.split(':')[1], 10);
      const startFraction = startHour + (startMin / 60);
      let endFraction = endHour + (endMin / 60);
      if (endFraction < startFraction) endFraction += 24;

      const startHour2 = parseInt(editShiftStart2.split(':')[0], 10);
      const startMin2 = parseInt(editShiftStart2.split(':')[1], 10);
      const startFraction2 = startHour2 + (startMin2 / 60);

      let startFraction2Adjusted = startFraction2;
      if (startFraction2Adjusted < startFraction) startFraction2Adjusted += 24;

      if (startFraction2Adjusted < endFraction) {
        setEditShiftError("La hora de entrada del segundo tramo no puede ser anterior a la hora de salida del primer tramo.");
        return;
      }
    }

    let notesWithBreak = editShiftNotes;
    if (editShiftIsSplit) {
      const parts = [];
      if (editShiftBreak > 0) parts.push(`(Descanso T1: ${editShiftBreak} min - ${editShiftBreakPaid ? 'Pagado' : 'No pagado'})`);
      if (editShiftBreak2 > 0) parts.push(`(Descanso T2: ${editShiftBreak2} min - ${editShiftBreakPaid2 ? 'Pagado' : 'No pagado'})`);
      if (parts.length > 0) notesWithBreak = parts.join(' ') + (editShiftNotes ? ` · ${editShiftNotes}` : '');
    } else if (editShiftBreak > 0) {
      notesWithBreak = `(Descanso: ${editShiftBreak} min - ${editShiftBreakPaid ? 'Pagado' : 'No pagado'})` + (editShiftNotes ? ` · ${editShiftNotes}` : '');
    }
    if (editShiftHasPlus) {
      notesWithBreak = `(Plus)` + (notesWithBreak ? ` · ${notesWithBreak}` : '');
    }

    setShifts(prev => {
      const toRemoveIds: string[] = [];
      if (selectedShiftBToEdit) {
        toRemoveIds.push(selectedShiftBToEdit.id);
      }

      let updated = prev.filter(s => !toRemoveIds.includes(s.id));

      updated = updated.map(s => {
        if (s.id === selectedShiftToEdit.id) {
          return {
            ...s,
            start_time: editShiftStart,
            end_time: editShiftEnd,
            color: editShiftColor,
            notes: notesWithBreak,
            is_published: false
          };
        }
        return s;
      });

      if (editShiftIsSplit) {
        const companyId = localStorage.getItem('active_company_id') || '1';
        const newShiftB: Shift = selectedShiftBToEdit
          ? {
            ...selectedShiftBToEdit,
            start_time: editShiftStart2,
            end_time: editShiftEnd2,
            color: editShiftColor,
            notes: editShiftNotes,
            is_published: false
          }
          : {
            id: `shift-${Date.now()}-2-${Math.random().toString(36).substr(2, 9)}`,
            employee_id: selectedShiftToEdit.employee_id,
            company_id: companyId,
            date: selectedShiftToEdit.date,
            start_time: editShiftStart2,
            end_time: editShiftEnd2,
            status: 'scheduled',
            color: editShiftColor,
            notes: editShiftNotes,
            is_published: false
          };
        updated.push(newShiftB);
      }

      return updated;
    });

    setIsEditShiftModalOpen(false);
    setSelectedShiftToEdit(null);
    setSelectedShiftBToEdit(null);
    setEditShiftBreak(0);
    setEditShiftError(null);
    setEditShiftHasPlus(false);
    setToast({ message: 'Turno modificado correctamente', type: 'success' });
  };

  const handleCreateCustomShift = () => {
    if (!customShiftEmpId) return;

    if (!customShiftNotes || !customShiftNotes.trim()) {
      setCustomShiftError("El contexto del turno (Notas) es obligatorio para turnos personalizados.");
      return;
    }

    if (customShiftIsSplit) {
      const startHour = parseInt(customShiftStart.split(':')[0], 10);
      const startMin = parseInt(customShiftStart.split(':')[1], 10);
      const endHour = parseInt(customShiftEnd.split(':')[0], 10);
      const endMin = parseInt(customShiftEnd.split(':')[1], 10);
      const startFraction = startHour + (startMin / 60);
      let endFraction = endHour + (endMin / 60);
      if (endFraction < startFraction) endFraction += 24;

      const startHour2 = parseInt(customShiftStart2.split(':')[0], 10);
      const startMin2 = parseInt(customShiftStart2.split(':')[1], 10);
      const startFraction2 = startHour2 + (startMin2 / 60);

      let startFraction2Adjusted = startFraction2;
      if (startFraction2Adjusted < startFraction) startFraction2Adjusted += 24;

      if (startFraction2Adjusted < endFraction) {
        setCustomShiftError("La hora de entrada del segundo tramo no puede ser anterior a la hora de salida del primer tramo.");
        return;
      }
    }

    let notesWithBreak = customShiftNotes;
    if (customShiftIsSplit) {
      const parts = [];
      if (customShiftBreak > 0) parts.push(`(Descanso T1: ${customShiftBreak} min - ${customShiftBreakPaid ? 'Pagado' : 'No pagado'})`);
      if (customShiftBreak2 > 0) parts.push(`(Descanso T2: ${customShiftBreak2} min - ${customShiftBreakPaid2 ? 'Pagado' : 'No pagado'})`);
      if (parts.length > 0) notesWithBreak = parts.join(' ') + (customShiftNotes ? ` · ${customShiftNotes}` : '');
    } else if (customShiftBreak > 0) {
      notesWithBreak = `(Descanso: ${customShiftBreak} min - ${customShiftBreakPaid ? 'Pagado' : 'No pagado'})` + (customShiftNotes ? ` · ${customShiftNotes}` : '');
    }
    if (customShiftHasPlus) {
      notesWithBreak = `(Plus)` + (notesWithBreak ? ` · ${notesWithBreak}` : '');
    }

    const { laborables, festivosAbiertos } = classifyDates(selectedDates, specialDays, weeklySchedule);
    const targetDates = [...laborables, ...festivosAbiertos];

    if (targetDates.length > 0) {
      const companyId = localStorage.getItem('active_company_id') || '1';
      const newShiftsToAdd: Shift[] = [];

      targetDates.forEach((dateObj, dIdx) => {
        const dateStr = getLocalDateString(dateObj);

        // Tramo 1 (o único tramo)
        newShiftsToAdd.push({
          id: `shift-${Date.now()}-${dIdx}-1-${Math.random().toString(36).substr(2, 9)}`,
          employee_id: customShiftEmpId,
          company_id: companyId,
          date: dateStr,
          start_time: customShiftStart,
          end_time: customShiftEnd,
          status: 'scheduled',
          color: customShiftColor,
          notes: notesWithBreak,
          is_published: false
        });

        // Tramo 2 (si es jornada partida)
        if (customShiftIsSplit) {
          newShiftsToAdd.push({
            id: `shift-${Date.now()}-${dIdx}-2-${Math.random().toString(36).substr(2, 9)}`,
            employee_id: customShiftEmpId,
            company_id: companyId,
            date: dateStr,
            start_time: customShiftStart2,
            end_time: customShiftEnd2,
            status: 'scheduled',
            color: customShiftColor,
            notes: customShiftNotes, // en el segundo no repetimos descanso para no duplicar la resta
            is_published: false
          });
        }
      });

      setShifts(prev => {
        const targetDateStrings = targetDates.map(d => getLocalDateString(d));
        const filtered = prev.filter(s => !(s.employee_id === customShiftEmpId && targetDateStrings.includes(s.date)));
        return [...filtered, ...newShiftsToAdd];
      });

      setToast({ message: `Turno ${customShiftIsSplit ? 'partido' : 'personalizado'} asignado correctamente`, type: 'success' });
    }

    setIsCustomShiftModalOpen(false);
    setCustomShiftEmpId(null);
    setCustomShiftIsSplit(false);
    setCustomShiftBreak(0);
    setCustomShiftHasPlus(false);
  };

  // Estados y efecto para autoguardado (Estilo Google Sheets)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const initialShiftsRef = useRef<string>('[]');

  useEffect(() => {
    const currentString = JSON.stringify(shifts);
    if (currentString === initialShiftsRef.current) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    const companyId = localStorage.getItem('active_company_id');
    const timer = setTimeout(async () => {
      try {
        if (companyId) {
          await shiftService.saveShifts(companyId, shifts);
          initialShiftsRef.current = currentString;
          setSaveStatus('saved');
        } else {
          console.error('No hay company_id en localStorage');
          setSaveStatus('error');
        }
      } catch (err: any) {
        console.error('Error guardando turnos en Supabase:', err?.message || err);
        setSaveStatus('error');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [shifts]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const companyId = localStorage.getItem('active_company_id');
      if (!companyId) return;

      const [empData, teamsData, settingsData, holidaysData, absencesData] = await Promise.all([
        employeeService.getEmployees(companyId).catch(() => null),
        teamService.getTeams(companyId).catch(() => null),
        settingsService.getCompanySettings(companyId).catch(() => null),
        settingsService.getHolidays(companyId).catch(() => []),
        absenceService.getAbsences(companyId).catch(() => [])
      ]);

      setEmployees(empData || []);
      setTeams(teamsData || []);
      setAbsences(absencesData || []);

      let currentSchedule: Record<number, DailySchedule> = {};
      if (settingsData?.schedule) {
        const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
        Object.entries(settingsData.schedule).forEach(([key, val]) => {
          if (dayMap[key] !== undefined) {
            currentSchedule[dayMap[key]] = val as DailySchedule;
          }
        });
        setWeeklySchedule(currentSchedule);
      }

      if (settingsData?.shift_types && settingsData.shift_types.length > 0) {
        setShiftTypes(settingsData.shift_types as any);
      }
      
      if (settingsData?.leave_policies) {
        setLeavePolicies(settingsData.leave_policies);
      }

      if (holidaysData && holidaysData.length > 0) {
        const newSpecialDays: Record<string, SpecialDayData> = {};
        holidaysData.forEach(h => {
          const d = new Date(h.date);
          const dayOfWeek = d.getDay();
          const isNormallyClosed = !currentSchedule[dayOfWeek]?.active;

          let variant: DayVariant;
          if (h.type === 'closed') {
            variant = 'closed_holiday';
          } else if (isNormallyClosed && (h.type === 'open_normal' || h.type === 'special_hours')) {
            variant = 'open_unexpected'; // Fucsia
          } else if (h.type === 'special_hours') {
            variant = 'open_partial_holiday';
          } else {
            variant = 'open_holiday';
          }
          newSpecialDays[h.date] = { variant, start: h.start_time || undefined, end: h.end_time || undefined };
        });
        setSpecialDays(newSpecialDays);
      }

      // Cargar turnos desde Supabase
      const shiftsData = await shiftService.getShifts(companyId).catch(() => null);
      if (shiftsData && shiftsData.length > 0) {
        setShiftsInternal(shiftsData);
        initialShiftsRef.current = JSON.stringify(shiftsData);
        publishedShiftsRef.current = JSON.stringify(shiftsData);
      } else {
        initialShiftsRef.current = JSON.stringify([]);
        publishedShiftsRef.current = JSON.stringify([]);
      }
      // Si no hay datos en BD, se mantienen los valores de localStorage (fallback)
      // que ya se cargaron en el useState inicial
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (emp) return emp.full_name || emp.name || emp.email;
    return 'Desconocido';
  };

  const getBusinessHours = () => {
    const localDateStr = getLocalDateString(selectedDate);
    const dayOfWeek = selectedDate.getDay();
    const specialDay = specialDays[localDateStr];
    const regularDay = weeklySchedule[dayOfWeek];

    const parseTime = (timeStr: string) => {
      const [h, m] = timeStr.split(':');
      return parseInt(h, 10) + (parseInt(m, 10) / 60);
    };

    if (specialDay && specialDay.variant !== 'closed_holiday' && specialDay.variant !== 'closed_normal') {
      if (specialDay.start && specialDay.end) {
        return { start: parseTime(specialDay.start), end: parseTime(specialDay.end) };
      } else if (regularDay?.active && regularDay.start && regularDay.end) {
        return { start: parseTime(regularDay.start), end: parseTime(regularDay.end) };
      }
    } else if (!specialDay && regularDay?.active && regularDay.start && regularDay.end) {
      return { start: parseTime(regularDay.start), end: parseTime(regularDay.end) };
    }

    return null;
  };

  const getClosureReason = (): string | null => {
    const dateStr = getLocalDateString(selectedDate);
    const specialDay = specialDays[dateStr];
    const dayOfWeek = selectedDate.getDay();
    const regularDay = weeklySchedule[dayOfWeek];

    if (specialDay) {
      if (specialDay.variant === 'closed_holiday') {
        return "Festivo Cerrado";
      }
      if (specialDay.variant === 'closed_normal') {
        return "Establecimiento Cerrado";
      }
    } else if (regularDay && !regularDay.active) {
      return "Cerrado por descanso";
    }

    return null;
  };

  const getEmployeeAbsence = (employeeId: string, dateStr: string) => {
    return absences.find(a => 
      a.employee_id === employeeId && 
      dateStr >= a.start_date && 
      (a.end_date === null || dateStr <= a.end_date)
    );
  };

  const normalizeTime = (timeStr: string | undefined | null) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return timeStr;
  };

  const getShiftComplement = (shift: any) => {
    const dayShifts = shifts.filter(s => s.employee_id === shift.employee_id && s.date === shift.date);
    if (dayShifts.length === 2) {
      const sorted = [...dayShifts].sort((a, b) => a.start_time.localeCompare(b.start_time));
      if (sorted[0].id === shift.id) {
        return { isSplit: true, isFirstTramo: true, partner: sorted[1] };
      } else if (sorted[1].id === shift.id) {
        return { isSplit: true, isFirstTramo: false, partner: sorted[0] };
      }
    }
    return { isSplit: false };
  };

  const getBadgeColorClasses = (colorStr: string | undefined | null) => {
    let badgeClasses = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (!colorStr) return badgeClasses;

    const cleanColor = mapLegacyColor(colorStr)
      .replace('bg-', '')
      .replace('-500', '')
      .replace('-600', '')
      .replace('-400', '')
      .replace('-300', '')
      .replace('-800', '');

    if (cleanColor.includes('emerald') || cleanColor.includes('green')) {
      badgeClasses = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    } else if (cleanColor.includes('red')) {
      badgeClasses = 'bg-red-500/20 text-red-300 border-red-500/30';
    } else if (cleanColor.includes('orange')) {
      badgeClasses = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    } else if (cleanColor.includes('purple') || cleanColor.includes('indigo')) {
      badgeClasses = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    } else if (cleanColor.includes('pink') || cleanColor.includes('fuchsia')) {
      badgeClasses = 'bg-pink-500/20 text-pink-300 border-pink-500/30';
    } else if (cleanColor.includes('yellow')) {
      badgeClasses = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    } else if (cleanColor.includes('amber')) {
      badgeClasses = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    } else if (cleanColor.includes('cyan')) {
      badgeClasses = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    } else if (cleanColor.includes('lime')) {
      badgeClasses = 'bg-lime-500/20 text-lime-300 border-lime-500/30';
    } else if (cleanColor.includes('slate')) {
      badgeClasses = 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
    return badgeClasses;
  };

  const getShiftContext = (shift: any) => {
    if (!shift.notes) return null;

    let cleanNotes = shift.notes
      .replace(/\(Descanso:\s*\d+\s*min(?:\s*-\s*[^)]+)?\)\s*·?\s*/i, '')
      .replace(/\(Plus\)\s*·?\s*/i, '')
      .replace(/\s*·?\s*\(Plus\)/i, '')
      .trim();

    return cleanNotes || null;
  };

  const getShiftTypeIndicator = (shift: any) => {
    const hasIndividualPlus = shift.notes && shift.notes.includes('(Plus)');

    // 1. Si tiene un contexto personalizado (notas específicas escritas por el usuario), es obligatoriamente "Personalizado"
    if (getShiftContext(shift) !== null) {
      return { 
        label: 'Personalizado', 
        className: `${getBadgeColorClasses(shift.color)} font-bold`, 
        hasPlus: !!hasIndividualPlus 
      };
    }

    // 2. Verificar si coincide con algún tipo de turno predefinido
    const shiftStartNorm = normalizeTime(shift.start_time);
    const shiftEndNorm = normalizeTime(shift.end_time);
    const comp = getShiftComplement(shift);

    const matchedType = shiftTypes.find(t => {
      const tStartNorm = normalizeTime(t.start || t.start_time);
      const tEndNorm = normalizeTime(t.end || t.end_time);
      const isTypeSplit = t.isSplit || t.is_split;

      if (comp.isSplit) {
        if (!isTypeSplit) return false;
        const shiftA = comp.isFirstTramo ? shift : comp.partner!;
        const shiftB = comp.isFirstTramo ? comp.partner! : shift;
        const tStart2Norm = normalizeTime(t.start2 || t.start_time2);
        const tEnd2Norm = normalizeTime(t.end2 || t.end_time2);
        return tStartNorm === normalizeTime(shiftA.start_time) &&
          tEndNorm === normalizeTime(shiftA.end_time) &&
          tStart2Norm === normalizeTime(shiftB.start_time) &&
          tEnd2Norm === normalizeTime(shiftB.end_time);
      } else {
        if (isTypeSplit) return false;
        return tStartNorm === shiftStartNorm && tEndNorm === shiftEndNorm;
      }
    });

    if (matchedType) {
      return { 
        label: matchedType.name, 
        className: getBadgeColorClasses(matchedType.color || matchedType.bg),
        hasPlus: !!hasIndividualPlus || !!matchedType.hasPlus
      };
    }

    // 3. Verificar si la fecha del turno es un día especial/festivo
    const specialDay = specialDays[shift.date];
    if (specialDay) {
      if (specialDay.variant === 'open_holiday' || specialDay.variant === 'open_partial_holiday') {
        return { label: 'Festivo', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30', hasPlus: !!hasIndividualPlus };
      }
      if (specialDay.variant === 'open_unexpected') {
        return { label: 'Excepcional', className: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-300', hasPlus: !!hasIndividualPlus };
      }
      if (specialDay.variant === 'closed_holiday' || specialDay.variant === 'closed_normal') {
        return { label: 'Cerrado', className: 'bg-red-500/20 text-red-300 border-red-500/30', hasPlus: !!hasIndividualPlus };
      }
    }

    // 4. Verificar si es un turno excepcional de color fosforito (cualquier color terminando en -400)
    if (shift.color && shift.color.includes('-400')) {
      return { label: 'Personalizado', className: `${getBadgeColorClasses(shift.color)} font-bold`, hasPlus: !!hasIndividualPlus };
    }

    // 5. Verificar si es horario habitual o modificado
    const dayOfWeek = new Date(shift.date).getDay();
    const regularDay = weeklySchedule[dayOfWeek];
    if (regularDay?.active) {
      const isHabitual = normalizeTime(shift.start_time) === normalizeTime(regularDay.start) &&
        normalizeTime(shift.end_time) === normalizeTime(regularDay.end);
      if (isHabitual) {
        return { label: 'Habitual', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30', hasPlus: !!hasIndividualPlus };
      } else {
        return { label: 'Personalizado', className: getBadgeColorClasses(shift.color), hasPlus: !!hasIndividualPlus };
      }
    }

    return { label: 'Extra', className: getBadgeColorClasses(shift.color), hasPlus: !!hasIndividualPlus };
  };

  const getTimelineDateSubtitle = () => {
    if (selectedDates.length > 1) {
      const { laborables, festivosAbiertos, cerrados } = classifyDates(selectedDates, specialDays, weeklySchedule);
      let parts = [];
      if (laborables.length > 0) {
        parts.push(`${laborables.length} lab.`);
      }
      if (festivosAbiertos.length > 0) {
        parts.push(`${festivosAbiertos.length} fest. abiertos`);
      }
      let summaryText = `Réplica en ${parts.join(' y ')}`;
      if (cerrados.length > 0) {
        summaryText += ` (se omiten ${cerrados.length} cerrados)`;
      }
      return (
        <span className="text-primary font-semibold">
          {summaryText}
        </span>
      );
    }

    const dateStr = getLocalDateString(selectedDate);
    const specialDay = specialDays[dateStr];
    const dayOfWeek = selectedDate.getDay();
    const regularDay = weeklySchedule[dayOfWeek];

    if (specialDay) {
      const start = specialDay.start || regularDay?.start || '00:00';
      const end = specialDay.end || regularDay?.end || '00:00';
      if (specialDay.variant === 'closed_holiday') {
        return <span className="text-red-400 font-semibold">Festivo Cerrado</span>;
      }
      if (specialDay.variant === 'closed_normal') {
        return <span className="text-slate-400 font-medium">Establecimiento Cerrado</span>;
      }
      if (specialDay.variant === 'open_holiday') {
        return <span className="text-emerald-400 font-semibold">Festivo Abierto ({start} - {end})</span>;
      }
      if (specialDay.variant === 'open_partial_holiday') {
        return <span className="text-orange-400 font-semibold">Festivo Parcial ({start} - {end})</span>;
      }
      if (specialDay.variant === 'open_unexpected') {
        return <span className="text-fuchsia-400 font-semibold">Apertura Excepcional ({start} - {end})</span>;
      }
    }

    if (regularDay?.active) {
      return <span className="text-slate-400 font-medium">Horario habitual ({regularDay.start} - {regularDay.end})</span>;
    }

    return <span className="text-slate-500 font-medium">Cerrado por descanso</span>;
  };

  const businessHours = getBusinessHours();

  // Calcular resumen acumulado de horas ordinarias, festivas, extras y tipo de turno por empleado
  const employeesSummary = useMemo(() => {
    let baseEmployees = employees;
    if (selectedTeamId !== 'all') {
      baseEmployees = employees.filter(e => e.team_id === selectedTeamId);
    }
    
    const targetDatesStr = summaryDates.map(d => getLocalDateString(d));
    
    return baseEmployees.map(emp => {
      const empShifts = shifts.filter(s => 
        s.employee_id === emp.id && 
        targetDatesStr.includes(s.date) && 
        s.status !== 'pending_deletion'
      );
      
      let ordinaryHours = 0;
      let festiveHours = 0;
      let extraHours = 0;
      let plusHours = 0;
      const typeDetails: Record<string, { count: number, className: string }> = {};
      
      empShifts.forEach(shift => {
        const startHour = parseInt(shift.start_time.split(':')[0], 10);
        const startMin = parseInt(shift.start_time.split(':')[1], 10);
        const endHour = parseInt(shift.end_time.split(':')[0], 10);
        const endMin = parseInt(shift.end_time.split(':')[1], 10);
        
        let startFraction = startHour + (startMin / 60);
        let endFraction = endHour + (endMin / 60);
        if (endFraction < startFraction) endFraction += 24;
        
        let duration = endFraction - startFraction;
        
        if (shift.notes) {
          const breakMatch = shift.notes.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*[^)]+)?\)/i);
          if (breakMatch) {
            const breakMinutes = parseInt(breakMatch[1], 10);
            const type = breakMatch[2] || '';
            const isPaid = type.toLowerCase().includes('pagado');
            if (!isPaid) {
              duration -= (breakMinutes / 60);
            }
          }
        }
        
        // Determinar si la fecha del turno es un festivo abierto/parcial o excepcional
        const specialDay = specialDays[shift.date];
        const isFestive = specialDay && (
          specialDay.variant === 'open_holiday' || 
          specialDay.variant === 'open_partial_holiday' || 
          specialDay.variant === 'open_unexpected'
        );
        
        if (isFestive) {
          festiveHours += duration;
        } else {
          ordinaryHours += duration;
        }
        
        if (shift.overtime) {
          extraHours += shift.overtime;
        }
        
        const typeInfo = getShiftTypeIndicator(shift);
        const typeLabel = typeInfo.label;
        
        const comp = getShiftComplement(shift);
        if (!comp.isSplit || comp.isFirstTramo) {
          if (!typeDetails[typeLabel]) {
            typeDetails[typeLabel] = { count: 0, className: typeInfo.className };
          }
          typeDetails[typeLabel].count += 1;
        }
        
        if (typeInfo.hasPlus) {
          plusHours += duration;
        }
      });
      
      const totalHours = ordinaryHours + festiveHours + extraHours;
      
      // Chequeo de alertas legales: > 40h o descansos < 12h
      // Solo mostramos alerta de >40h si estamos viendo la vista semanal
      let hasOvertimeAlert = summaryPeriod === 'week' ? (totalHours > 40) : false;
      let hasRestAlert = false;
      
      // Ordenar cronológicamente para check de descanso (solo en vista semanal)
      let restAlertDays: string[] = [];
      if (summaryPeriod === 'week') {
        const sortedShifts = [...empShifts].sort((a, b) => {
          const dateA = a.date + ' ' + a.start_time;
          const dateB = b.date + ' ' + b.start_time;
          return dateA.localeCompare(dateB);
        });
        
        for (let i = 0; i < sortedShifts.length - 1; i++) {
          const s1 = sortedShifts[i];
          const s2 = sortedShifts[i+1];
          
          // Ignorar la regla de las 12 horas si los dos turnos pertenecen al mismo día 
          // (esto sucede en las jornadas partidas, donde el descanso intermedio no es entre jornadas)
          if (s1.date === s2.date) continue;
          
          // Calcular tiempo de fin s1 (ignorando overtime para este caso o sumándolo)
          const d1End = new Date(`${s1.date}T${getAdjustedEndTime(s1.end_time, s1.overtime)}:00`);
          if (getAdjustedEndTime(s1.end_time, s1.overtime) < s1.start_time) {
            d1End.setDate(d1End.getDate() + 1);
          }
          
          const d2Start = new Date(`${s2.date}T${s2.start_time}:00`);
          
          const diffHours = (d2Start.getTime() - d1End.getTime()) / (1000 * 60 * 60);
          if (diffHours > 0 && diffHours < 12) {
            hasRestAlert = true;
            const dayName = d2Start.toLocaleDateString('es-ES', { weekday: 'long' });
            const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
            if (!restAlertDays.includes(capitalizedDay)) {
              restAlertDays.push(capitalizedDay);
            }
          }
        }
      }
      
      return {
        employee: emp,
        ordinaryHours,
        festiveHours,
        extraHours,
        plusHours,
        totalHours,
        typeDetails,
        hasOvertimeAlert,
        hasRestAlert,
        restAlertDays,
        hasShifts: empShifts.length > 0
      };
    });
  }, [employees, selectedTeamId, summaryDates, shifts, specialDays, companyBreakIncluded, summaryPeriod]);

  // Eventos de comunicación con el Sidebar para el botón de Publicar
  useEffect(() => {
    const unpublishedCount = shifts.filter(s => s.is_published === false).length;
    window.dispatchEvent(new CustomEvent('fycheo-drafts-updated', { detail: unpublishedCount }));
  }, [shifts]);

  useEffect(() => {
    const handlePublishDone = () => {
      setShifts(prev => {
        const withoutDeleted = prev.filter(s => s.status !== 'pending_deletion');
        const updated = withoutDeleted.map(s => ({ ...s, is_published: true }));
        publishedShiftsRef.current = JSON.stringify(updated);
        return updated;
      });
    };
    window.addEventListener('fycheo-publish-done', handlePublishDone);
    return () => window.removeEventListener('fycheo-publish-done', handlePublishDone);
  }, []);

  // Obtener el rango dinámico de horas del timeline para el día seleccionado
  const timelineHours = useMemo(() => {
    const dateStr = getLocalDateString(selectedDate);
    const dayShifts = shifts.filter(s => s.date === dateStr);

    let minHour = 24;
    let maxHour = 0;

    // 1. Horario comercial
    const bHours = getBusinessHours();
    if (bHours) {
      minHour = Math.min(minHour, Math.floor(bHours.start));
      maxHour = Math.max(maxHour, Math.ceil(bHours.end));
    }

    // 2. Horario de los turnos de los empleados
    dayShifts.forEach(shift => {
      const startH = parseInt(shift.start_time.split(':')[0], 10);
      minHour = Math.min(minHour, startH);

      const adjustedEnd = getAdjustedEndTime(shift.end_time, shift.overtime);
      const endH = Math.ceil(parseInt(adjustedEnd.split(':')[0], 10) + parseInt(adjustedEnd.split(':')[1], 10) / 60);

      if (endH < startH) {
        maxHour = Math.max(maxHour, endH + 24); // Sumar 24h si el turno cruza la medianoche
      } else {
        maxHour = Math.max(maxHour, endH);
      }
    });

    // 3. Valores por defecto si todo está cerrado y vacío ese día
    if (minHour === 24 && maxHour === 0) {
      minHour = 8;
      maxHour = 18;
    }

    // Margen de 1 hora antes y después por comodidad visual
    const startRange = Math.max(0, minHour - 1);
    const endRange = Math.min(48, maxHour + 1); // Ampliar límite superior a 48h para acomodar el día siguiente

    const length = endRange - startRange;
    if (length <= 0) {
      return Array.from({ length: 11 }).map((_, i) => 8 + i);
    }

    return Array.from({ length }).map((_, i) => startRange + i);
  }, [selectedDate, shifts, specialDays, weeklySchedule]);

  // Calcular número de trabajadores programados en el día
  const currentDayShifts = shifts.filter(s => s.date === getLocalDateString(selectedDate) && s.status !== 'pending_deletion');
  let employeesToShowForCount = employees;
  if (selectedTeamId !== 'all') {
    employeesToShowForCount = employees.filter(e => e.team_id === selectedTeamId);
  }
  const employeeIdsToShow = new Set(employeesToShowForCount.map(e => e.id));
  const scheduledCount = new Set(
    currentDayShifts
      .filter(s => employeeIdsToShow.has(s.employee_id))
      .map(s => s.employee_id)
  ).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Columna Izquierda: Controles principales */}
        <div className="flex-1 space-y-6">
          {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">Gestión de Horarios</h1>

                {/* Indicador de Autoguardado (Estilo Google Sheets) */}
                <div className="flex-shrink-0 mt-1">
                  {saveStatus === 'saving' ? (
                    <div className="flex items-center gap-1.5 text-blue-400/80 text-[10px] font-medium select-none animate-pulse">
                      <Loader2 size={10} className="animate-spin text-blue-400" />
                      <span>Guardando...</span>
                    </div>
                  ) : saveStatus === 'error' ? (
                    <div className="flex items-center gap-1.5 text-red-400/90 text-[10px] font-medium select-none">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                      <span>Error al guardar (ver consola)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400/70 text-[10px] font-normal select-none">
                      <Check size={10} className="text-emerald-400/80" />
                      <span>Cambios guardados</span>
                    </div>
                  )}
                </div>
              </div>


            </div>
            <p className="text-slate-400 text-sm">Organiza los turnos de tu equipo</p>

          {/* Selector de Equipos + Permisos Especiales */}
          <div className="flex items-center justify-between gap-3">
            {teams.length > 0 && (
              <div className="w-full sm:w-72">
                <CustomSelect
                  value={selectedTeamId}
                  onChange={(val) => setSelectedTeamId(val)}
                  options={[
                    { value: 'all', label: 'Todos los equipos' },
                    ...teams.map(team => ({ value: team.id, label: team.name }))
                  ]}
                  variant="filter"
                />
              </div>
            )}
            <button
              onClick={() => setIsAbsencesModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl font-medium transition-colors border border-indigo-500/20 flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <Palmtree size={16} />
              Tiempo Libre
            </button>
          </div>

          {/* Controles del calendario */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d);
                  setSelectedDates([d]);
                  setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="relative flex items-center flex-shrink-0">
                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0"
                  title="Seleccionar fecha"
                >
                  <CalendarDays size={18} className="text-primary" />
                </button>
                <input
                  type="date"
                  ref={dateInputRef}
                  value={getLocalDateString(selectedDate)}
                  onChange={handleDateChange}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                />
              </div>

              <div className="flex flex-col min-w-0">
                <button
                  onClick={() => dateInputRef.current?.showPicker()}
                  className="text-left text-white font-medium text-sm sm:text-base capitalize truncate hover:text-primary transition-colors flex items-center gap-1.5 focus:outline-none"
                  title="Hacer clic para cambiar la fecha"
                >
                  {selectedDates.length > 1 ? (
                    <span className="flex items-center gap-1.5">
                      {isRangeConsecutive(selectedDates) ? (
                        <span>
                          {selectedDates[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {selectedDates[selectedDates.length - 1].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : (
                        <span>Días alternos seleccionados</span>
                      )}
                      <span className="text-xs text-primary font-semibold">({selectedDates.length} días)</span>
                    </span>
                  ) : (
                    selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
                  )}
                </button>
                <span className="text-[11px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {getTimelineDateSubtitle()}
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">
                    {selectedDates.length > 1 ? (
                      <span>Replicación activa</span>
                    ) : (
                      scheduledCount === 0
                        ? 'Sin trabajadores programados'
                        : scheduledCount === 1
                          ? '1 trabajador programado'
                          : `${scheduledCount} trabajadores programados`
                    )}
                  </span>
                </span>
              </div>

              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d);
                  setSelectedDates([d]);
                  setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors flex-shrink-0"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div ref={dropdownRef} className="relative ml-auto">
              <button
                onClick={() => setShowActionsDropdown(prev => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-white text-sm font-medium transition-colors border border-white/5"
              >
                <Copy size={16} className="text-slate-400" />
                <span>Acciones del Día</span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${showActionsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showActionsDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-surface-dark border border-white/10 rounded-xl shadow-xl z-50"
                >
                  <div className="p-1">
                    <button
                      onClick={handleCopyDay}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Copy size={14} className="text-primary" /> Copiar este día
                    </button>

                    <button
                      onClick={handlePasteDay}
                      disabled={!copiedShifts || copiedShifts.length === 0}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent disabled:text-slate-500 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download size={14} className="text-blue-400" /> Pegar en este día
                    </button>

                    <button
                      onClick={handleRepeatWeek}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Calendar size={14} className="text-emerald-400" /> Repetir toda la semana
                    </button>

                    <button
                      onClick={handleRepeatMonth}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <CalendarDays size={14} className="text-orange-400" /> Repetir todo el mes
                    </button>

                    <div className="h-px bg-white/10 my-1 mx-2"></div>

                    <button
                      onClick={() => {
                        setTemplateName('');
                        setIsSaveModalOpen(true);
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Save size={14} className="text-slate-400" /> Guardar como plantilla
                    </button>

                    <button
                      onClick={() => {
                        setIsLoadModalOpen(true);
                        setShowActionsDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download size={14} className="text-slate-400" /> Cargar plantilla
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Tipos de Jornada (Draggables) */}
          <div className="bg-surface-dark p-4 rounded-2xl border border-white/5 shadow-sm">
            <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
              Tipos de Jornada
              <span className="text-xs text-slate-500 font-normal ml-auto hidden sm:block">Arrastra para asignar</span>
            </h3>
            <div className="flex flex-wrap gap-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: '124px' }}>
              {shiftTypes.map(shift => (
                <div
                  key={shift.id}
                  className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-2.5 cursor-grab active:cursor-grabbing transition-all group"
                  draggable
                  onDragStart={(e: any) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                      type: 'new_shift_type',
                      shiftType: shift
                    }));
                  }}
                >
                  <div
                    className={`w-2 h-8 rounded-full shrink-0 ${(!shift.color || shift.color.startsWith('#')) ? '' : mapLegacyColor(shift.color)}`}
                    style={shift.color && shift.color.startsWith('#') ? { backgroundColor: shift.color } : undefined}
                  />
                  <div className="pr-2">
                    <p className="text-sm font-medium text-white group-hover:text-primary transition-colors leading-none">{shift.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                      {shift.start && shift.end ? `${shift.start} - ${shift.end}` : shift.time} <span className="opacity-50">·</span> {shift.duration}
                    </p>
                  </div>
                </div>
              ))}

              {/* Elemento de arrastre Personalizado */}
              <div
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl p-2.5 cursor-grab active:cursor-grabbing transition-all group"
                draggable
                onDragStart={(e: any) => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: 'custom_shift_drag'
                  }));
                }}
              >
                <div className="w-2 h-8 rounded-full border border-dashed border-slate-500 bg-transparent"></div>
                <div className="pr-2">
                  <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors leading-none">Personalizado</p>
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center gap-1">
                    <Clock size={10} /> Configurar...
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Columna Derecha: Acciones y Mini Calendario */}
        <div className="flex flex-col w-full xl:w-80">

          {/* Mini Calendario */}
          <div className="bg-surface-dark p-5 rounded-2xl border border-white/5 shadow-sm flex-1 flex flex-col">
            {(() => {
              const currentMonth = calendarMonth.getMonth();
              const currentYear = calendarMonth.getFullYear();

              const firstDay = new Date(currentYear, currentMonth, 1).getDay();
              const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
              const startDay = firstDay === 0 ? 6 : firstDay - 1; // Lunes como primer día

              // Pre-calcular conteos de trabajadores por fecha
              const scheduledCountsByDate: Record<string, Set<string>> = {};
              shifts.forEach(s => {
                if (!scheduledCountsByDate[s.date]) {
                  scheduledCountsByDate[s.date] = new Set<string>();
                }
                const emp = employees.find(e => e.id === s.employee_id);
                if (emp && (selectedTeamId === 'all' || emp.team_id === selectedTeamId)) {
                  scheduledCountsByDate[s.date].add(s.employee_id);
                }
              });

              const days = [];
              for (let i = 0; i < startDay; i++) {
                days.push(<div key={`empty-${i}`} className="h-11"></div>);
              }
              for (let i = 1; i <= daysInMonth; i++) {
                const dateObj = new Date(currentYear, currentMonth, i);
                const localDateStr = getLocalDateString(dateObj);

                let isSelected = false;

                if (selectedDates.length > 0) {
                  isSelected = selectedDates.some(d => d.toDateString() === dateObj.toDateString());
                }

                const isToday = dateObj.toDateString() === new Date().toDateString();
                let specialType = specialDays[localDateStr]?.variant;

                // Si el día de la semana está cerrado en el horario base y no hay evento especial, por defecto es cerrado
                const isDayOpen = weeklySchedule[dateObj.getDay()]?.active;
                if (!specialType && !isDayOpen) {
                  specialType = 'closed_normal';
                }
                let tooltipText = 'Día Normal';
                if (specialType === 'closed_normal') tooltipText = 'Cerrado';
                else if (specialType === 'closed_holiday') tooltipText = 'Festivo Cerrado';
                else if (specialType === 'open_holiday') tooltipText = 'Festivo Abierto';
                else if (specialType === 'open_partial_holiday') tooltipText = 'Festivo Parcial';
                else if (specialType === 'open_unexpected') tooltipText = 'Excepcional';

                const cellScheduledCount = scheduledCountsByDate[localDateStr]?.size || 0;

                // Calcular vecindad en la selección
                const prevDate = new Date(dateObj);
                prevDate.setDate(prevDate.getDate() - 1);
                const nextDate = new Date(dateObj);
                nextDate.setDate(nextDate.getDate() + 1);

                const isPrevSelected = selectedDates.some(d => d.toDateString() === prevDate.toDateString());
                const isNextSelected = selectedDates.some(d => d.toDateString() === nextDate.toDateString());

                const cellClass = isSelected
                  ? selectedDates.length > 1
                    ? isPrevSelected && isNextSelected
                      ? 'bg-primary/20 text-white rounded-none border-y border-primary/30'
                      : isPrevSelected && !isNextSelected
                        ? 'bg-primary text-white rounded-r-xl rounded-l-none shadow-sm shadow-primary/20'
                        : !isPrevSelected && isNextSelected
                          ? 'bg-primary text-white rounded-l-xl rounded-r-none shadow-sm shadow-primary/20'
                          : 'bg-primary text-white rounded-xl shadow-sm shadow-primary/20'
                    : 'border-2 border-primary bg-primary/10 text-white rounded-xl'
                  : isToday && !specialType
                    ? 'bg-primary/10 hover:bg-primary/20 text-primary rounded-xl'
                    : specialType === 'closed_normal' ? 'text-slate-500 hover:bg-white/5 opacity-50 rounded-xl'
                      : specialType === 'closed_holiday' ? 'text-red-400 hover:bg-red-400/10 rounded-xl'
                        : specialType === 'open_holiday' ? 'text-emerald-400 hover:bg-emerald-400/10 rounded-xl'
                          : specialType === 'open_partial_holiday' ? 'text-orange-400 hover:bg-orange-400/10 rounded-xl'
                            : specialType === 'open_unexpected' ? 'text-fuchsia-400 hover:bg-fuchsia-400/10 rounded-xl'
                              : 'text-white hover:bg-white/10 rounded-xl';

                days.push(
                  <div
                    key={i}
                    onMouseDown={(e) => {
                      e.preventDefault();

                      if (e.ctrlKey || e.metaKey) {
                        setSelectedDates(prev => {
                          const exists = prev.some(d => d.toDateString() === dateObj.toDateString());
                          let newDates: Date[];
                          if (exists) {
                            newDates = prev.filter(d => d.toDateString() !== dateObj.toDateString());
                            if (newDates.length === 0) newDates = [dateObj];
                          } else {
                            newDates = [...prev, dateObj];
                          }
                          newDates.sort((a, b) => a.getTime() - b.getTime());
                          setSelectedDate(newDates[0] || dateObj);
                          return newDates;
                        });
                        setIsSelectingRange(false);
                      } else {
                        setIsSelectingRange(true);
                        setRangeStart(dateObj);

                        setSelectedDate(dateObj);
                        setSelectedDates([dateObj]);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (isSelectingRange && rangeStart) {
                        // Comprobación de seguridad: Si el botón izquierdo no está pulsado (e.buttons !== 1),
                        // significa que el usuario soltó el click pero el evento mouseup se perdió.
                        // Cancelamos la selección en rango para que no se "atasque".
                        if (e.buttons !== 1) {
                          setIsSelectingRange(false);
                          setRangeStart(null);
                          return;
                        }
                        const dates = getDatesInRange(rangeStart, dateObj);
                        setSelectedDates(dates);
                        setSelectedDate(dates[0]);
                      }
                    }}
                    className={`relative group h-11 flex flex-col items-center justify-center text-sm font-medium cursor-pointer transition-all select-none ${cellClass}`}
                  >
                    <span>{i}</span>
                    {cellScheduledCount > 0 && (
                      <span className={`text-[9px] font-semibold leading-none mt-0.5 group-hover:text-slate-400 transition-colors ${isSelected && (selectedDates.length === 1 || (!isPrevSelected || !isNextSelected))
                        ? 'text-white/80'
                        : 'text-slate-500'
                        }`}>
                        {cellScheduledCount}
                      </span>
                    )}
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-slate-200 text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg border border-white/10">
                      {tooltipText} ({cellScheduledCount === 1 ? '1 trab.' : `${cellScheduledCount} trab.`})
                    </div>
                  </div>
                );
              }

              const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

              return (
                <div className="flex flex-col flex-1 justify-between">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-medium text-sm capitalize">
                      {calendarMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-1">
                      <button onClick={() => setCalendarMonth(new Date(currentYear, currentMonth - 1, 1))} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                      <button onClick={() => setCalendarMonth(new Date(currentYear, currentMonth + 1, 1))} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-end">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {weekDays.map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-slate-500">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Lista de Turnos (Escaleta / Bandas) */}
      <div className="bg-surface-dark rounded-2xl border border-white/5 overflow-hidden flex flex-col relative shadow-sm">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          (() => {
            const closureReason = getClosureReason();
            if (closureReason) {
              return (
                <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center gap-4 py-24 select-none bg-slate-950/5">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-lg mb-2">
                    <Clock size={28} className="opacity-80" />
                  </div>
                  <h4 className="text-lg font-bold text-white tracking-wide">Establecimiento Cerrado</h4>
                  <p className="text-sm text-slate-500 max-w-md">
                    La planificación de turnos no está disponible hoy porque el comercio está configurado como <span className="text-red-400 font-semibold">{closureReason}</span>.
                  </p>
                </div>
              );
            }

            return (
              <>
                {/* Sleek Zoom Header Toolbar */}
                <div className="flex flex-col sm:flex-row px-6 pt-5 pb-3 bg-surface-dark gap-4 justify-between border-b border-white/5 items-start sm:items-center">
                  <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="text-primary" size={18} />
                      <h3 className="text-sm font-semibold text-white">Planificación de Turnos</h3>
                    </div>

                    {/* Botones de Deshacer / Rehacer */}
                    <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-lg border border-white/5">
                      <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="p-1 transition-all text-slate-400 hover:text-white disabled:text-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                        title="Deshacer (Ctrl + Z)"
                      >
                        <Undo size={16} />
                      </button>
                      <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="p-1 transition-all text-slate-400 hover:text-white disabled:text-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                        title="Rehacer (Ctrl + Y)"
                      >
                        <Redo size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Controles de Zoom */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto select-none border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setZoom(prev => Math.max(1, prev - 0.25))}
                        className="text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer"
                        disabled={zoom <= 1}
                        title="Reducir Zoom"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.25"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-24 sm:w-28 accent-primary cursor-pointer h-[3px] bg-white/10 rounded-lg appearance-none transition-all focus:outline-none"
                      />
                      <button
                        onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
                        className="text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer"
                        disabled={zoom >= 4}
                        title="Aumentar Zoom"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 w-10 text-right select-none">{Math.round(zoom * 100)}%</span>
                  </div>
                </div>



                <div
                  ref={timelineViewportRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                  className="overflow-x-auto custom-scrollbar cursor-grab"
                  style={{ transform: 'rotateX(180deg)' }}
                >
                  <div
                    className="pb-4"
                    style={{
                      width: `${100 * zoom}%`,
                      minWidth: `${Math.max(700, 700 * zoom)}px`,
                      transform: 'rotateX(180deg)'
                    }}
                  >
                    {/* Timeline Header (Hours) */}
                    {(() => {
                      const dateStr = getLocalDateString(selectedDate);
                      const dayOfWeek = selectedDate.getDay();
                      const specialDay = specialDays[dateStr];
                      const isBaseOpen = weeklySchedule[dayOfWeek]?.active;

                      let dayTypeLabel = 'Día Normal';
                      let dayBg = '#111622'; // bg-surface-dark
                      let dayBorder = 'rgba(255,255,255,0.05)'; // border-white/5
                      let dayTextColor = '#94a3b8'; // text-slate-400

                      if (specialDay) {
                        if (specialDay.variant === 'open_holiday') {
                          dayTypeLabel = 'Festivo Abierto';
                          dayBg = '#101e19'; // Verde esmeralda muy oscuro
                          dayBorder = 'rgba(16,185,129,0.15)'; // emerald-500 con opacidad
                          dayTextColor = '#34d399'; // emerald-400
                        } else if (specialDay.variant === 'open_partial_holiday') {
                          dayTypeLabel = 'Festivo Parcial';
                          dayBg = '#241712'; // Naranja/marrón muy oscuro
                          dayBorder = 'rgba(245,158,11,0.2)'; // amber-500 con opacidad
                          dayTextColor = '#fbbf24'; // amber-400
                        } else if (specialDay.variant === 'open_unexpected') {
                          dayTypeLabel = 'Día Excepcional';
                          dayBg = '#1c1221'; // Fucsia/púrpura muy oscuro
                          dayBorder = 'rgba(217,70,239,0.2)'; // fuchsia-500 con opacidad
                          dayTextColor = '#f472b6'; // pink-400
                        } else if (specialDay.variant === 'closed_holiday') {
                          dayTypeLabel = 'Festivo (Cerrado)';
                          dayBg = '#211214'; // Rojo muy oscuro
                          dayBorder = 'rgba(239,68,68,0.2)'; // red-500 con opacidad
                          dayTextColor = '#f87171'; // red-400
                        } else if (specialDay.variant === 'closed_normal') {
                          dayTypeLabel = 'Cerrado';
                          dayBg = '#161920'; // Gris azulado oscuro
                          dayBorder = 'rgba(255,255,255,0.05)';
                          dayTextColor = '#94a3b8';
                        }
                      } else if (!isBaseOpen) {
                        dayTypeLabel = 'Cerrado (Descanso)';
                        dayBg = '#1d1214'; // Rojo/descanso muy oscuro
                        dayBorder = 'rgba(239,68,68,0.15)';
                        dayTextColor = '#f87171';
                      }

                      return (
                        <div 
                          className="flex border-b sticky top-0 z-30 h-16 items-end pb-1 transition-colors duration-300"
                          style={{ backgroundColor: dayBg, borderColor: dayBorder }}
                        >
                          {/* Celda de Tipo de Día */}
                          <div 
                            className="w-48 flex-shrink-0 z-30 sticky left-0 border-r flex flex-col justify-center px-4 self-stretch select-none transition-colors duration-300"
                            style={{ backgroundColor: dayBg, borderColor: dayBorder }}
                          >
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                              Tipo de Día
                            </span>
                            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: dayTextColor }}>
                              {dayTypeLabel}
                            </span>
                          </div>

                          {timelineHours.map((hour) => (
                            <div 
                              key={hour} 
                              className="flex-1 min-w-[32px] border-l relative h-full transition-colors duration-300"
                              style={{ borderColor: dayBorder }}
                            >
                              <div className="absolute bottom-1 left-1/2 origin-bottom-left -rotate-45">
                                <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap tracking-wider">
                                  {`${(hour % 24).toString().padStart(2, '0')}:00`}
                                  {hour >= 24 && <span className="text-[8px] text-primary ml-0.5 font-bold">+1d</span>}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Employees and Shifts Rows */}
                    <div className="flex flex-col relative">
                      {(() => {
                        let baseEmployees = employees;
                        if (selectedTeamId !== 'all') {
                          baseEmployees = employees.filter(e => e.team_id === selectedTeamId);
                        }

                        const employeesToShow = [...baseEmployees].sort((a, b) => {
                          const idxA = employeeOrder.indexOf(a.id);
                          const idxB = employeeOrder.indexOf(b.id);
                          const valA = idxA !== -1 ? idxA : 9999;
                          const valB = idxB !== -1 ? idxB : 9999;
                          return valA - valB;
                        });

                        if (employeesToShow.length === 0) {
                          return (
                            <div className="p-8 text-center text-slate-500">
                              <p>No hay empleados en este equipo.</p>
                            </div>
                          );
                        }

                        return employeesToShow.map((emp, index) => {
                          const empName = emp.full_name || emp.name || emp.email || getEmployeeName(emp.id);
                          const formattedSelectedDate = getLocalDateString(selectedDate);
                          const empShifts = shifts.filter(s => s.employee_id === emp.id && s.date === formattedSelectedDate);
                          const totalHours = calculateTotalHours(empShifts);

                          return (
                            <div key={emp.id} className="flex border-b border-white/5 relative group group/row hover:bg-white/[0.02] transition-colors">
                              {/* Employee Info (Fixed Left) */}
                              <div
                                draggable
                                onDragStart={(e: any) => handleEmployeeDragStart(e, emp.id)}
                                onDragEnd={handleEmployeeDragEnd}
                                onDragOver={(e: any) => handleEmployeeDragOver(e, emp.id)}
                                onDrop={(e: any) => handleEmployeeDrop(e, emp.id)}
                                className={`w-48 flex-shrink-0 p-4 border-r border-white/5 flex items-center gap-2 bg-surface-dark group-hover:bg-[#181e2e] transition-all duration-200 z-30 sticky left-0 cursor-grab active:cursor-grabbing select-none ${dragOverEmployeeId === emp.id ? 'border-t-2 border-t-primary bg-primary/10' : ''
                                  } ${draggedEmployeeId === emp.id ? 'opacity-40' : ''
                                  }`}
                              >
                                {/* Drag Handle icon indicator on hover */}
                                <div className="flex flex-col gap-0.5 text-slate-600 group-hover:text-slate-400 transition-colors mr-1 cursor-grab">
                                  <span className="w-1 h-1 rounded-full bg-current" />
                                  <span className="w-1 h-1 rounded-full bg-current" />
                                  <span className="w-1 h-1 rounded-full bg-current" />
                                </div>

                                <Link to={`/manager/equipos/trabajador/${emp.id}`} className="flex items-center gap-2 min-w-0 flex-1 hover:text-primary transition-colors">
                                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-300 border border-white/10 flex-shrink-0 overflow-hidden">
                                    {emp.avatar ? (
                                      <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <User size={14} />
                                    )}
                                  </div>
                                  <div className="truncate flex-1">
                                    <h3 className="text-white text-sm font-medium truncate group-hover:text-primary transition-colors">{empName}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                      {totalHours > 0 ? `${formatProposedHours(totalHours)} propuestas` : 'Sin turno'}
                                    </p>
                                  </div>
                                </Link>
                              </div>

                              {/* Timeline Area */}
                              <div
                                className="flex-1 relative flex transition-colors duration-200"
                                onDragOver={(e: any) => {
                                  e.preventDefault();
                                  const localDateStr = getLocalDateString(selectedDate);
                                  const isAbsent = getEmployeeAbsence(emp.id, localDateStr);
                                  if (!isAbsent) {
                                    e.currentTarget.classList.add('bg-primary/5');
                                  }
                                }}
                                onDragLeave={(e: any) => {
                                  e.currentTarget.classList.remove('bg-primary/5');
                                }}
                                onDrop={(e: any) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('bg-primary/5');
                                  
                                  const localDateStr = getLocalDateString(selectedDate);
                                  if (getEmployeeAbsence(emp.id, localDateStr)) {
                                    return; // No permitir soltar si está ausente
                                  }
                                  try {
                                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                    const companyId = localStorage.getItem('active_company_id') || '1';

                                    if (data.type === 'custom_shift_drag') {
                                      setCustomShiftEmpId(emp.id);
                                      setCustomShiftStart('09:00');
                                      setCustomShiftEnd('17:00');
                                      setCustomShiftColor('bg-lime-400');
                                      setCustomShiftNotes('');
                                      setIsCustomShiftModalOpen(true);
                                    } else if (data.type === 'existing_shift') {
                                      // Modificar el empleado del turno existente
                                      setShifts(prev => prev.map(s => {
                                        if (s.id === data.shiftId) {
                                          return { ...s, employee_id: emp.id, is_published: false };
                                        }
                                        return s;
                                      }));
                                    } else if (data.type === 'existing_shift_split') {
                                      // Modificar el empleado de ambos tramos de la jornada partida
                                      setShifts(prev => prev.map(s => {
                                        if (s.id === data.shiftIdA || s.id === data.shiftIdB) {
                                          return { ...s, employee_id: emp.id, is_published: false };
                                        }
                                        return s;
                                      }));
                                    } else {
                                      // Es un nuevo turno (bien usando el nuevo formato o el antiguo para compatibilidad)
                                      const shiftTypeData = data.type === 'new_shift_type' ? data.shiftType : data;

                                      const { laborables, festivosAbiertos } = classifyDates(selectedDates, specialDays, weeklySchedule);

                                      if (festivosAbiertos.length > 0) {
                                        setPendingAssignment({
                                          employeeId: emp.id,
                                          shiftTypeData: shiftTypeData
                                        });
                                        setIsHolidayConfirmModalOpen(true);
                                      } else {
                                        const targetDates = laborables;
                                        if (targetDates.length > 0) {
                                          const newShiftsToAdd: Shift[] = [];
                                          targetDates.forEach((dateObj, dIdx) => {
                                            const dateStr = getLocalDateString(dateObj);
                                            const isSplitShift = shiftTypeData.isSplit || shiftTypeData.is_split;
                                            const breakNotes = shiftTypeData.breakMins ? `(Descanso: ${shiftTypeData.breakMins} min - ${shiftTypeData.breakPaid ? 'Pagado' : 'No pagado'})` : '';
                                            const typePrefix = shiftTypeData.name ? `[${shiftTypeData.name}]` : '';

                                            // Tramo 1
                                            newShiftsToAdd.push({
                                              id: `shift-${Date.now()}-${dIdx}-1-${Math.random().toString(36).substr(2, 9)}`,
                                              employee_id: emp.id,
                                              company_id: companyId,
                                              date: dateStr,
                                              start_time: shiftTypeData.start || shiftTypeData.start_time || '09:00',
                                              end_time: shiftTypeData.end || shiftTypeData.end_time || '17:00',
                                              status: 'scheduled',
                                              color: mapLegacyColor(shiftTypeData.color || shiftTypeData.bg),
                                              notes: [typePrefix, shiftTypeData.notes || breakNotes].filter(Boolean).join(' '),
                                              is_published: false
                                            });

                                            // Tramo 2 (si es jornada partida)
                                            if (isSplitShift) {
                                              newShiftsToAdd.push({
                                                id: `shift-${Date.now()}-${dIdx}-2-${Math.random().toString(36).substr(2, 9)}`,
                                                employee_id: emp.id,
                                                company_id: companyId,
                                                date: dateStr,
                                                start_time: shiftTypeData.start2 || shiftTypeData.start_time2 || '16:00',
                                                end_time: shiftTypeData.end2 || shiftTypeData.end_time2 || '20:00',
                                                status: 'scheduled',
                                                color: mapLegacyColor(shiftTypeData.color || shiftTypeData.bg),
                                                notes: [typePrefix, shiftTypeData.notes || ''].filter(Boolean).join(' '),
                                                is_published: false
                                              });
                                            }
                                          });

                                          setShifts(prev => {
                                            const targetDateStrings = targetDates.map(d => getLocalDateString(d));
                                            const filtered = prev.filter(s => !(s.employee_id === emp.id && targetDateStrings.includes(s.date)));
                                            return [...filtered, ...newShiftsToAdd];
                                          });
                                        }
                                      }
                                    }
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                              >
                                {/* Highlight de horas de apertura */}
                                {businessHours && (
                                  <div
                                    className="absolute top-0 bottom-0 bg-white/[0.03] border-x border-white/10 pointer-events-none z-0"
                                    style={{
                                      left: `${((businessHours.start - timelineHours[0]) / timelineHours.length) * 100}%`,
                                      width: `${((businessHours.end - businessHours.start) / timelineHours.length) * 100}%`
                                    }}
                                  />
                                )}

                                {/* Ausencias */}
                                {(() => {
                                  const localDateStr = getLocalDateString(selectedDate);
                                  const absence = getEmployeeAbsence(emp.id, localDateStr);
                                  if (absence) {
                                    let policyColorHex = '#ef4444'; // red-500 fallback
                                    let policyName = 'Ausencia';
                                    
                                    if (absence.type === 'manual_paid') {
                                      policyColorHex = '#10b981';
                                      policyName = 'Permiso Retribuido';
                                    } else if (absence.type === 'manual_unpaid') {
                                      policyColorHex = '#f59e0b';
                                      policyName = 'Permiso No Retribuido';
                                    } else {
                                      const policy = leavePolicies.find(p => p.id === absence.type);
                                      if (policy) {
                                        policyColorHex = policy.hex;
                                        policyName = policy.name;
                                      } else if (absence.type === 'vacation') {
                                        policyName = 'Vacaciones';
                                      } else if (absence.type === 'medical') {
                                        policyName = 'Baja Médica';
                                      }
                                    }

                                    return (
                                      <div 
                                        className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                                        style={{ backgroundColor: `${policyColorHex}15`, borderTop: `1px solid ${policyColorHex}30`, borderBottom: `1px solid ${policyColorHex}30` }}
                                      >
                                        <span className="font-medium text-sm flex items-center gap-2" style={{ color: policyColorHex }}>
                                          {absence.type === 'medical' ? (
                                            <Stethoscope size={16} />
                                          ) : absence.type === 'vacation' ? (
                                            <Palmtree size={16} />
                                          ) : (
                                            <CalendarOff size={16} />
                                          )}
                                          Ausente: {policyName}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                                {/* Background Grid Lines */}
                                {timelineHours.map((hour) => (
                                  <div key={hour} className="flex-1 min-w-[32px] border-l border-white/5 pointer-events-none relative z-0">
                                    {/* Media hora */}
                                    <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-white/5 opacity-50"></div>
                                  </div>
                                ))}

                                {/* Shift Bands */}
                                {(() => {
                                  // Agrupar los turnos del día que correspondan a una jornada partida
                                  const grouped: { isSplit: boolean; shift?: Shift; shiftA?: Shift; shiftB?: Shift }[] = [];
                                  const sorted = [...empShifts].filter(s => s.status !== 'pending_deletion').sort((a, b) => a.start_time.localeCompare(b.start_time));

                                  let i = 0;
                                  while (i < sorted.length) {
                                    if (i < sorted.length - 1) {
                                      const current = sorted[i];
                                      const next = sorted[i + 1];
                                      // Si no se solapan y están ordenados en el tiempo
                                      if (current.end_time.localeCompare(next.start_time) <= 0) {
                                        grouped.push({
                                          isSplit: true,
                                          shiftA: current,
                                          shiftB: next
                                        });
                                        i += 2;
                                        continue;
                                      }
                                    }
                                    grouped.push({
                                      isSplit: false,
                                      shift: sorted[i]
                                    });
                                    i++;
                                  }

                                  // Función helper para obtener los colores del turno
                                  const getShiftColorConfig = (shift: Shift) => {
                                    const colorClasses = {
                                      blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 bg-blue-500 text-blue-400',
                                      red: 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20 bg-red-500 text-red-400',
                                      emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 bg-emerald-500 text-emerald-400',
                                      yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 bg-yellow-400 text-yellow-400',
                                      orange: 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20 bg-orange-500 text-orange-400',
                                      purple: 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 bg-purple-600 text-purple-400',
                                      cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 bg-cyan-400 text-cyan-400',
                                      pink: 'bg-pink-500/10 border-pink-500/30 text-pink-300 hover:bg-pink-500/20 bg-pink-400 text-pink-400',
                                      amber: 'bg-amber-800/10 border-amber-800/30 text-amber-300 hover:bg-amber-800/20 bg-amber-800 text-amber-500',
                                      slate: 'bg-slate-300/10 border-slate-300/30 text-slate-300 hover:bg-slate-300/20 bg-slate-300 text-slate-400',
                                      lime: 'bg-lime-400/15 border-lime-400/30 text-lime-300 hover:bg-lime-400/25 bg-lime-400 text-lime-400',
                                    };

                                    const neonColorClasses = {
                                      blue: 'bg-cyan-400/10 border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/25 bg-cyan-400 text-cyan-400 ',
                                      red: 'bg-red-400/10 border-red-400/40 text-red-300 hover:bg-red-400/25 bg-red-400 text-red-400',
                                      emerald: 'bg-emerald-400/10 border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/25 bg-emerald-400 text-emerald-400',
                                      yellow: 'bg-yellow-400/10 border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/25 bg-yellow-400 text-yellow-400 ',
                                      orange: 'bg-orange-400/10 border-orange-400/40 text-orange-300 hover:bg-orange-400/25 bg-orange-400 text-orange-400 ',
                                      purple: 'bg-purple-400/10 border-purple-400/40 text-purple-300 hover:bg-purple-400/25 bg-purple-400 text-purple-400',
                                      cyan: 'bg-cyan-400/10 border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/25 bg-cyan-400 text-cyan-400 ',
                                      pink: 'bg-fuchsia-400/10 border-fuchsia-400/40 text-fuchsia-300 hover:bg-fuchsia-400/25 bg-fuchsia-400 text-fuchsia-400',
                                      lime: 'bg-lime-400/10 border-lime-400/40 text-lime-300 hover:bg-lime-400/25 bg-lime-400 text-lime-400 ',
                                    };

                                    let colorKey: keyof typeof colorClasses = 'blue';

                                    const shiftStartNorm = normalizeTime(shift.start_time);
                                    const shiftEndNorm = normalizeTime(shift.end_time);
                                    const comp = getShiftComplement(shift);

                                    const matchedTypeForColor = shiftTypes.find(t => {
                                      const tStartNorm = normalizeTime(t.start || t.start_time);
                                      const tEndNorm = normalizeTime(t.end || t.end_time);
                                      const isTypeSplit = t.isSplit || t.is_split;

                                      if (comp.isSplit) {
                                        if (!isTypeSplit) return false;
                                        const shiftA = comp.isFirstTramo ? shift : comp.partner!;
                                        const shiftB = comp.isFirstTramo ? comp.partner! : shift;
                                        const tStart2Norm = normalizeTime(t.start2 || t.start_time2);
                                        const tEnd2Norm = normalizeTime(t.end2 || t.end_time2);
                                        return tStartNorm === normalizeTime(shiftA.start_time) &&
                                          tEndNorm === normalizeTime(shiftA.end_time) &&
                                          tStart2Norm === normalizeTime(shiftB.start_time) &&
                                          tEnd2Norm === normalizeTime(shiftB.end_time);
                                      } else {
                                        if (isTypeSplit) return false;
                                        return tStartNorm === shiftStartNorm && tEndNorm === shiftEndNorm;
                                      }
                                    });

                                    const rawColor = shift.color
                                      ? shift.color
                                      : (matchedTypeForColor ? (matchedTypeForColor.color || matchedTypeForColor.bg) : null);

                                    const mappedColor = rawColor ? mapLegacyColor(rawColor) : null;
                                    if (mappedColor) {
                                      const clean = mappedColor.replace('bg-', '').replace('-500', '').replace('-600', '').replace('-400', '').replace('-300', '').replace('-800', '').toLowerCase();
                                      if (clean === '#3b82f6') {
                                        colorKey = 'blue';
                                      } else if (clean === '#f59e0b') {
                                        colorKey = 'orange';
                                      } else if (clean === '#10b981') {
                                        colorKey = 'emerald';
                                      } else if (clean === '#ef4444') {
                                        colorKey = 'red';
                                      } else {
                                        if (clean.includes('emerald') || clean.includes('green') || clean.includes('#10b981')) colorKey = 'emerald';
                                        else if (clean.includes('yellow') || clean.includes('#f59e0b')) colorKey = 'yellow';
                                        else if (clean.includes('orange')) colorKey = 'orange';
                                        else if (clean.includes('purple') || clean.includes('indigo') || clean.includes('violet')) colorKey = 'purple';
                                        else if (clean.includes('cyan') || clean.includes('sky')) colorKey = 'cyan';
                                        else if (clean.includes('pink') || clean.includes('fuchsia')) colorKey = 'pink';
                                        else if (clean.includes('amber')) colorKey = 'amber';
                                        else if (clean.includes('slate')) colorKey = 'slate';
                                        else if (clean.includes('lime')) colorKey = 'lime';
                                        else if (clean.includes('red') || clean.includes('#ef4444')) colorKey = 'red';
                                        else colorKey = 'blue';
                                      }
                                    } else if (shift.status === 'completed') {
                                      colorKey = 'emerald';
                                    } else if (shift.status === 'absent') {
                                      colorKey = 'red';
                                    }

                                    const isNeon = rawColor && rawColor.includes('-400');

                                    // Determinar si el turno es personalizado (horario no estándar)
                                    const isPredefined = !!matchedTypeForColor;
                                    const dayOfWeek = new Date(shift.date).getDay();
                                    const regularDay = weeklySchedule[dayOfWeek];
                                    const isHabitual = regularDay?.active &&
                                      normalizeTime(shift.start_time) === normalizeTime(regularDay.start) &&
                                      normalizeTime(shift.end_time) === normalizeTime(regularDay.end);
                                    const hasCustomContext = getShiftContext(shift) !== null;
                                    const isPersonalized = hasCustomContext || (!isPredefined && !isHabitual);

                                    const config = isNeon
                                      ? (neonColorClasses[colorKey as keyof typeof neonColorClasses] || neonColorClasses.blue)
                                      : (colorClasses[colorKey] || colorClasses.blue);
                                    const parts = config.split(' bg-');
                                    const bandStyleClasses = parts[0];
                                    const secondPart = parts[1].split(' text-');
                                    const indicatorColorClass = 'bg-' + secondPart[0];
                                    const clockColorClass = 'text-' + secondPart[1];
                                    const glowClass = isPersonalized ? 'glow-' + colorKey : '';

                                    return { bandStyleClasses, indicatorColorClass, clockColorClass, glowClass, colorKey, isNeon };
                                  };

                                  return grouped.map((group, sIdx) => {
                                    if (!group.isSplit) {
                                      const shift = group.shift!;
                                      const startHour = parseInt(shift.start_time.split(':')[0], 10);
                                      const startMin = parseInt(shift.start_time.split(':')[1], 10);
                                      const endHour = parseInt(shift.end_time.split(':')[0], 10);
                                      const endMin = parseInt(shift.end_time.split(':')[1], 10);

                                      const startFraction = startHour + (startMin / 60);
                                      let baseEndFraction = endHour + (endMin / 60);

                                      if (baseEndFraction < startFraction) baseEndFraction += 24;

                                      const leftPercent = ((startFraction - timelineHours[0]) / timelineHours.length) * 100;
                                      const widthPercent = ((baseEndFraction - startFraction) / timelineHours.length) * 100;


                                      const overtimeWidthPercent = shift.overtime ? (shift.overtime / timelineHours.length) * 100 : 0;

                                      const { bandStyleClasses: baseBandStyleClasses, indicatorColorClass, clockColorClass, glowClass: baseGlowClass } = getShiftColorConfig(shift);

                                      // Estilos para turnos en borrador (no publicados)
                                      const isDraft = shift.is_published === false;
                                      const bandStyleClasses = baseBandStyleClasses + (isDraft ? ' border-dashed border-2 opacity-80 border-blue-400/50' : '');
                                      const glowClass = baseGlowClass + (isDraft ? ' !shadow-[0_0_15px_rgba(96,165,250,0.3)]' : '');

                                      return (
                                        <Fragment key={shift.id}>
                                          <motion.div
                                            draggable
                                            onDragStart={(e: any) => {
                                              e.dataTransfer.setData('text/plain', JSON.stringify({
                                                type: 'existing_shift',
                                                shiftId: shift.id
                                              }));
                                              e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            initial={{ opacity: 0, scaleX: 0 }}
                                            animate={{ opacity: 1, scaleX: 1 }}
                                            transition={{ delay: index * 0.1 + sIdx * 0.05, duration: 0.4, ease: "easeOut" }}
                                            style={{
                                              left: `${leftPercent}%`,
                                              width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
                                              transformOrigin: 'left'
                                            }}
                                            title={shift.notes ? `Observaciones: ${shift.notes}` : undefined}
                                            className={`absolute top-1/2 -translate-y-1/2 h-12 cursor-grab active:cursor-grabbing ${glowClass} transition-all rounded-xl z-20`}
                                            onClick={() => {
                                              setSelectedShiftToEdit(shift);
                                              setEditShiftStart(shift.start_time);
                                              setEditShiftEnd(shift.end_time);
                                              setEditShiftColor(shift.color || 'bg-blue-500');

                                              let notesClean = shift.notes || '';
                                              let hasPlus = false;
                                              if (notesClean.includes('(Plus)')) {
                                                hasPlus = true;
                                                notesClean = notesClean.replace(/\(Plus\)\s*·?\s*/i, '').trim();
                                              }
                                              setEditShiftHasPlus(hasPlus);

                                              let breakVal = 0;
                                              let breakPaidVal = companyBreakIncluded;
                                              const breakMatch = notesClean.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*([^)]+))?\)/i);
                                              if (breakMatch) {
                                                breakVal = parseInt(breakMatch[1], 10);
                                                const type = breakMatch[2] || '';
                                                breakPaidVal = type.toLowerCase().includes('pagado');
                                                notesClean = notesClean.replace(/\(Descanso:\s*\d+\s*min(?:\s*-\s*[^)]+)?\)\s*·?\s*/i, '').trim();
                                              }

                                              setEditShiftNotes(notesClean);
                                              setEditShiftBreak(breakVal);
                                              setEditShiftBreakPaid(breakPaidVal);
                                              setIsEditShiftModalOpen(true);
                                            }}
                                          >
                                            <div className={`relative w-full h-full flex items-center px-3 border shadow-sm overflow-hidden backdrop-blur-sm group/band ${bandStyleClasses} rounded-xl`}>
                                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${indicatorColorClass}`}></div>
                                              <div className="flex items-center gap-2.5 whitespace-nowrap min-w-0 pl-1.5 z-10 w-full">
                                                <Clock size={14} className={`flex-shrink-0 opacity-70 self-center ${clockColorClass}`} />

                                                <div className="flex flex-col min-w-0 leading-normal w-full">
                                                  {/* Fila superior */}
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs font-semibold truncate tracking-wide flex items-center gap-1.5">
                                                      {(() => {
                                                        const notes = shift.notes || '';
                                                        const t2m = notes.match(/\(Descanso T2:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i);
                                                        const t1m = notes.match(/\(Descanso T1:\s*(\d+)\s*min\s*-\s*([^)]+)\)/i) || notes.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*([^)]+))?\)/i);
                                                        const endBreakMins = t2m ? parseInt(t2m[1]) : (t1m ? parseInt(t1m[1]) : 0);
                                                        const endIsPaid = t2m ? t2m[2].toLowerCase().includes('pagado') : (t1m ? (t1m[2] || '').toLowerCase().includes('pagado') : false);
                                                        const totalMins = (t1m ? parseInt(t1m[1]) : 0) + (t2m ? parseInt(t2m[1]) : 0);
                                                        return (
                                                          <>
                                                            <span>{shift.start_time} - {getAdjustedEndTime(shift.end_time, shift.overtime, endIsPaid ? 0 : endBreakMins)}</span>
                                                            {totalMins > 0 && (
                                                              <span
                                                                className={`text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 select-none ${endIsPaid
                                                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                                  : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                                                  }`}
                                                                title={`Descanso total: ${totalMins}min`}
                                                              >
                                                                ☕ {totalMins}m
                                                              </span>
                                                            )}
                                                          </>
                                                        );
                                                      })()}
                                                    </span>

                                                    {/* Indicador del tipo de turno */}
                                                    {(() => {
                                                      const typeIndicator = getShiftTypeIndicator(shift);
                                                      return (
                                                        <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${typeIndicator.className} flex-shrink-0 select-none`}>
                                                          {typeIndicator.label}
                                                        </span>
                                                      );
                                                    })()}

                                                    {/* Notas */}
                                                    {getShiftContext(shift) && (
                                                      <span title={getShiftContext(shift) || undefined} className="flex-shrink-0">
                                                        <FileText
                                                          size={12}
                                                          className="text-slate-400 hover:text-white transition-colors cursor-help"
                                                        />
                                                      </span>
                                                    )}
                                                  </div>

                                                  {/* Fila inferior */}
                                                  <div className="flex items-center gap-1 min-w-0 text-[9px] font-medium italic text-slate-400 opacity-75 truncate" title={shift.notes}>
                                                    <span>
                                                      {(() => {
                                                        const baseStatus = shift.status === 'completed' ? 'Completado' : shift.status === 'absent' ? 'Ausente' : 'Programado';
                                                        const context = getShiftContext(shift);
                                                        return context ? `${baseStatus} · ${context}` : baseStatus;
                                                      })()}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-1 shrink-0 ml-auto">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShiftIdToDelete(shift.id);
                                                    setDeleteConfirmOpen(true);
                                                  }}
                                                  className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-65 hover:opacity-100"
                                                  title="Eliminar turno"
                                                >
                                                  <Trash2 size={12} />
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (e.ctrlKey) {
                                                      setShifts(prev => prev.map(s => {
                                                        if (s.id === shift.id) {
                                                          const current = s.overtime || 0;
                                                          return { ...s, overtime: current + 1, is_published: false };
                                                        }
                                                        return s;
                                                      }));
                                                    } else if (e.altKey) {
                                                      setShifts(prev => prev.map(s => {
                                                        if (s.id === shift.id) {
                                                          const current = s.overtime || 0;
                                                          const val = Math.max(0, current - 1);
                                                          return { ...s, overtime: val > 0 ? val : undefined, is_published: false };
                                                        }
                                                        return s;
                                                      }));
                                                    } else {
                                                      setSelectedOvertimeShiftId(shift.id);
                                                      setOvertimeInputValue(shift.overtime ? String(shift.overtime) : '2');
                                                      setOvertimeModalOpen(true);
                                                    }
                                                  }}
                                                  className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all opacity-65 hover:opacity-100"
                                                  title={ctrlPressed ? "Ctrl + Click: Añadir 1 hora extra automáticamente" : altPressed ? "Alt + Click: Quitar 1 hora extra automáticamente" : "Añadir suplemento de horas extras"}
                                                >
                                                  <Plus size={12} />
                                                </button>
                                              </div>
                                            </div>
                                          </motion.div>

                                          {shift.overtime && (
                                            <motion.div
                                              initial={{ opacity: 0, scaleX: 0 }}
                                              animate={{ opacity: 1, scaleX: 1 }}
                                              transition={{ delay: index * 0.1 + sIdx * 0.05 + 0.1, duration: 0.4, ease: "easeOut" }}
                                              style={{
                                                left: `calc(${leftPercent + widthPercent}% - 8px)`,
                                                width: `calc(${overtimeWidthPercent}% + 8px)`,
                                                transformOrigin: 'left'
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedOvertimeShiftId(shift.id);
                                                setOvertimeInputValue(String(shift.overtime));
                                                setOvertimeModalOpen(true);
                                              }}
                                              className={`absolute top-1/2 -translate-y-1/2 h-8 flex items-center justify-center border border-white/20 ${indicatorColorClass} text-white font-extrabold text-[10px] select-none rounded-xl z-10 cursor-pointer hover:brightness-110 transition-all shadow-md`}
                                              title={`Suplemento de horas extras: +${shift.overtime} horas. Haz clic para modificar.`}
                                            >
                                              +{shift.overtime}h
                                            </motion.div>
                                          )}
                                        </Fragment>
                                      );
                                    } else {
                                      // Caso JORNADA PARTIDA AGRUPADA
                                      const shiftA = group.shiftA!;
                                      const shiftB = group.shiftB!;

                                      const startHour = parseInt(shiftA.start_time.split(':')[0], 10);
                                      const startMin = parseInt(shiftA.start_time.split(':')[1], 10);
                                      const endHour = parseInt(shiftB.end_time.split(':')[0], 10);
                                      const endMin = parseInt(shiftB.end_time.split(':')[1], 10);

                                      const startFraction = startHour + (startMin / 60);
                                      let baseEndFraction = endHour + (endMin / 60);

                                      if (baseEndFraction < startFraction) baseEndFraction += 24;

                                      const leftPercent = ((startFraction - timelineHours[0]) / timelineHours.length) * 100;
                                      const widthPercent = ((baseEndFraction - startFraction) / timelineHours.length) * 100;

                                      // Calcular fracciones para tramos internos
                                      const endHourA = parseInt(shiftA.end_time.split(':')[0], 10);
                                      const endMinA = parseInt(shiftA.end_time.split(':')[1], 10);
                                      let endFractionA = endHourA + (endMinA / 60);
                                      if (endFractionA < startFraction) endFractionA += 24;

                                      const startHourB = parseInt(shiftB.start_time.split(':')[0], 10);
                                      const startMinB = parseInt(shiftB.start_time.split(':')[1], 10);
                                      let startFractionB = startHourB + (startMinB / 60);
                                      if (startFractionB < startFraction) startFractionB += 24;

                                      const durationA = endFractionA - startFraction;
                                      const durationIntermediate = startFractionB - endFractionA;
                                      const durationB = baseEndFraction - startFractionB;
                                      const totalDuration = baseEndFraction - startFraction;

                                      const widthPercentA = (durationA / totalDuration) * 100;
                                      const widthPercentIntermediate = (durationIntermediate / totalDuration) * 100;
                                      const widthPercentB = (durationB / totalDuration) * 100;

                                      const { bandStyleClasses: baseStyleA, indicatorColorClass: indA, clockColorClass: clockA, glowClass: baseGlowA } = getShiftColorConfig(shiftA);
                                      const { bandStyleClasses: baseStyleB, indicatorColorClass: indB } = getShiftColorConfig(shiftB);
                                      
                                      const isDraftA = shiftA.is_published === false;
                                      const isDraftB = shiftB.is_published === false;
                                      
                                      const styleA = baseStyleA + (isDraftA ? ' border-dashed border-2 opacity-80 border-blue-400/50' : '');
                                      const glowA = baseGlowA + (isDraftA ? ' !shadow-[0_0_15px_rgba(96,165,250,0.3)]' : '');
                                      
                                      const styleB = baseStyleB + (isDraftB ? ' border-dashed border-2 opacity-80 border-blue-400/50' : '');

                                      const overtimeWidthPercent = shiftB.overtime ? (shiftB.overtime / timelineHours.length) * 100 : 0;

                                      return (
                                        <Fragment key={`${shiftA.id}-${shiftB.id}`}>
                                          <motion.div
                                            draggable
                                            onDragStart={(e: any) => {
                                              e.dataTransfer.setData('text/plain', JSON.stringify({
                                                type: 'existing_shift_split',
                                                shiftIdA: shiftA.id,
                                                shiftIdB: shiftB.id
                                              }));
                                              e.dataTransfer.effectAllowed = 'move';
                                            }}
                                            initial={{ opacity: 0, scaleX: 0 }}
                                            animate={{ opacity: 1, scaleX: 1 }}
                                            transition={{ delay: index * 0.1 + sIdx * 0.05, duration: 0.4, ease: "easeOut" }}
                                            style={{
                                              left: `${leftPercent}%`,
                                              width: `${Math.min(widthPercent, 100 - leftPercent)}%`,
                                              transformOrigin: 'left'
                                            }}
                                            className={`absolute top-1/2 -translate-y-1/2 h-12 z-20 flex select-none rounded-xl ${glowA}`}
                                          >
                                            {/* Tramo 1 (Izquierda) */}
                                            <div
                                              style={{ width: `${widthPercentA}%` }}
                                              className={`h-full relative flex items-center px-2 border-y border-l shadow-sm overflow-hidden backdrop-blur-sm group/band cursor-grab active:cursor-grabbing rounded-l-xl ${styleA}`}
                                              onClick={() => {
                                                setSelectedShiftToEdit(shiftA);
                                                setSelectedShiftBToEdit(shiftB);
                                                setEditShiftStart(shiftA.start_time);
                                                setEditShiftEnd(shiftA.end_time);
                                                setEditShiftIsSplit(true);
                                                setEditShiftStart2(shiftB.start_time);
                                                setEditShiftEnd2(shiftB.end_time);
                                                setEditShiftColor(shiftA.color || 'bg-blue-500');
                                                setEditShiftError(null);

                                                let notesClean = shiftA.notes || '';
                                                let hasPlus = false;
                                                if (notesClean.includes('(Plus)')) {
                                                  hasPlus = true;
                                                  notesClean = notesClean.replace(/\(Plus\)\s*·?\s*/i, '').trim();
                                                }
                                                setEditShiftHasPlus(hasPlus);

                                                let breakVal = 0;
                                                let breakPaidVal = companyBreakIncluded;
                                                const breakMatch = notesClean.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*([^)]+))?\)/i);
                                                if (breakMatch) {
                                                  breakVal = parseInt(breakMatch[1], 10);
                                                  const type = breakMatch[2] || '';
                                                  breakPaidVal = type.toLowerCase().includes('pagado');
                                                  notesClean = notesClean.replace(/\(Descanso:\s*\d+\s*min(?:\s*-\s*[^)]+)?\)\s*·?\s*/i, '').trim();
                                                }
                                                setEditShiftNotes(notesClean);
                                                setEditShiftBreak(breakVal);
                                                setEditShiftBreakPaid(breakPaidVal);
                                                setIsEditShiftModalOpen(true);
                                              }}
                                            >
                                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${indA}`}></div>
                                              <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0 pl-1 z-10 w-full">
                                                <Clock size={14} className={`flex-shrink-0 opacity-70 self-center ${clockA}`} />
                                                <div className="flex flex-col min-w-0 leading-normal w-full">
                                                  {/* Fila superior: Hora + Badge tipo de jornada */}
                                                  <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-xs font-semibold truncate tracking-wide flex items-center gap-1.5">
                                                      <span>{shiftA.start_time} - {shiftA.end_time}</span>
                                                    </span>
                                                    {(() => {
                                                      const typeIndicator = getShiftTypeIndicator(shiftA);
                                                      return (
                                                        <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${typeIndicator.className} flex-shrink-0 select-none`}>
                                                          {typeIndicator.label}
                                                        </span>
                                                      );
                                                    })()}
                                                    {getShiftContext(shiftA) && (
                                                      <span title={getShiftContext(shiftA) || undefined} className="flex-shrink-0">
                                                        <FileText
                                                          size={10}
                                                          className="text-slate-400 hover:text-white transition-colors cursor-help"
                                                        />
                                                      </span>
                                                    )}
                                                  </div>
                                                  {/* Fila inferior: Estado */}
                                                  <div className="flex items-center gap-1 min-w-0 text-[9px] font-medium italic text-slate-400 opacity-75 truncate">
                                                    <span>
                                                      {(() => {
                                                        const baseStatus = shiftA.status === 'completed' ? 'Completado' : shiftA.status === 'absent' ? 'Ausente' : 'Programado';
                                                        const context = getShiftContext(shiftA);
                                                        return context ? `${baseStatus} · ${context}` : baseStatus;
                                                      })()}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Tiempo Intermedio / Pausa (Centro) */}
                                            <div
                                              style={{ width: `${widthPercentIntermediate}%` }}
                                              className="h-full flex flex-col items-center justify-center bg-white/[0.02] border-y border-dashed border-white/10 text-[9px] text-slate-500 font-semibold select-none leading-none px-1 cursor-pointer hover:bg-white/[0.04] transition-colors"
                                              title={`Pausa de comida: ${shiftA.end_time} - ${shiftB.start_time} (Haz clic para editar jornada)`}
                                              onClick={() => {
                                                setSelectedShiftToEdit(shiftA);
                                                setSelectedShiftBToEdit(shiftB);
                                                setEditShiftStart(shiftA.start_time);
                                                setEditShiftEnd(shiftA.end_time);
                                                setEditShiftIsSplit(true);
                                                setEditShiftStart2(shiftB.start_time);
                                                setEditShiftEnd2(shiftB.end_time);
                                                setEditShiftColor(shiftA.color || 'bg-blue-500');
                                                setEditShiftError(null);

                                                let notesClean = shiftA.notes || '';
                                                let hasPlus = false;
                                                if (notesClean.includes('(Plus)')) {
                                                  hasPlus = true;
                                                  notesClean = notesClean.replace(/\(Plus\)\s*·?\s*/i, '').trim();
                                                }
                                                setEditShiftHasPlus(hasPlus);

                                                let breakVal = 0;
                                                let breakPaidVal = companyBreakIncluded;
                                                const breakMatch = notesClean.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*([^)]+))?\)/i);
                                                if (breakMatch) {
                                                  breakVal = parseInt(breakMatch[1], 10);
                                                  const type = breakMatch[2] || '';
                                                  breakPaidVal = type.toLowerCase().includes('pagado');
                                                  notesClean = notesClean.replace(/\(Descanso:\s*\d+\s*min(?:\s*-\s*[^)]+)?\)\s*·?\s*/i, '').trim();
                                                }
                                                setEditShiftNotes(notesClean);
                                                setEditShiftBreak(breakVal);
                                                setEditShiftBreakPaid(breakPaidVal);
                                                setIsEditShiftModalOpen(true);
                                              }}
                                            >
                                              <span>Pausa</span>
                                              <span className="text-[7.5px] opacity-60 mt-0.5 font-medium">
                                                {shiftA.end_time} - {shiftB.start_time}
                                              </span>
                                            </div>

                                            {/* Tramo 2 (Derecha) */}
                                            <div
                                              style={{ width: `${widthPercentB}%` }}
                                              className={`h-full relative flex items-center px-2 border-y border-r shadow-sm overflow-hidden backdrop-blur-sm group/band cursor-grab active:cursor-grabbing rounded-r-xl ${styleB}`}
                                              onClick={() => {
                                                setSelectedShiftToEdit(shiftA);
                                                setSelectedShiftBToEdit(shiftB);
                                                setEditShiftStart(shiftA.start_time);
                                                setEditShiftEnd(shiftA.end_time);
                                                setEditShiftIsSplit(true);
                                                setEditShiftStart2(shiftB.start_time);
                                                setEditShiftEnd2(shiftB.end_time);
                                                setEditShiftColor(shiftA.color || 'bg-blue-500');
                                                setEditShiftError(null);

                                                let notesClean = shiftA.notes || '';
                                                let hasPlus = false;
                                                if (notesClean.includes('(Plus)')) {
                                                  hasPlus = true;
                                                  notesClean = notesClean.replace(/\(Plus\)\s*·?\s*/i, '').trim();
                                                }
                                                setEditShiftHasPlus(hasPlus);

                                                let breakVal = 0;
                                                let breakPaidVal = companyBreakIncluded;
                                                const breakMatch = notesClean.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*([^)]+))?\)/i);
                                                if (breakMatch) {
                                                  breakVal = parseInt(breakMatch[1], 10);
                                                  const type = breakMatch[2] || '';
                                                  breakPaidVal = type.toLowerCase().includes('pagado');
                                                  notesClean = notesClean.replace(/\(Descanso:\s*\d+\s*min(?:\s*-\s*[^)]+)?\)\s*·?\s*/i, '').trim();
                                                }
                                                setEditShiftNotes(notesClean);
                                                setEditShiftBreak(breakVal);
                                                setEditShiftBreakPaid(breakPaidVal);
                                                setIsEditShiftModalOpen(true);
                                              }}
                                            >
                                              <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0 z-10 w-full justify-between">
                                                <div className="flex items-center gap-1 min-w-0 w-full">
                                                  <div className="flex flex-col min-w-0 leading-normal w-full">
                                                    {/* Fila superior: Hora */}
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      <span className="text-xs font-semibold truncate tracking-wide flex items-center gap-1.5">
                                                        {(() => {
                                                          const m = shiftB.notes?.match(/\(Descanso:\s*(\d+)\s*min(?:\s*-\s*([^)]+))?\)/i);
                                                          const bMins = m ? parseInt(m[1]) : 0;
                                                          const bPaid = m ? (m[2] || '').toLowerCase().includes('pagado') : false;
                                                          return <span>{shiftB.start_time} - {getAdjustedEndTime(shiftB.end_time, shiftB.overtime, bPaid ? 0 : bMins)}</span>;
                                                        })()}
                                                      </span>
                                                    </div>
                                                    {/* Fila inferior: Estado */}
                                                    <div className="flex items-center gap-1 min-w-0 text-[9px] font-medium italic text-slate-400 opacity-75 truncate">
                                                      <span>
                                                        {(() => {
                                                          const baseStatus = shiftB.status === 'completed' ? 'Completado' : shiftB.status === 'absent' ? 'Ausente' : 'Programado';
                                                          const context = getShiftContext(shiftB);
                                                          return context ? `${baseStatus} · ${context}` : baseStatus;
                                                        })()}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-0.5 shrink-0 ml-1 z-30">
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setShiftIdToDelete(shiftA.id);
                                                      setDeleteConfirmOpen(true);
                                                    }}
                                                    className="p-0.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-65 hover:opacity-100"
                                                    title="Eliminar jornada completa"
                                                  >
                                                    <Trash2 size={11} />
                                                  </button>

                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (e.ctrlKey) {
                                                        setShifts(prev => prev.map(s => {
                                                          if (s.id === shiftB.id) {
                                                            const current = s.overtime || 0;
                                                            return { ...s, overtime: current + 1 };
                                                          }
                                                          return s;
                                                        }));
                                                      } else if (e.altKey) {
                                                        setShifts(prev => prev.map(s => {
                                                          if (s.id === shiftB.id) {
                                                            const current = s.overtime || 0;
                                                            const val = Math.max(0, current - 1);
                                                            return { ...s, overtime: val > 0 ? val : undefined };
                                                          }
                                                          return s;
                                                        }));
                                                      } else {
                                                        setSelectedOvertimeShiftId(shiftB.id);
                                                        setOvertimeInputValue(shiftB.overtime ? String(shiftB.overtime) : '2');
                                                        setOvertimeModalOpen(true);
                                                      }
                                                    }}
                                                    className="p-0.5 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all opacity-65 hover:opacity-100"
                                                    title={ctrlPressed ? "Ctrl + Click: Añadir 1 hora extra" : altPressed ? "Alt + Click: Quitar 1 hora extra" : "Añadir horas extras (ctrl suma y alt resta)"}
                                                  >
                                                    <Plus size={11} />
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </motion.div>

                                          {shiftB.overtime && (
                                            <motion.div
                                              initial={{ opacity: 0, scaleX: 0 }}
                                              animate={{ opacity: 1, scaleX: 1 }}
                                              transition={{ delay: index * 0.1 + sIdx * 0.05 + 0.1, duration: 0.4, ease: "easeOut" }}
                                              style={{
                                                left: `calc(${leftPercent + widthPercent}% - 8px)`,
                                                width: `calc(${overtimeWidthPercent}% + 8px)`,
                                                transformOrigin: 'left'
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedOvertimeShiftId(shiftB.id);
                                                setOvertimeInputValue(String(shiftB.overtime));
                                                setOvertimeModalOpen(true);
                                              }}
                                              className={`absolute top-1/2 -translate-y-1/2 h-8 flex items-center justify-center border border-white/20 ${indB} text-white font-extrabold text-[10px] select-none rounded-xl z-10 cursor-pointer hover:brightness-110 transition-all shadow-md`}
                                              title={`Suplemento de horas extras: +${shiftB.overtime} horas.`}
                                            >
                                              +{shiftB.overtime}h
                                            </motion.div>
                                          )}
                                        </Fragment>
                                      );
                                    }
                                  });
                                })()}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </>
            );
          })()
        )}
      </div>

      {/* Sección: Resumen por Trabajador */}
      <div className="bg-surface-dark p-6 rounded-2xl border border-white/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Users className="text-primary" size={18} />
            <h3 className="text-sm font-semibold text-white">Resumen por Trabajador</h3>
          </div>
          <div className="flex items-center gap-3">
            {summaryPeriod === 'calendar' ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={summaryCustomDates.length > 0 ? getLocalDateString(summaryCustomDates[0]) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newStart = new Date(year, month - 1, day);
                      const currentEnd = summaryCustomDates.length > 0 ? summaryCustomDates[summaryCustomDates.length - 1] : newStart;
                      setSummaryCustomDates(getDatesInRange(newStart, currentEnd));
                    }
                  }}
                  className="bg-background-dark border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer"
                />
                <span className="text-slate-500 text-xs">-</span>
                <input
                  type="date"
                  value={summaryCustomDates.length > 0 ? getLocalDateString(summaryCustomDates[summaryCustomDates.length - 1]) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newEnd = new Date(year, month - 1, day);
                      const currentStart = summaryCustomDates.length > 0 ? summaryCustomDates[0] : newEnd;
                      setSummaryCustomDates(getDatesInRange(currentStart, newEnd));
                    }
                  }}
                  className="bg-background-dark border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer"
                />
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                {summaryPeriodLabel}
              </span>
            )}
            <CustomSelect
              value={summaryPeriod}
              onChange={(val) => setSummaryPeriod(val as any)}
              options={[
                { value: 'day', label: 'Día Planificado' },
                { value: 'week', label: 'Esta Semana' },
                { value: 'month', label: 'Este Mes' },
                { value: 'year', label: 'Este Año' },
                { value: 'calendar', label: 'Selección Calendario' }
              ]}
              size="sm"
              variant="filter"
              className="w-48 bg-background-dark/80 text-slate-300 border-white/10"
              dropdownClassName="w-48"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employeesSummary.map(({ employee, ordinaryHours, festiveHours, extraHours, plusHours, totalHours, typeDetails, hasOvertimeAlert, hasRestAlert, restAlertDays, hasShifts }) => {
            const empName = employee.full_name || employee.name || employee.email || 'Empleado';
            return (
              <div 
                key={employee.id} 
                className="bg-background-dark/40 border border-white/5 hover:border-white/10 p-4 rounded-xl transition-all flex flex-col justify-between space-y-3"
              >
                {/* Cabecera del Empleado */}
                <div className="flex items-center justify-between">
                  <Link to={`/manager/equipos/trabajador/${employee.id}`} className="flex items-center gap-2.5 min-w-0 hover:text-primary transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0 overflow-hidden">
                      {employee.avatar ? (
                        <img src={employee.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        empName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm text-white truncate group-hover:text-primary transition-colors">{empName}</p>
                        {hasOvertimeAlert && (
                          <span title="Supera las 40h semanales" className="text-red-500 shrink-0 cursor-help">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                        {hasRestAlert && (
                          <span title={`Descanso < 12h en: ${restAlertDays.join(', ')}`} className="text-amber-500 shrink-0 cursor-help">
                            <Clock size={14} />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 capitalize">{employee.role || 'Personal'}</p>
                    </div>
                  </Link>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-extrabold text-white">{formatProposedHours(totalHours)}</span>
                    <p className="text-[8px] text-slate-500 uppercase tracking-wider">propuestas</p>
                  </div>
                </div>

                {/* Desglose de Horas */}
                {hasShifts ? (
                  <div className="space-y-2">
                    {/* Barra de progreso desglosada */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                      {ordinaryHours > 0 && (
                        <div 
                          style={{ width: `${(ordinaryHours / Math.max(1, totalHours)) * 100}%` }}
                          className="bg-primary h-full"
                          title={`Horas ordinarias: ${formatProposedHours(ordinaryHours)}`}
                        />
                      )}
                      {festiveHours > 0 && (
                        <div 
                          style={{ width: `${(festiveHours / Math.max(1, totalHours)) * 100}%` }}
                          className="bg-emerald-500 h-full border-l border-background-dark"
                          title={`Horas festivas: ${formatProposedHours(festiveHours)}`}
                        />
                      )}
                      {extraHours > 0 && (
                        <div 
                          style={{ width: `${(extraHours / Math.max(1, totalHours)) * 100}%` }}
                          className="bg-amber-500 h-full border-l border-background-dark"
                          title={`Horas extras: ${formatProposedHours(extraHours)}`}
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Ordinarias: <span className="text-white font-medium">{formatProposedHours(ordinaryHours)}</span>
                      </span>
                      {festiveHours > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Festivas: <span className="text-emerald-400 font-bold">{formatProposedHours(festiveHours)}</span>
                        </span>
                      )}
                      {extraHours > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Extras: <span className="text-amber-400 font-bold">+{formatProposedHours(extraHours)}</span>
                        </span>
                      )}
                      {plusHours > 0 && (
                        <span className="text-purple-400" title="Contiene plus salarial">
                          Plus: <span className="font-bold">{formatProposedHours(plusHours)}</span>
                        </span>
                      )}
                    </div>

                    {/* Tipos de Jornadas Propuestas */}
                    <div className="flex flex-wrap gap-1 pt-1.5 border-t border-white/5">
                      {Object.entries(typeDetails).map(([label, details]) => (
                        <span 
                          key={label}
                          className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded flex items-center gap-1 select-none ${details.className.replace('font-bold', '')}`}
                        >
                          <span className="text-[8px] opacity-70 font-bold">{details.count}x</span>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4 bg-white/[0.01] border border-dashed border-white/5 rounded-lg text-slate-500 text-xs">
                    Sin turnos propuestos
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AbsencesModal
        isOpen={isAbsencesModalOpen}
        onClose={() => setIsAbsencesModalOpen(false)}
        employees={employees}
        absences={absences}
        companyId={companyId}
        leavePolicies={leavePolicies}
        onAbsencesChange={setAbsences}
      />

      {/* Modal: Guardar como Plantilla */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Save size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Guardar como Plantilla</h3>
                <p className="text-xs text-slate-400">Guarda el horario de este día para reutilizarlo</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Nombre de la Plantilla</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ej. Jornada Estándar Lunes, Verano A..."
                  className="w-full bg-background-dark border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors placeholder:text-slate-500"
                />
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Se guardarán todos los turnos programados del día de hoy (<span className="text-white font-medium capitalize">{selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>) como una plantilla que podrás aplicar a cualquier otro día del año con un solo clic.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!templateName.trim()) return;
                  const newTemplate = {
                    id: `t-${Date.now()}`,
                    name: templateName,
                    shiftsCount: shifts.filter(s => s.date === getLocalDateString(selectedDate)).length || 4,
                    createdAt: new Date().toLocaleDateString('es-ES')
                  };
                  setTemplates([newTemplate, ...templates]);
                  setIsSaveModalOpen(false);
                }}
                disabled={!templateName.trim()}
                className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm shadow-blue-500/20"
              >
                Guardar Plantilla
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Cargar Plantilla */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Cargar Plantilla</h3>
                <p className="text-xs text-slate-400">Selecciona una plantilla para rellenar este día</p>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {templates.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No tienes plantillas guardadas.</p>
              ) : (
                templates.map(temp => (
                  <div
                    key={temp.id}
                    className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/15 transition-all group"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{temp.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        {temp.shiftsCount} turnos configurados <span className="opacity-50">·</span> Creada el {temp.createdAt}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApplyTemplate(temp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-semibold transition-all"
                    >
                      Aplicar
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <button
                onClick={() => setIsLoadModalOpen(false)}
                className="px-4 py-2 text-sm font-medium bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal para Ajustar Horas Extras */}
      {overtimeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Horas Extras</h3>
                <p className="text-xs text-slate-400">Ajusta el suplemento de horas de este turno</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Horas del suplemento
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={overtimeInputValue}
                    onChange={(e) => setOvertimeInputValue(e.target.value.replace(',', '.'))}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500 transition-all font-medium"
                    placeholder="Ej: 1.5 o 2"
                    autoFocus
                  />
                  <span className="absolute right-4 text-slate-500 font-semibold text-sm">horas</span>
                </div>
              </div>

              {/* Presets rápidos */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Atajos rápidos
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0.5, 1, 1.5, 2].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setOvertimeInputValue(String(val))}
                      className="px-2 py-1.5 bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 border border-white/5 hover:border-blue-500/30 rounded-lg text-xs font-medium text-slate-300 transition-all"
                    >
                      +{val}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setOvertimeInputValue('0')}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Eliminar Suplemento (0h)
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setOvertimeModalOpen(false);
                  setSelectedOvertimeShiftId(null);
                }}
                className="px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const hours = parseFloat(overtimeInputValue);
                  if (selectedOvertimeShiftId) {
                    setShifts(prev => prev.map(s => {
                      if (s.id === selectedOvertimeShiftId) {
                        if (hours <= 0 || isNaN(hours)) {
                          const { overtime, ...rest } = s;
                          return { ...rest, is_published: false } as Shift;
                        }
                        return { ...s, overtime: hours, is_published: false };
                      }
                      return s;
                    }));
                  }
                  setOvertimeModalOpen(false);
                  setSelectedOvertimeShiftId(null);
                }}
                className="px-4 py-2 text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all"
              >
                Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Turno */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Eliminar Turno</h3>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 font-medium">
              ¿Estás seguro de que quieres eliminar este turno de la planificación del empleado?
            </p>

            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setShiftIdToDelete(null);
                }}
                className="px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (shiftIdToDelete) {
                    const targetShift = shifts.find(s => s.id === shiftIdToDelete);
                    if (targetShift) {
                      const comp = getShiftComplement(targetShift);
                      
                      setShifts(prev => {
                        let newShifts = [...prev];
                        const idsToRemoveOrMark = [shiftIdToDelete];
                        if (comp.isSplit && comp.partner) {
                          idsToRemoveOrMark.push(comp.partner.id);
                        }

                        // Si el turno original NUNCA fue publicado (es un borrador), lo eliminamos por completo.
                        // Así el autoguardado lo borrará de la base de datos sin generar notificaciones.
                        if (targetShift.is_published === false) {
                          newShifts = newShifts.filter(s => !idsToRemoveOrMark.includes(s.id));
                        } else {
                          // Si YA estaba publicado, lo marcamos como pendiente de eliminación
                          // para que pase por la cola de "Publicar Cambios".
                          newShifts = newShifts.map(s => 
                            idsToRemoveOrMark.includes(s.id)
                              ? { ...s, status: 'pending_deletion', is_published: false }
                              : s
                          );
                        }
                        return newShifts;
                      });
                    }
                  }
                  setDeleteConfirmOpen(false);
                  setShiftIdToDelete(null);
                }}
                className="px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 transition-all"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Nuevo Turno Personalizado */}
      {isCustomShiftModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Nuevo Turno Personalizado</h3>
                <p className="text-xs text-slate-400">Configura el horario y color del turno libre</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Opción Jornada Partida */}
              <div className="flex items-center justify-between py-1 px-0.5">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-300">Jornada Partida</span>
                  <span className="text-[10px] text-slate-500">¿Tiene dos tramos de horario?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomShiftIsSplit(prev => !prev)}
                  className={`w-9 h-5 rounded-full transition-all relative focus:outline-none ${customShiftIsSplit ? 'bg-primary' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all ${customShiftIsSplit ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Horario */}
              <div className="space-y-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                <div>
                  {customShiftIsSplit && (
                    <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2 animate-fadeIn">Primer Tramo (Mañana)</span>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                        {customShiftIsSplit ? "Entrada 1" : "Hora Entrada"}
                      </label>
                      <input
                        type="time"
                        value={customShiftStart}
                        onChange={(e) => {
                          setCustomShiftError(null);
                          setCustomShiftStart(e.target.value);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                        {customShiftIsSplit ? "Salida 1" : "Hora Salida"}
                      </label>
                      <input
                        type="time"
                        value={customShiftEnd}
                        onChange={(e) => {
                          setCustomShiftError(null);
                          setCustomShiftEnd(e.target.value);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateRows: customShiftIsSplit ? '1fr' : '0fr',
                    transition: 'grid-template-rows 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms cubic-bezier(0.25, 1, 0.5, 1)',
                    opacity: customShiftIsSplit ? 1 : 0,
                  }}
                  className="overflow-hidden"
                >
                  <div className="min-h-0">
                    <div className="border-t border-white/5 pt-3 mt-1">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2">Segundo Tramo (Tarde)</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">Entrada 2</label>
                          <input
                            type="time"
                            value={customShiftStart2}
                            onChange={(e) => {
                              setCustomShiftError(null);
                              setCustomShiftStart2(e.target.value);
                            }}
                            className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-white outline-none text-sm font-medium transition-all ${customShiftError && customShiftError.includes('segundo tramo') ? 'border-red-500 ring-1 ring-red-500/20' : 'border-white/10'
                              }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">Salida 2</label>
                          <input
                            type="time"
                            value={customShiftEnd2}
                            onChange={(e) => {
                              setCustomShiftError(null);
                              setCustomShiftEnd2(e.target.value);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tiempo de descanso */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Tiempo de Descanso (Break)</label>
                <div className="space-y-2">
                  {[
                    { label: customShiftIsSplit ? 'T1' : null, mins: customShiftBreak, setMins: setCustomShiftBreak },
                    ...(customShiftIsSplit ? [{ label: 'T2', mins: customShiftBreak2, setMins: setCustomShiftBreak2 }] : []),
                  ].map((tramo, ti) => (
                    <div key={ti} className="flex gap-2 items-center">
                      {tramo.label && <span className="text-[10px] font-black text-slate-500 uppercase w-5 shrink-0">{tramo.label}</span>}
                      <div className="relative flex-1">
                        <input type="number" min="0" placeholder="Minutos..."
                          className="w-full pl-8 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm font-semibold"
                          value={tramo.mins || 0}
                          onChange={(e) => tramo.setMins(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">☕</div>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-500 font-semibold">min</div>
                      </div>
                      <div className="flex gap-1">
                        {[5, 10, 30].map((m) => (
                          <button key={m} type="button" onClick={() => tramo.setMins((tramo.mins || 0) + m)}
                            className="px-2.5 py-2 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300 transition-all active:scale-95">
                            +{m}
                          </button>
                        ))}
                        {tramo.mins > 0 && (
                          <button type="button" onClick={() => tramo.setMins(0)}
                            className="px-2 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95">
                            Borrar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateRows: (customShiftBreak > 0 || customShiftBreak2 > 0) ? '1fr' : '0fr', transition: 'grid-template-rows 220ms cubic-bezier(0.25,1,0.5,1), opacity 220ms', opacity: (customShiftBreak > 0 || customShiftBreak2 > 0) ? 1 : 0 }} className="overflow-hidden">
                  <div className="min-h-0">
                    <div className="space-y-2 bg-white/[0.01] border border-white/5 p-3.5 rounded-xl mt-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">¿Cómo computa el descanso?</span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => { setCustomShiftBreakPaid(true); setCustomShiftBreakPaid2(true); }}
                          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${customShiftBreakPaid ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-md' : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${customShiftBreakPaid ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            <span className={`text-xs font-bold ${customShiftBreakPaid ? 'text-emerald-400' : 'text-slate-300'}`}>Dentro (Pagado)</span>
                          </div>
                          <span className="text-[10px] text-slate-400 leading-tight">El descanso computa como tiempo efectivo de trabajo.</span>
                        </button>
                        <button type="button" onClick={() => { setCustomShiftBreakPaid(false); setCustomShiftBreakPaid2(false); }}
                          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${!customShiftBreakPaid ? 'bg-slate-500/10 border-white/20 ring-1 ring-white/10 shadow-md' : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${!customShiftBreakPaid ? 'bg-amber-400' : 'bg-slate-500'}`} />
                            <span className={`text-xs font-bold ${!customShiftBreakPaid ? 'text-white' : 'text-slate-300'}`}>Fuera (No pagado)</span>
                          </div>
                          <span className="text-[10px] text-slate-400 leading-tight">Se resta del total de horas de la jornada.</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Color del Turno</label>
                <div className="flex gap-2">
                  {[
                    { key: 'bg-lime-400', name: 'Verde Fosforito' },
                    { key: 'bg-cyan-400', name: 'Azul Celeste' },
                    { key: 'bg-orange-400', name: 'Naranja Neón' },
                    { key: 'bg-yellow-400', name: 'Amarillo Fosforito' },
                  ].map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setCustomShiftColor(c.key)}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${c.key} ${customShiftColor === c.key
                        ? `border-white scale-110 shadow-lg ${c.key === 'bg-lime-400' ? '' :
                          c.key === 'bg-cyan-400' ? '' :
                            c.key === 'bg-orange-400' ? '' :
                              ''
                        }`
                        : 'border-transparent hover:scale-105'
                        }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Selector Contiene Plus */}
              <div className="flex items-center justify-between py-1.5 px-0.5 border-t border-white/5 my-2">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-300">Contiene Plus salarial</span>
                  <span className="text-[10px] text-slate-500">¿Aplica plus de nocturnidad/festivo/otros?</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={customShiftHasPlus}
                    onChange={(e) => setCustomShiftHasPlus(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Contexto del Turno (Notas) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Contexto del Turno (Notas)</label>
                <textarea
                  value={customShiftNotes}
                  onChange={(e) => {
                    setCustomShiftError(null);
                    setCustomShiftNotes(e.target.value);
                  }}
                  placeholder="Ej: Cobertura por baja médica, refuerzo por evento..."
                  rows={2}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none text-sm font-medium resize-none placeholder:text-slate-600 transition-all ${customShiftError && customShiftError.includes('Notas')
                    ? 'border-red-500 ring-1 ring-red-500/20'
                    : 'border-white/10'
                    }`}
                />
              </div>
            </div>

            {/* Resumen de jornada en tiempo real */}
            {(() => {
              const toMins = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
              const fmt = (mins: number) => { const h = Math.floor(Math.abs(mins) / 60); const m = Math.abs(mins) % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; };
              const fmtTime = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`;
              const s1 = toMins(customShiftStart); let e1 = toMins(customShiftEnd); if (e1 <= s1) e1 += 24*60;
              let workedMins = e1 - s1; let lastEnd = e1;
              if (customShiftIsSplit) { const s2 = toMins(customShiftStart2); let e2 = toMins(customShiftEnd2); if (e2 <= s2) e2 += 24*60; workedMins += e2 - s2; lastEnd = e2; }
              const bMins = customShiftBreak || 0; const bPaid = customShiftBreakPaid;
              const realExitMins = !bPaid && bMins > 0 ? lastEnd + bMins : lastEnd;
              const realExitStr = fmtTime(realExitMins);
              return (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resumen de jornada</span>
                  {customShiftIsSplit ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 bg-white/[0.04] rounded-xl p-2.5">
                          <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider">Tramo 1</span>
                          <span className="text-sm font-black text-white">{customShiftStart} → {customShiftEnd}</span>
                        </div>
                        <div className="flex flex-col gap-1 bg-white/[0.04] rounded-xl p-2.5">
                          <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider">Tramo 2</span>
                          <span className="text-sm font-black text-white">{customShiftStart2} → {realExitStr}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tiempo trabajado total</span>
                        <span className="text-base font-black text-white">{fmt(workedMins)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Entrada</span>
                        <span className="text-base font-black text-white">{customShiftStart}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{!bPaid && bMins > 0 ? 'Salida real' : 'Salida'}</span>
                        <span className="text-base font-black text-white">{realExitStr}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tiempo trabajado</span>
                        <span className="text-base font-black text-white">{fmt(workedMins)}</span>
                      </div>
                    </div>
                  )}
                  {bMins > 0 && (
                    <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${bPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      <span>☕</span>
                      <span><strong>{bMins} min</strong> de descanso — {bPaid ? 'retribuido (dentro de la jornada)' : `no retribuido (salida a las ${realExitStr})`}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {customShiftError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-fadeIn mx-0.5">
                <span>⚠️</span>
                <span className="font-semibold leading-tight">{customShiftError}</span>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsCustomShiftModalOpen(false);
                  setCustomShiftEmpId(null);
                }}
                className="px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCustomShift}
                className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg shadow-primary/20 transition-all"
              >
                Asignar Turno
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Editar Turno */}
      {isEditShiftModalOpen && selectedShiftToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Editar Turno</h3>
                <p className="text-xs text-slate-400">Modifica los detalles y notas del turno</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Opción Jornada Partida */}
              <div className="flex items-center justify-between py-1 px-0.5">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-300">Jornada Partida</span>
                  <span className="text-[10px] text-slate-500">¿Tiene dos tramos de horario?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditShiftIsSplit(prev => !prev)}
                  className={`w-9 h-5 rounded-full transition-all relative focus:outline-none ${editShiftIsSplit ? 'bg-primary' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all ${editShiftIsSplit ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Horario */}
              <div className="space-y-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                <div>
                  {editShiftIsSplit && (
                    <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2 animate-fadeIn">Primer Tramo (Mañana)</span>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                        {editShiftIsSplit ? "Entrada 1" : "Hora Entrada"}
                      </label>
                      <input
                        type="time"
                        value={editShiftStart}
                        onChange={(e) => {
                          setEditShiftError(null);
                          setEditShiftStart(e.target.value);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                        {editShiftIsSplit ? "Salida 1" : "Hora Salida"}
                      </label>
                      <input
                        type="time"
                        value={editShiftEnd}
                        onChange={(e) => {
                          setEditShiftError(null);
                          setEditShiftEnd(e.target.value);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateRows: editShiftIsSplit ? '1fr' : '0fr',
                    transition: 'grid-template-rows 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms cubic-bezier(0.25, 1, 0.5, 1)',
                    opacity: editShiftIsSplit ? 1 : 0,
                  }}
                  className="overflow-hidden"
                >
                  <div className="min-h-0">
                    <div className="border-t border-white/5 pt-3 mt-1">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2">Segundo Tramo (Tarde)</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">Entrada 2</label>
                          <input
                            type="time"
                            value={editShiftStart2}
                            onChange={(e) => {
                              setEditShiftError(null);
                              setEditShiftStart2(e.target.value);
                            }}
                            className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-white outline-none text-sm font-medium transition-all ${editShiftError && editShiftError.includes('segundo tramo') ? 'border-red-500 ring-1 ring-red-500/20' : 'border-white/10'
                              }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">Salida 2</label>
                          <input
                            type="time"
                            value={editShiftEnd2}
                            onChange={(e) => {
                              setEditShiftError(null);
                              setEditShiftEnd2(e.target.value);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tiempo de descanso */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Tiempo de Descanso (Break)</label>
                <div className="space-y-2">
                  {[
                    { label: editShiftIsSplit ? 'T1' : null, mins: editShiftBreak, setMins: setEditShiftBreak },
                    ...(editShiftIsSplit ? [{ label: 'T2', mins: editShiftBreak2, setMins: setEditShiftBreak2 }] : []),
                  ].map((tramo, ti) => (
                    <div key={ti} className="flex gap-2 items-center">
                      {tramo.label && <span className="text-[10px] font-black text-slate-500 uppercase w-5 shrink-0">{tramo.label}</span>}
                      <div className="relative flex-1">
                        <input type="number" min="0" placeholder="Minutos..."
                          className="w-full pl-8 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm font-semibold"
                          value={tramo.mins || 0}
                          onChange={(e) => tramo.setMins(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">☕</div>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-500 font-semibold">min</div>
                      </div>
                      <div className="flex gap-1">
                        {[5, 10, 30].map((m) => (
                          <button key={m} type="button" onClick={() => tramo.setMins((tramo.mins || 0) + m)}
                            className="px-2.5 py-2 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300 transition-all active:scale-95">
                            +{m}
                          </button>
                        ))}
                        {tramo.mins > 0 && (
                          <button type="button" onClick={() => tramo.setMins(0)}
                            className="px-2 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95">
                            Borrar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateRows: (editShiftBreak > 0 || editShiftBreak2 > 0) ? '1fr' : '0fr', transition: 'grid-template-rows 220ms cubic-bezier(0.25,1,0.5,1), opacity 220ms', opacity: (editShiftBreak > 0 || editShiftBreak2 > 0) ? 1 : 0 }} className="overflow-hidden">
                  <div className="min-h-0">
                    <div className="space-y-2 bg-white/[0.01] border border-white/5 p-3.5 rounded-xl mt-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">¿Cómo computa el descanso?</span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => { setEditShiftBreakPaid(true); setEditShiftBreakPaid2(true); }}
                          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${editShiftBreakPaid ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-md' : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${editShiftBreakPaid ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            <span className={`text-xs font-bold ${editShiftBreakPaid ? 'text-emerald-400' : 'text-slate-300'}`}>Dentro (Pagado)</span>
                          </div>
                          <span className="text-[10px] text-slate-400 leading-tight">El descanso computa como tiempo efectivo de trabajo.</span>
                        </button>
                        <button type="button" onClick={() => { setEditShiftBreakPaid(false); setEditShiftBreakPaid2(false); }}
                          className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${!editShiftBreakPaid ? 'bg-slate-500/10 border-white/20 ring-1 ring-white/10 shadow-md' : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${!editShiftBreakPaid ? 'bg-amber-400' : 'bg-slate-500'}`} />
                            <span className={`text-xs font-bold ${!editShiftBreakPaid ? 'text-white' : 'text-slate-300'}`}>Fuera (No pagado)</span>
                          </div>
                          <span className="text-[10px] text-slate-400 leading-tight">Se resta del total de horas de la jornada.</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Color del Turno</label>
                <div className="flex gap-2">
                  {[
                    { key: 'bg-lime-400', name: 'Verde Fosforito' },
                    { key: 'bg-cyan-400', name: 'Azul Celeste' },
                    { key: 'bg-orange-400', name: 'Naranja Neón' },
                    { key: 'bg-yellow-400', name: 'Amarillo Fosforito' },
                  ].map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setEditShiftColor(c.key)}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${c.key} ${editShiftColor === c.key
                        ? `border-white scale-110 shadow-lg`
                        : 'border-transparent hover:scale-105'
                        }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Selector Contiene Plus */}
              <div className="flex items-center justify-between py-1.5 px-0.5 border-t border-white/5 my-2">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-300">Contiene Plus salarial</span>
                  <span className="text-[10px] text-slate-500">¿Aplica plus de nocturnidad/festivo/otros?</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={editShiftHasPlus}
                    onChange={(e) => setEditShiftHasPlus(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Contexto del Turno (Notas) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Contexto del Turno (Notas)</label>
                <textarea
                  value={editShiftNotes}
                  onChange={(e) => {
                    setEditShiftError(null);
                    setEditShiftNotes(e.target.value);
                  }}
                  placeholder="Ej: Cobertura por baja médica, refuerzo por evento..."
                  rows={2}
                  className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none text-sm font-medium resize-none placeholder:text-slate-600 transition-all ${editShiftError && editShiftError.includes('Notas')
                    ? 'border-red-500 ring-1 ring-red-500/20'
                    : 'border-white/10'
                    }`}
                />
              </div>
            </div>

            {/* Resumen de jornada en tiempo real */}
            {(() => {
              const toMins = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
              const fmt = (mins: number) => { const h = Math.floor(Math.abs(mins) / 60); const m = Math.abs(mins) % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; };
              const fmtTime = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`;
              const s1 = toMins(editShiftStart); let e1 = toMins(editShiftEnd); if (e1 <= s1) e1 += 24*60;
              let workedMins = e1 - s1; let lastEnd = e1;
              if (editShiftIsSplit) { const s2 = toMins(editShiftStart2); let e2 = toMins(editShiftEnd2); if (e2 <= s2) e2 += 24*60; workedMins += e2 - s2; lastEnd = e2; }
              const bMins = editShiftBreak || 0; const bPaid = editShiftBreakPaid;
              const realExitMins = !bPaid && bMins > 0 ? lastEnd + bMins : lastEnd;
              const realExitStr = fmtTime(realExitMins);
              return (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resumen de jornada</span>
                  {editShiftIsSplit ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 bg-white/[0.04] rounded-xl p-2.5">
                          <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider">Tramo 1</span>
                          <span className="text-sm font-black text-white">{editShiftStart} → {editShiftEnd}</span>
                        </div>
                        <div className="flex flex-col gap-1 bg-white/[0.04] rounded-xl p-2.5">
                          <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider">Tramo 2</span>
                          <span className="text-sm font-black text-white">{editShiftStart2} → {realExitStr}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tiempo trabajado total</span>
                        <span className="text-base font-black text-white">{fmt(workedMins)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Entrada</span>
                        <span className="text-base font-black text-white">{editShiftStart}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{!bPaid && bMins > 0 ? 'Salida real' : 'Salida'}</span>
                        <span className="text-base font-black text-white">{realExitStr}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tiempo trabajado</span>
                        <span className="text-base font-black text-white">{fmt(workedMins)}</span>
                      </div>
                    </div>
                  )}
                  {bMins > 0 && (
                    <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${bPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      <span>☕</span>
                      <span><strong>{bMins} min</strong> de descanso — {bPaid ? 'retribuido (dentro de la jornada)' : `no retribuido (salida a las ${realExitStr})`}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {editShiftError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-fadeIn mx-0.5">
                <span>⚠️</span>
                <span className="font-semibold leading-tight">{editShiftError}</span>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsEditShiftModalOpen(false);
                  setSelectedShiftToEdit(null);
                  setSelectedShiftBToEdit(null);
                  setEditShiftBreak(0);
                  setEditShiftError(null);
                }}
                className="px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditShift}
                className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg shadow-primary/20 transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Confirmación de Festivos */}
      {isHolidayConfirmModalOpen && pendingAssignment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-dark border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <CalendarDays size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">Festivos Detectados</h3>
                <p className="text-xs text-slate-400">Días especiales en la selección</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Has seleccionado un rango que incluye <span className="font-semibold text-white">días festivos o especiales</span> con apertura:
              </p>

              <div className="max-h-28 overflow-y-auto bg-white/5 rounded-xl p-3 border border-white/5 space-y-2 scrollbar-thin">
                {classifyDates(selectedDates, specialDays, weeklySchedule).festivosAbiertos.map(d => {
                  const dateStr = getLocalDateString(d);
                  const variant = specialDays[dateStr]?.variant;
                  let typeLabel = 'Festivo';
                  if (variant === 'open_holiday') typeLabel = 'Festivo Abierto';
                  else if (variant === 'open_partial_holiday') typeLabel = 'Festivo Parcial';
                  else if (variant === 'open_unexpected') typeLabel = 'Excepcional';

                  return (
                    <div key={d.getTime()} className="text-xs flex items-center justify-between gap-3 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        <span className="capitalize text-slate-200">
                          {d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                      </div>
                      <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase tracking-wider whitespace-nowrap">
                        {typeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-400 italic">
                Nota: Los días en que el establecimiento permanece cerrado se omitirán automáticamente.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsHolidayConfirmModalOpen(false);
                  setPendingAssignment(null);
                }}
                className="px-4 py-2.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all order-3 sm:order-1 flex-1"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  const { laborables } = classifyDates(selectedDates, specialDays, weeklySchedule);
                  applyPendingAssignment(laborables);
                }}
                className="px-4 py-2.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-slate-200 rounded-xl border border-white/10 transition-all order-2 flex-1"
              >
                Omitir Festivos
              </button>

              <button
                type="button"
                onClick={() => {
                  const { laborables, festivosAbiertos } = classifyDates(selectedDates, specialDays, weeklySchedule);
                  applyPendingAssignment([...laborables, ...festivosAbiertos]);
                }}
                className="px-4 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20 transition-all order-1 flex-1"
              >
                Programar en Todo
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast Notification System */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-surface-dark border border-white/10 rounded-xl shadow-2xl min-w-[280px] max-w-sm backdrop-blur-md"
        >
          <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'success' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' :
            toast.type === 'error' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' :
              'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]'
            }`} />
          <p className="text-sm font-medium text-white flex-1 leading-snug">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white transition-colors text-xs font-semibold px-1"
          >
            ✕
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default Shifts;
