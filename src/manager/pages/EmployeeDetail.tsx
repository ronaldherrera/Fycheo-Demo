import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar as CalendarIcon, Clock, AlertTriangle, 
  Plus, Pencil, Trash2, Play, Coffee, FileText, TrendingUp, 
  ChevronLeft, ChevronRight, X, Info, ShieldAlert, ChevronDown, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '../components/ui/CustomSelect';
import { employeeService } from '../services/employeeService';
import { shiftService } from '../services/shiftService';
import { absenceService } from '../services/absenceService';
import { useAuth } from '../contexts/AuthContext';
import { logService } from '../services/logService';
import { settingsService } from '../services/settingsService';
import { documentService } from '../services/documentService';
import type { EmployeeDocument } from '../services/documentService';
import { Download, Upload, File as FileIcon, Eye } from 'lucide-react';
import type { Employee, Shift, Absence } from '../types';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  hr: 'Recursos Humanos',
  manager: 'Manager',
  employee: 'Base',
};

// Formato de fecha local seguro para zonas horarias
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

const formatDateString = (date: Date) => {
  return getLocalDateString(date);
};

const formatHoursToTime = (decimalHours: number): string => {
  const isNegative = decimalHours < 0;
  const absVal = Math.abs(decimalHours);
  const hours = Math.floor(absVal);
  const minutes = Math.round((absVal - hours) * 60);
  
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  
  if (hours === 0 && minutes === 0) {
    return '00:00';
  }
  
  const sign = isNegative ? '-' : '+';
  return `${sign}${formattedHours}:${formattedMinutes}`;
};

const formatHoursToClock = (decimalHours: number): string => {
  const absVal = Math.abs(decimalHours);
  const hours = Math.floor(absVal);
  const minutes = Math.round((absVal - hours) * 60);
  
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}`;
};

const calculateDayNightMinutes = (start: Date, end: Date) => {
  let nightMinutes = 0;
  let dayMinutes = 0;
  
  let current = new Date(start.getTime());
  const endTime = end.getTime();
  
  const stepMs = 5 * 60 * 1000; // Paso de 5 minutos
  while (current.getTime() < endTime) {
    const hours = current.getHours();
    if (hours >= 22 || hours < 6) {
      nightMinutes += 5;
    } else {
      dayMinutes += 5;
    }
    current.setTime(current.getTime() + stepMs);
  }
  
  const diffTotal = Math.round((endTime - start.getTime()) / 1000 / 60);
  const calculatedTotal = nightMinutes + dayMinutes;
  const error = diffTotal - calculatedTotal;
  if (error !== 0) {
    const lastHours = end.getHours();
    if (lastHours >= 22 || lastHours < 6) {
      nightMinutes = Math.max(0, nightMinutes + error);
    } else {
      dayMinutes = Math.max(0, dayMinutes + error);
    }
  }
  
  return { dayMinutes, nightMinutes };
};

const getAbsenceTypeName = (type: string, policies?: Record<string, any>): string => {
  if (type === 'vacation') return 'Vacaciones';
  if (type === 'medical') return 'Baja Médica';
  if (type === 'manual_paid') return 'Permiso Retribuido';
  if (type === 'manual_unpaid') return 'Permiso No Retribuido';
  if (type === 'paternity') return 'Paternidad';
  if (type === 'maternity') return 'Maternidad';
  if (type === 'marriage') return 'Matrimonio';
  if (type === 'moving') return 'Mudanza';
  if (type === 'bereavement') return 'Duelo / Fallecimiento';
  
  if (policies && policies[type]) {
    return policies[type].name;
  }
  
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const EmployeeDetail = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user, activeCompany, profile } = useAuth();
  const isAdminOrHr = activeCompany?.role === 'admin' || activeCompany?.role === 'hr';

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date()); // Mes del calendario
  const [selectedDate, setSelectedDate] = useState(new Date()); // Día seleccionado para detalle de fichajes

  // Información Personal state
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editDni, setEditDni] = useState('');
  const [editSsNumber, setEditSsNumber] = useState('');
  const [editWeeklyHours, setEditWeeklyHours] = useState('40');
  const [savingInfo, setSavingInfo] = useState(false);

  // Horario de empresa (para calcular horas diarias contratadas)
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, { active: boolean; start: string; end: string }>>({});

  // Selector de periodo para los KPIs de Salud Horaria (con persistencia)
  const [summaryPeriod, setSummaryPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'calendar'>(() => {
    const saved = localStorage.getItem('fycheo_detail_summary_period');
    return (saved as any) || 'month';
  });

  const [summaryCustomDates, setSummaryCustomDates] = useState<Date[]>(() => {
    const saved = localStorage.getItem('fycheo_detail_summary_custom_dates');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((d: string) => new Date(d));
        }
      } catch (e) {
        console.error('Error parsing detail summaryCustomDates from localStorage', e);
      }
    }
    return [new Date()];
  });

  useEffect(() => {
    localStorage.setItem('fycheo_detail_summary_period', summaryPeriod);
  }, [summaryPeriod]);

  useEffect(() => {
    localStorage.setItem('fycheo_detail_summary_custom_dates', JSON.stringify(summaryCustomDates.map(d => d.toISOString())));
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

  const periodDateStrings = useMemo(() => {
    return new Set(summaryDates.map(d => getLocalDateString(d)));
  }, [summaryDates]);

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

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState(false);
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<'nomina' | 'contrato' | 'otro'>('nomina');
  const [uploadDocPeriod, setUploadDocPeriod] = useState(getLocalDateString(new Date()).slice(0, 7));
  const [uploadDocTitle, setUploadDocTitle] = useState('');
  
  // Visor de PDFs
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  // Pestaña activa en documentos
  const [docTab, setDocTab] = useState<'nomina' | 'contrato' | 'otro'>('nomina');

  // Desglose colapsable
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isAnimationDone, setIsAnimationDone] = useState(false);
  const [policies, setPolicies] = useState<Record<string, any>>({});


  useEffect(() => {
    if (!showBreakdown) {
      setIsAnimationDone(false);
    }
  }, [showBreakdown]);

  // Modales
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [modalEntryType, setModalEntryType] = useState<string>('clock-in');
  const [modalTime, setModalTime] = useState<string>('08:00');
  const [modalDescription, setModalDescription] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  const queryStart = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    
    if (summaryDates.length === 0) return startOfMonth;
    
    const firstPeriodDate = summaryDates[0];
    return firstPeriodDate < startOfMonth ? firstPeriodDate : startOfMonth;
  }, [currentDate, summaryDates]);

  const queryEnd = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
    
    if (summaryDates.length === 0) return endOfMonth;
    
    const lastPeriodDate = summaryDates[summaryDates.length - 1];
    return lastPeriodDate > endOfMonth ? lastPeriodDate : endOfMonth;
  }, [currentDate, summaryDates]);

  useEffect(() => {
    if (employeeId && activeCompany?.id) {
      loadEmployeeData();
      loadDocuments();
    }
  }, [employeeId, activeCompany?.id]);

  useEffect(() => {
    if (employeeId && activeCompany?.id) {
      loadScheduleAndEntries();
    }
  }, [employeeId, activeCompany?.id, queryStart, queryEnd]);

  const loadDocuments = async () => {
    if (!employeeId || !activeCompany?.id) return;
    try {
      const docs = await documentService.getEmployeeDocuments(employeeId, activeCompany.id);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!employeeId || !activeCompany?.id) return;
      const empData = await employeeService.getEmployeeById(employeeId, activeCompany.id);
      if (!empData) {
        setError("El empleado no se encuentra en esta organización.");
      } else {
        setEmployee(empData);
        setEditDni(empData.dni_nie || '');
        setEditSsNumber(empData.ss_number || '');
        setEditWeeklyHours(String(empData.weekly_hours ?? 40));
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar la información del empleado.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonalInfo = async () => {
    if (!employeeId || !activeCompany?.id) return;
    setSavingInfo(true);
    try {
      const wh = parseFloat(editWeeklyHours);
      await employeeService.updateEmployee(employeeId, activeCompany.id, {
        dni_nie: editDni,
        ss_number: editSsNumber,
        weekly_hours: isNaN(wh) || wh <= 0 ? 40 : wh,
      });
      setEmployee(prev => prev ? { ...prev, dni_nie: editDni, ss_number: editSsNumber, weekly_hours: isNaN(wh) || wh <= 0 ? 40 : wh } : prev);
      setIsEditingInfo(false);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la información personal.');
    } finally {
      setSavingInfo(false);
    }
  };

  const loadScheduleAndEntries = async () => {
    if (!employeeId || !activeCompany?.id) return;
    try {
      const startStr = queryStart.toISOString();
      const endStr = queryEnd.toISOString();

      const [allShifts, entries, allAbsences, settingsData, holidaysData] = await Promise.all([
        shiftService.getShifts(activeCompany.id),
        employeeService.getTimeEntries(employeeId, startStr, endStr),
        absenceService.getAbsences(activeCompany.id).catch(() => []),
        settingsService.getCompanySettings(activeCompany.id).catch(() => null),
        settingsService.getHolidays(activeCompany.id).catch(() => [])
      ]);

      // Filtrar turnos del empleado
      const empShifts = allShifts.filter(s => s.employee_id === employeeId);
      const empAbsences = allAbsences.filter(a => a.employee_id === employeeId);

      const polMap: Record<string, any> = {};
      if (settingsData && settingsData.leave_policies) {
        settingsData.leave_policies.forEach((p: any) => polMap[p.id] = p);
      }
      setPolicies(polMap);

      if (settingsData?.schedule) {
        const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
        const sched: Record<number, { active: boolean; start: string; end: string }> = {};
        Object.entries(settingsData.schedule).forEach(([key, val]: [string, any]) => {
          if (dayMap[key] !== undefined) sched[dayMap[key]] = val;
        });
        setWeeklySchedule(sched);
      }

      setShifts(empShifts);
      setTimeEntries(entries);
      setAbsences(empAbsences);
      setHolidays(new Set((holidaysData || []).map((h: any) => h.date)));
    } catch (err) {
      console.error("Error al cargar horarios/fichajes:", err);
    }
  };

  // Modal State: Fast Shift
  const [isFastShiftModalOpen, setIsFastShiftModalOpen] = useState(false);
  const [fastShiftDate, setFastShiftDate] = useState<Date | null>(null);
  const [fastShiftIsSplit, setFastShiftIsSplit] = useState(false);
  const [fastShiftStart, setFastShiftStart] = useState('09:00');
  const [fastShiftEnd, setFastShiftEnd] = useState('17:00');
  const [fastShiftStart2, setFastShiftStart2] = useState('16:00');
  const [fastShiftEnd2, setFastShiftEnd2] = useState('20:00');
  const [fastShiftBreak, setFastShiftBreak] = useState(0);
  const [fastShiftBreakPaid, setFastShiftBreakPaid] = useState(true);
  const [fastShiftColor, setFastShiftColor] = useState('bg-cyan-400');
  const [fastShiftHasPlus, setFastShiftHasPlus] = useState(false);
  const [fastShiftNotes, setFastShiftNotes] = useState('');
  const [fastShiftError, setFastShiftError] = useState<string | null>(null);

  const handleOpenAddModal = () => {
    setModalEntryType('clock-in');
    const now = new Date();
    setModalTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setModalDescription('');
    setIsAddModalOpen(true);
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !activeCompany?.id || savingAction) return;

    setSavingAction(true);
    try {
      const dateStr = formatDateString(selectedDate);
      const occurredAtStr = `${dateStr}T${modalTime}:00`;
      const occurredAt = new Date(occurredAtStr);

      const defaultLabel = modalEntryType === 'clock-in' ? 'Entrada trabajo' 
        : modalEntryType === 'clock-out' ? 'Salida trabajo'
        : modalEntryType === 'break-start' ? 'Inicio descanso'
        : modalEntryType === 'break-end' ? 'Entrada trabajo'
        : modalEntryType === 'others-out' ? 'Permiso'
        : 'Entrada trabajo';

      const payload = {
        company_id: activeCompany.id,
        user_id: employeeId,
        entry_type: modalEntryType,
        description: modalDescription.trim() || defaultLabel,
        occurred_at: occurredAt.toISOString(),
        date: dateStr,
        entry_time: modalTime,
        minutes: 0
      };

      await employeeService.createTimeEntry(payload);
      if (profile && activeCompany && employee) {
        const empName = employee.full_name || employee.name || 'Empleado';
        const typeLabel = modalEntryType === 'clock-in' ? 'Entrada' : modalEntryType === 'clock-out' ? 'Salida' : 'Descanso';
        await logService.logAction(
          activeCompany.id,
          profile.id,
          'manual_clock_in_out',
          `Registró un fichaje manual de ${typeLabel} a las ${modalTime} en nombre de ${empName}`,
          { employee_id: employee.id, employee_name: empName, entry_type: modalEntryType, time: modalTime, date: dateStr, notes: modalDescription.trim() }
        );
      }
      setIsAddModalOpen(false);
      await loadScheduleAndEntries();
    } catch (err) {
      console.error(err);
      alert("Error al registrar el fichaje manual.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenEditModal = (entry: any) => {
    setSelectedEntry(entry);
    setModalEntryType(entry.entry_type);
    const d = new Date(entry.occurred_at);
    setModalTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setModalDescription(entry.description || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || savingAction) return;

    setSavingAction(true);
    try {
      const d = new Date(selectedEntry.occurred_at);
      const dateStr = formatDateString(d);
      const occurredAtStr = `${dateStr}T${modalTime}:00`;
      const occurredAt = new Date(occurredAtStr);

      const updates = {
        entry_type: modalEntryType,
        description: modalDescription.trim() || selectedEntry.description,
        occurred_at: occurredAt.toISOString(),
        entry_time: modalTime
      };

      await employeeService.updateTimeEntry(selectedEntry.id, updates);
      if (profile && activeCompany && employee) {
        const empName = employee.full_name || employee.name || 'Empleado';
        await logService.logAction(
          activeCompany.id,
          profile.id,
          'time_entry_edited',
          `Modificó el fichaje de las ${selectedEntry.entry_time} (ahora a las ${modalTime}) en nombre de ${empName}`,
          { employee_id: employee.id, employee_name: empName, old_entry: selectedEntry, new_entry: updates, notes: modalDescription.trim() }
        );
      }
      setIsEditModalOpen(false);
      await loadScheduleAndEntries();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el fichaje.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenDeleteModal = (entry: any) => {
    setSelectedEntry(entry);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteEntry = async () => {
    if (!selectedEntry || savingAction) return;

    setSavingAction(true);
    try {
      await employeeService.deleteTimeEntry(selectedEntry.id);
      if (profile && activeCompany && employee) {
        const empName = employee.full_name || employee.name || 'Empleado';
        await logService.logAction(
          activeCompany.id,
          profile.id,
          'time_entry_deleted',
          `Eliminó el fichaje de las ${selectedEntry.entry_time} (${selectedEntry.entry_type}) en nombre de ${empName}`,
          { employee_id: employee.id, employee_name: empName, deleted_entry: selectedEntry }
        );
      }
      setIsDeleteModalOpen(false);
      await loadScheduleAndEntries();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el fichaje.");
    } finally {
      setSavingAction(false);
    }
  };

  const handleOpenFastShiftModal = (date: Date) => {
    setFastShiftDate(date);
    setFastShiftIsSplit(false);
    setFastShiftStart('09:00');
    setFastShiftEnd('17:00');
    setFastShiftStart2('16:00');
    setFastShiftEnd2('20:00');
    setFastShiftBreak(0);
    setFastShiftBreakPaid(true);
    setFastShiftColor('bg-cyan-400');
    setFastShiftHasPlus(false);
    setFastShiftNotes('');
    setFastShiftError(null);
    setIsFastShiftModalOpen(true);
  };

  const handleSaveFastShift = async () => {
    if (!fastShiftDate || !employeeId || !activeCompany?.id || savingAction) return;

    if (fastShiftIsSplit) {
      if (!fastShiftStart2 || !fastShiftEnd2) {
        setFastShiftError('Debe definir el horario del segundo tramo.');
        return;
      }
      if (fastShiftStart2 <= fastShiftEnd) {
        setFastShiftError('El segundo tramo debe empezar después del primero.');
        return;
      }
    }

    setSavingAction(true);
    setFastShiftError(null);
    try {
      const shiftDateStr = formatDateString(fastShiftDate);
      const newShifts: Shift[] = [];
      const baseNotes = fastShiftNotes.trim();
      const finalNotes = fastShiftBreak > 0
        ? `${baseNotes ? baseNotes + '\n' : ''}Descanso: ${fastShiftBreak}m (${fastShiftBreakPaid ? 'Pagado' : 'No Pagado'})`
        : baseNotes;
        
      const notesWithPlus = fastShiftHasPlus ? `${finalNotes ? finalNotes + '\n' : ''}[Plus Salarial]` : finalNotes;

      newShifts.push({
        id: crypto.randomUUID(),
        company_id: activeCompany.id,
        employee_id: employeeId,
        date: shiftDateStr,
        start_time: fastShiftStart,
        end_time: fastShiftEnd,
        notes: notesWithPlus.trim(),
        color: fastShiftColor,
        status: 'scheduled' as const,
        is_published: true
      } as Shift);

      if (fastShiftIsSplit) {
        newShifts.push({
          id: crypto.randomUUID(),
          company_id: activeCompany.id,
          employee_id: employeeId,
          date: shiftDateStr,
          start_time: fastShiftStart2,
          end_time: fastShiftEnd2,
          notes: notesWithPlus.trim(),
          color: fastShiftColor,
          status: 'scheduled' as const,
          is_published: true
        } as Shift);
      }

      await shiftService.saveShifts(activeCompany.id, [...shifts, ...newShifts]);
      setIsFastShiftModalOpen(false);
      setSelectedDate(fastShiftDate);
      await loadScheduleAndEntries();
    } catch (err) {
      console.error(err);
      alert("Error al crear el turno rápido.");
    } finally {
      setSavingAction(false);
    }
  };

  // --- Cálculos de Estado y KPIs ---
  
  const handleForceClockOut = async () => {
    if (!employeeId || !activeCompany?.id || savingAction) return;
    setSavingAction(true);
    try {
      const now = new Date();
      const dateStr = formatDateString(now);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const payload = {
        company_id: activeCompany.id,
        user_id: employeeId,
        entry_type: 'clock-out',
        description: 'Forzado por administrador',
        occurred_at: now.toISOString(),
        date: dateStr,
        entry_time: timeStr,
        minutes: 0
      };
      await employeeService.createTimeEntry(payload);
      if (profile && activeCompany && employee) {
        const empName = employee.full_name || employee.name || 'Empleado';
        await logService.logAction(
          activeCompany.id,
          profile.id,
          'force_clock_out',
          `Forzó la salida del empleado ${empName}`,
          { employee_id: employee.id, employee_name: empName, date: dateStr, time: timeStr }
        );
      }
      await loadScheduleAndEntries();
    } catch (err) {
      console.error(err);
      alert("Error al forzar la salida.");
    } finally {
      setSavingAction(false);
    }
  };

  // Fichajes filtrados para el día seleccionado
  const selectedDayEntries = useMemo(() => {
    const dateStr = formatDateString(selectedDate);
    return timeEntries.filter(entry => {
      const entryDate = entry.occurred_at ? entry.occurred_at.split('T')[0] : entry.date;
      return entryDate === dateStr;
    }).sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  }, [timeEntries, selectedDate]);

  // Turno planificado para el día seleccionado
  const selectedDayShift = useMemo(() => {
    const dateStr = formatDateString(selectedDate);
    return shifts.find(s => s.date === dateStr && s.status !== 'pending_deletion');
  }, [shifts, selectedDate]);

  // Estado en tiempo real hoy
  const currentStatus = useMemo(() => {
    const todayStr = formatDateString(new Date());
    const todayEntries = timeEntries.filter(entry => {
      const entryDate = entry.occurred_at ? entry.occurred_at.split('T')[0] : entry.date;
      return entryDate === todayStr;
    }).sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

    if (todayEntries.length === 0) return { label: 'Fuera de turno', color: 'text-slate-400 border-slate-500/20 bg-slate-500/5', dotColor: 'bg-slate-400' };

    const lastEntry = todayEntries[todayEntries.length - 1];
    const type = lastEntry.entry_type;

    if (type === 'clock-in' || type === 'break-end' || type === 'others-in') {
      return { label: 'Trabajando', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5', dotColor: 'bg-emerald-400' };
    }
    if (type === 'break-start') {
      return { label: 'Descansando', color: 'text-amber-400 border-amber-500/20 bg-amber-500/5', dotColor: 'bg-amber-400' };
    }
    if (type === 'others-out') {
      return { label: 'Permiso', color: 'text-pink-400 border-pink-500/20 bg-pink-500/5', dotColor: 'bg-pink-400' };
    }
    return { label: 'Fuera de turno', color: 'text-slate-400 border-slate-500/20 bg-slate-500/5', dotColor: 'bg-slate-400' };
  }, [timeEntries]);

  // KPIs de Salud Horaria del periodo seleccionado
  const healthStats = useMemo(() => {
    // Horas diarias contratadas según horas semanales y días activos de la empresa
    const activeDaysPerWeek = Object.values(weeklySchedule).filter(d => d.active).length || 5;
    const dailyExpectedHours = (employee?.weekly_hours ?? 40) / activeDaysPerWeek;

    // 1. Horas planificadas: Suma de duraciones de turnos del periodo
    let plannedMinutes = 0;
    shifts.forEach(s => {
      if (s.status === 'pending_deletion') return;
      if (!periodDateStrings.has(s.date)) return; // Filtrar por periodo
      
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; // Por si cruza medianoche
      
      plannedMinutes += diff;
    });

    // 2. Horas reales trabajadas: Calcular por día del periodo en base a fichajes
    let realMinutes = 0;
    let totalBreakMinutes = 0;
    let laborablesWorkingMinutes = 0;
    let weekendWorkingMinutes = 0;
    let holidayWorkingMinutes = 0;
    let dayWorkingMinutesTotal = 0;
    let nightWorkingMinutesTotal = 0;
    let totalBreakCount = 0;
    let daysWithEntriesCount = 0;
    
    // Agrupar fichajes por fecha
    const entriesByDate: Record<string, any[]> = {};
    timeEntries.forEach(entry => {
      const dStr = entry.occurred_at ? entry.occurred_at.split('T')[0] : entry.date;
      if (!periodDateStrings.has(dStr)) return; // Filtrar por periodo
      
      if (!entriesByDate[dStr]) entriesByDate[dStr] = [];
      entriesByDate[dStr].push(entry);
    });

    Object.keys(entriesByDate).forEach(dStr => {
      const dayEntries = [...entriesByDate[dStr]].sort(
        (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      );

      if (dayEntries.length > 0) {
        daysWithEntriesCount++;
      }

      const dateObj = new Date(dStr);
      const isHoliday = holidays.has(dStr);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      let workingStart: Date | null = null;
      let dayWorkingMinutes = 0;
      let breakStart: Date | null = null;
      let dayBreakMinutes = 0;

      for (const e of dayEntries) {
        const type = e.entry_type;
        const time = new Date(e.occurred_at);

        if (type === 'clock-in' || type === 'break-end' || type === 'others-in') {
          if (!workingStart) workingStart = time;
          if (type === 'break-end' && breakStart) {
            dayBreakMinutes += (time.getTime() - breakStart.getTime()) / 1000 / 60;
            breakStart = null;
          }
        } else if (type === 'clock-out' || type === 'break-start' || type === 'others-out') {
          if (workingStart) {
            const segmentMin = (time.getTime() - workingStart.getTime()) / 1000 / 60;
            dayWorkingMinutes += segmentMin;

            const { dayMinutes, nightMinutes } = calculateDayNightMinutes(workingStart, time);
            dayWorkingMinutesTotal += dayMinutes;
            nightWorkingMinutesTotal += nightMinutes;

            if (isHoliday) {
              holidayWorkingMinutes += segmentMin;
            } else if (isWeekend) {
              weekendWorkingMinutes += segmentMin;
            } else {
              laborablesWorkingMinutes += segmentMin;
            }

            workingStart = null;
          }
          if (type === 'break-start') {
            breakStart = time;
            totalBreakCount++;
          }
          if (type === 'clock-out' && breakStart) {
            dayBreakMinutes += (time.getTime() - breakStart.getTime()) / 1000 / 60;
            breakStart = null;
          }
        }
      }

      // Si el empleado sigue trabajando hoy y "hoy" está en el periodo
      const todayStr = formatDateString(new Date());
      if (dStr === todayStr && workingStart) {
        const now = new Date();
        const segmentMin = (now.getTime() - workingStart.getTime()) / 1000 / 60;
        dayWorkingMinutes += segmentMin;

        const { dayMinutes, nightMinutes } = calculateDayNightMinutes(workingStart, now);
        dayWorkingMinutesTotal += dayMinutes;
        nightWorkingMinutesTotal += nightMinutes;

        if (isHoliday) {
          holidayWorkingMinutes += segmentMin;
        } else if (isWeekend) {
          weekendWorkingMinutes += segmentMin;
        } else {
          laborablesWorkingMinutes += segmentMin;
        }
      }

      // Si el empleado sigue en descanso hoy y "hoy" está en el periodo
      if (dStr === todayStr && breakStart) {
        dayBreakMinutes += (new Date().getTime() - breakStart.getTime()) / 1000 / 60;
      }

      realMinutes += dayWorkingMinutes;
      totalBreakMinutes += dayBreakMinutes;
    });

    // 3. Puntualidad: Verificar turnos planificados vs primer fichaje de entrada
    let totalEvaluatedShifts = 0;
    let onTimeShifts = 0;

    shifts.forEach(s => {
      if (s.status === 'pending_deletion') return;
      if (!periodDateStrings.has(s.date)) return; // Filtrar por periodo
      
      // Obtener fichajes de ese día
      const dayEntries = timeEntries.filter(entry => {
        const entryDate = entry.occurred_at ? entry.occurred_at.split('T')[0] : entry.date;
        return entryDate === s.date;
      }).sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

      // Solo evaluamos puntualidad si el día ya pasó o si ya hay algún fichaje de entrada hoy
      const isPast = s.date < formatDateString(new Date());
      const hasClockIn = dayEntries.some(e => e.entry_type === 'clock-in');

      if (isPast || hasClockIn) {
        totalEvaluatedShifts++;
        const firstIn = dayEntries.find(e => e.entry_type === 'clock-in');
        
        if (firstIn) {
          const inTime = new Date(firstIn.occurred_at);
          const [sh, sm] = s.start_time.split(':').map(Number);
          const plannedIn = new Date(`${s.date}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`);

          // Tolerancia de 10 minutos tarde
          const diffMin = (inTime.getTime() - plannedIn.getTime()) / 1000 / 60;
          if (diffMin <= 10) {
            onTimeShifts++;
          }
        }
      }
    });

    // 4. Calcular ausencias, vacaciones, bajas médicas y permisos en el período
    let vacationDays = 0;
    let medicalDays = 0;
    let paidLeaveMinutes = 0;

    const vacationDetails: Array<{ start: string; end: string | null; days: number; reason?: string }> = [];
    const medicalApproved: Array<{ start: string; end: string | null; days: number; reason?: string }> = [];
    const medicalPending: Array<{ start: string; end: string | null; days: number; reason?: string }> = [];
    const paidLeaveApproved: Array<{ start: string; end: string | null; days: number; hours: number; typeLabel: string; reason?: string }> = [];
    const paidLeavePending: Array<{ start: string; end: string | null; days: number; hours: number; typeLabel: string; reason?: string }> = [];

    absences.forEach(a => {
      if (a.status === 'rejected') return;

      const start = new Date(a.start_date);
      const end = a.end_date ? new Date(a.end_date) : new Date();

      const absenceDates = getDatesInRange(start, end);
      
      let daysInPeriod = 0;
      absenceDates.forEach(d => {
        const dStr = getLocalDateString(d);
        if (periodDateStrings.has(dStr)) {
          daysInPeriod++;
        }
      });

      if (daysInPeriod === 0) return;

      const typeLabel = getAbsenceTypeName(a.type, policies);

      if (a.status === 'approved') {
        if (a.type === 'vacation') {
          vacationDays += daysInPeriod;
          vacationDetails.push({
            start: a.start_date,
            end: a.end_date,
            days: daysInPeriod,
            reason: a.reason
          });
        } else if (a.type === 'medical') {
          medicalDays += daysInPeriod;
          medicalApproved.push({
            start: a.start_date,
            end: a.end_date,
            days: daysInPeriod,
            reason: a.reason
          });
        } else if (a.type === 'manual_unpaid') {
          // No se cuenta en permisos pagados
        } else {
          paidLeaveMinutes += daysInPeriod * dailyExpectedHours * 60;
          paidLeaveApproved.push({
            start: a.start_date,
            end: a.end_date,
            days: daysInPeriod,
            hours: Math.round(daysInPeriod * dailyExpectedHours * 10) / 10,
            typeLabel,
            reason: a.reason
          });
        }
      } else if (a.status === 'pending') {
        if (a.type === 'medical') {
          medicalPending.push({
            start: a.start_date,
            end: a.end_date,
            days: daysInPeriod,
            reason: a.reason
          });
        } else if (a.type !== 'vacation' && a.type !== 'manual_unpaid') {
          paidLeavePending.push({
            start: a.start_date,
            end: a.end_date,
            days: daysInPeriod,
            hours: Math.round(daysInPeriod * dailyExpectedHours * 10) / 10,
            typeLabel,
            reason: a.reason
          });
        }
      }
    });

    const plannedHours = Math.round((plannedMinutes / 60) * 10) / 10;
    const realHours = Math.round((realMinutes / 60) * 10) / 10;
    const medicalHours = medicalDays * dailyExpectedHours;
    const netPlannedHours = Math.max(0, plannedHours - medicalHours);
    
    const balance = Math.round((realHours - netPlannedHours) * 10) / 10;
    const punctuality = totalEvaluatedShifts > 0 ? Math.round((onTimeShifts / totalEvaluatedShifts) * 100) : 100;

    const ordinaryHours = netPlannedHours > 0 ? Math.min(realHours, netPlannedHours) : realHours;
    const extraHours = netPlannedHours > 0 ? Math.max(0, realHours - netPlannedHours) : 0;
    const paidLeaveHours = paidLeaveMinutes / 60;
    const breakHours = totalBreakMinutes / 60;

    // Prorrateo de las horas ordinarias y extras
    const ordinaryRatio = realHours > 0 ? ordinaryHours / realHours : 0;
    const extraRatio = realHours > 0 ? extraHours / realHours : 0;

    const ordinaryLaborables = Math.round((laborablesWorkingMinutes / 60) * ordinaryRatio * 10) / 10;
    const ordinaryWeekend = Math.round((weekendWorkingMinutes / 60) * ordinaryRatio * 10) / 10;
    const ordinaryHolidays = Math.round((holidayWorkingMinutes / 60) * ordinaryRatio * 10) / 10;
    const ordinaryDay = Math.round((dayWorkingMinutesTotal / 60) * ordinaryRatio * 10) / 10;
    const ordinaryNight = Math.round((nightWorkingMinutesTotal / 60) * ordinaryRatio * 10) / 10;

    const extraLaborables = Math.round((laborablesWorkingMinutes / 60) * extraRatio * 10) / 10;
    const extraWeekend = Math.round((weekendWorkingMinutes / 60) * extraRatio * 10) / 10;
    const extraHolidays = Math.round((holidayWorkingMinutes / 60) * extraRatio * 10) / 10;
    const extraDay = Math.round((dayWorkingMinutesTotal / 60) * extraRatio * 10) / 10;
    const extraNight = Math.round((nightWorkingMinutesTotal / 60) * extraRatio * 10) / 10;

    const breakAverageMinutes = totalBreakCount > 0 ? Math.round(totalBreakMinutes / totalBreakCount) : 0;
    const breakDailyAverageMinutes = daysWithEntriesCount > 0 ? Math.round(totalBreakMinutes / daysWithEntriesCount) : 0;

    return {
      plannedHours,
      realHours,
      balance,
      punctuality,
      ordinaryHours,
      extraHours,
      vacationDays,
      medicalDays,
      netPlannedHours,
      paidLeaveHours,
      breakHours,
      details: {
        ordinary: {
          laborables: ordinaryLaborables,
          weekend: ordinaryWeekend,
          holidays: ordinaryHolidays,
          day: ordinaryDay,
          night: ordinaryNight
        },
        extra: {
          laborables: extraLaborables,
          weekend: extraWeekend,
          holidays: extraHolidays,
          day: extraDay,
          night: extraNight
        },
        vacations: vacationDetails,
        paidLeave: {
          approved: paidLeaveApproved,
          pending: paidLeavePending
        },
        breaks: {
          count: totalBreakCount,
          average: breakAverageMinutes,
          dailyAverage: breakDailyAverageMinutes
        },
        medical: {
          approved: medicalApproved,
          pending: medicalPending
        }
      }
    };
  }, [shifts, timeEntries, periodDateStrings, absences, policies, holidays]);



  // Escala de temperatura para el porcentaje de Puntualidad
  const punctualityColorClass = useMemo(() => {
    const pct = healthStats.punctuality;
    if (pct < 75) return 'text-red-400';
    if (pct < 90) return 'text-amber-400';
    return 'text-emerald-400';
  }, [healthStats.punctuality]);


  // --- Datos del Calendario del Mes ---

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const startingOffset = firstDay === 0 ? 6 : firstDay - 1; // Lunes = 0
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Rellenar días del mes anterior vacíos
    for (let i = 0; i < startingOffset; i++) {
      days.push({ dayNumber: null, date: null, hasShift: false, status: 'empty' });
    }

    // Días del mes actual
    const todayStr = formatDateString(new Date());
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dStr = formatDateString(d);
      
      const dayShift = shifts.find(s => s.date === dStr && s.status !== 'pending_deletion');
      const dayEntries = timeEntries.filter(entry => {
        const entryDate = entry.occurred_at ? entry.occurred_at.split('T')[0] : entry.date;
        return entryDate === dStr;
      });

      let status: 'empty' | 'scheduled' | 'completed' | 'absent' | 'incomplete' = 'empty';

      if (dayShift) {
        const isPast = dStr < todayStr;
        const isToday = dStr === todayStr;

        if (isPast) {
          // Si es pasado y hay fichajes, consideramos completado. Si no, ausente.
          if (dayEntries.length > 0) {
            const hasIn = dayEntries.some(e => e.entry_type === 'clock-in');
            const hasOut = dayEntries.some(e => e.entry_type === 'clock-out');
            status = hasIn && hasOut ? 'completed' : 'incomplete';
          } else {
            status = 'absent';
          }
        } else if (isToday) {
          if (dayEntries.length > 0) {
            status = 'incomplete';
          } else {
            status = 'scheduled';
          }
        } else {
          status = 'scheduled';
        }
      } else if (dayEntries.length > 0) {
        status = 'completed'; // Trabajó fuera de turno planificado
      }

      days.push({
        dayNumber: i,
        date: d,
        hasShift: !!dayShift,
        shiftDetails: dayShift,
        status
      });
    }

    return days;
  }, [shifts, timeEntries, currentDate]);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="bg-surface-dark border border-red-500/10 rounded-2xl p-8 text-center max-w-lg mx-auto mt-12">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 border border-red-500/20">
          <ShieldAlert size={32} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Error al cargar datos</h3>
        <p className="text-slate-400 mb-6">{error || 'No pudimos localizar al empleado solicitado.'}</p>
        <button onClick={() => navigate('/manager/equipos')} className="bg-primary text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
          <ArrowLeft size={18} /> Volver a Equipos
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón de retroceso */}
      <button 
        onClick={() => navigate('/manager/equipos')} 
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-white/5 border border-white/5 px-3.5 py-1.5 rounded-xl text-sm font-medium w-fit"
      >
        <ArrowLeft size={16} /> Volver a Equipos
      </button>

      {/* Cabecera + Información Personal unificadas */}
      <div className="bg-surface-dark border border-white/5 rounded-2xl overflow-hidden">
        {/* Fila superior: Perfil y acciones */}
        <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 text-2xl font-bold overflow-hidden">
                {employee.avatar ? (
                  <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                ) : (
                  employee.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-surface-dark ${
                currentStatus.label === 'Trabajando' ? 'bg-emerald-500' :
                currentStatus.label === 'Descansando' ? 'bg-amber-500' :
                currentStatus.label === 'Permiso' ? 'bg-pink-500' : 'bg-slate-500'
              }`} title={`Estado hoy: ${currentStatus.label}`} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">{employee.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStatus.color}`}>
                  {currentStatus.label}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                <span>{employee.email}</span>
                <span className="text-slate-600">•</span>
                <span>{employee.phone || 'Sin teléfono'}</span>
                
                <span className="italic font-light opacity-50">{roleLabels[employee.role] || employee.role}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="bg-black/30 border border-white/5 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0">
              <Clock className="text-slate-400" size={18} />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider leading-none">Último Fichaje Hoy</span>
                <span className="text-sm font-semibold text-slate-200 mt-1">
                  {timeEntries.filter(e => e.date === formatDateString(new Date())).length > 0 ? (
                    (() => {
                      const todayEntries = timeEntries
                        .filter(e => e.date === formatDateString(new Date()))
                        .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
                      const last = todayEntries[todayEntries.length - 1];
                      return `${last.entry_time} (${last.description})`;
                    })()
                  ) : 'Ninguno registrado'}
                </span>
              </div>
            </div>
            {currentStatus.label === 'Trabajando' && (
              <button 
                onClick={handleForceClockOut}
                disabled={savingAction}
                className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors shrink-0 disabled:opacity-50"
                title="Cerrar el turno actual inmediatamente"
              >
                <LogOut size={16} />
                Forzar Salida
              </button>
            )}
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-white/5" />

        {/* Fila inferior: Información Personal compacta */}
        <div className="px-6 py-3 flex flex-wrap items-center gap-4">

          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* DNI */}
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider shrink-0">DNI/NIE</span>
              {isEditingInfo ? (
                <input
                  type="text"
                  value={editDni}
                  onChange={e => setEditDni(e.target.value)}
                  placeholder="Ej: 12345678Z"
                  className="bg-transparent border-none outline-none text-sm font-semibold text-white w-32 placeholder:text-slate-600"
                />
              ) : (
                <span className={`text-sm font-semibold ${employee.dni_nie ? 'text-slate-200' : 'text-red-400 italic'}`}>
                  {employee.dni_nie || 'No especificado'}
                </span>
              )}
            </div>

            {/* SS */}
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider shrink-0">Seg. Social</span>
              {isEditingInfo ? (
                <input
                  type="text"
                  value={editSsNumber}
                  onChange={e => setEditSsNumber(e.target.value)}
                  placeholder="Ej: 01 12345678 12"
                  className="bg-transparent border-none outline-none text-sm font-semibold text-white w-40 placeholder:text-slate-600"
                />
              ) : (
                <span className={`text-sm font-semibold ${employee.ss_number ? 'text-slate-200' : 'text-red-400 italic'}`}>
                  {employee.ss_number || 'No especificado'}
                </span>
              )}
            </div>

            {/* Horas semanales contratadas */}
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider shrink-0">H/Semana</span>
              {isEditingInfo ? (
                <input
                  type="number"
                  min="1"
                  max="80"
                  step="0.5"
                  value={editWeeklyHours}
                  onChange={e => setEditWeeklyHours(e.target.value)}
                  placeholder="40"
                  className="bg-transparent border-none outline-none text-sm font-semibold text-white w-16 placeholder:text-slate-600"
                />
              ) : (
                <span className="text-sm font-semibold text-slate-200">
                  {employee.weekly_hours ?? 40}h
                </span>
              )}
            </div>
          </div>

          {/* Botón editar/guardar */}
          <button
            onClick={() => isEditingInfo ? handleSavePersonalInfo() : setIsEditingInfo(true)}
            disabled={savingInfo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
              isEditingInfo
                ? 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/20'
                : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            } disabled:opacity-50`}
          >
            {savingInfo ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isEditingInfo ? (
              'Guardar'
            ) : (
              <><Pencil size={12} /> Editar</>
            )}
          </button>
        </div>
      </div>


      {/* Cuadro Único de Salud Horaria */}
      <div className="bg-surface-dark border border-white/5 rounded-2xl">
        {/* Cabecera y Selector de Período */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">Salud Horaria</h2>
              <p className="text-slate-500 text-[11px] mt-0.5">Métricas de horas y puntualidad del período</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {summaryPeriod === 'calendar' ? (
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
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
                  className="bg-black/50 border border-white/10 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer focus:ring-2 focus:ring-primary/20 flex-1 sm:flex-initial"
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
                  className="bg-black/50 border border-white/10 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-primary/50 cursor-pointer focus:ring-2 focus:ring-primary/20 flex-1 sm:flex-initial"
                />
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-semibold bg-black/30 px-3 py-2 rounded-xl border border-white/5 whitespace-nowrap">
                {summaryPeriodLabel}
              </span>
            )}
            
            <div className="flex-1 sm:flex-initial flex items-center gap-2">
              <CustomSelect
                value={summaryPeriod}
                onChange={(val) => setSummaryPeriod(val as any)}
                options={[
                  { value: 'day', label: 'Un Día' },
                  { value: 'week', label: 'Una Semana' },
                  { value: 'month', label: 'Un Mes' },
                  { value: 'year', label: 'Un Año' },
                  { value: 'calendar', label: 'Fechas' }
                ]}
                size="sm"
                className="min-w-[140px]"
                dropdownClassName="right-0 left-auto sm:w-48"
              />
            </div>
          </div>
        </div>

        {/* Grid de KPIs con divisores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* KPI: Horas Planificadas */}
          <div className="p-5 flex flex-col justify-between border-b sm:border-r lg:border-b-0 lg:border-r border-white/5">
            <span className="text-sm text-slate-400 font-semibold">Planificadas</span>
            <div className="mt-3">
              <span className="text-2xl font-black text-white">{formatHoursToClock(healthStats.plannedHours)}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {summaryPeriod === 'day' ? 'Turno programado' :
               summaryPeriod === 'week' ? 'Suma de turnos de la semana' :
               summaryPeriod === 'month' ? 'Suma de turnos del mes' :
               summaryPeriod === 'year' ? 'Suma de turnos del año' : 'Suma de turnos del período'}
            </p>
          </div>

          {/* KPI: Horas Trabajadas */}
          <div className="p-5 flex flex-col justify-between border-b sm:border-r-0 lg:border-b-0 lg:border-r border-white/5">
            <span className="text-sm text-slate-400 font-semibold">Trabajadas</span>
            <div className="mt-3">
              <span className="text-2xl font-black text-white">{formatHoursToClock(healthStats.realHours)}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {summaryPeriod === 'day' ? 'Fichajes del día' :
               summaryPeriod === 'week' ? 'Según fichajes de la semana' :
               summaryPeriod === 'month' ? 'Según fichajes del mes' :
               summaryPeriod === 'year' ? 'Según fichajes del año' : 'Según fichajes del período'}
            </p>
          </div>

          {/* KPI: Bolsa de Horas */}
          <div className="p-5 flex flex-col justify-between border-b sm:border-b-0 sm:border-r lg:border-b-0 lg:border-r border-white/5">
            <span className="text-sm text-slate-400 font-semibold">Bolsa de Horas</span>
            <div className="mt-3">
              <span 
                className="text-2xl font-black text-white"
              >
                {formatHoursToTime(healthStats.balance)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Diferencia planificadas vs reales</p>
          </div>

          {/* KPI: Puntualidad */}
          <div className="p-5 flex flex-col justify-between">
            <span className="text-sm text-slate-400 font-semibold">Puntualidad</span>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span 
                className={`text-2xl font-black transition-colors ${punctualityColorClass}`}
              >
                {healthStats.punctuality}%
              </span>
              <span className="text-xs text-slate-500 font-medium">a tiempo</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Margen tolerancia 10m</p>
          </div>
        </div>

        {/* Botón para expandir/colapsar el desglose detallado */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className={`w-full flex items-center justify-between px-5 py-3.5 bg-black/20 hover:bg-black/40 border-t border-white/5 text-xs font-semibold text-slate-400 hover:text-white transition-all duration-200 ${!showBreakdown ? 'rounded-b-2xl' : ''}`}
        >
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${showBreakdown ? 'bg-primary/40' : 'bg-slate-400/40'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${showBreakdown ? 'bg-primary' : 'bg-slate-500'}`}></span>
            </span>
            {showBreakdown ? 'Ocultar desglose detallado' : 'Mostrar desglose detallado'}
          </span>
          <motion.div
            animate={{ rotate: showBreakdown ? 180 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <ChevronDown size={16} className="text-slate-400" />
          </motion.div>
        </button>

        {/* Desglose de Conceptos de Horas (Grid de 2x3 con Animación y Tooltips) */}
        <AnimatePresence initial={false}>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              onAnimationComplete={() => {
                if (showBreakdown) {
                  setIsAnimationDone(true);
                }
              }}
              className={`${isAnimationDone ? 'overflow-visible' : 'overflow-hidden'} border-t border-white/5 bg-black/10 rounded-b-2xl`}
            >
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {/* Horas Ordinarias */}
                <div className="group relative cursor-help">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Horas Ordinarias
                    </span>
                    <span className="font-bold text-slate-200">
                      {formatHoursToClock(healthStats.ordinaryHours)} / {formatHoursToClock(healthStats.netPlannedHours)}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500" 
                      style={{ width: `${Math.min(healthStats.netPlannedHours > 0 ? (healthStats.ordinaryHours / healthStats.netPlannedHours) * 100 : 0, 100)}%` }} 
                    />
                  </div>

                  {/* Tooltip Ordinarias */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 hidden group-hover:flex flex-col gap-2 p-4 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-slate-300 z-[100] pointer-events-none transition-all duration-200">
                    <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Desglose: Horas Ordinarias
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Jornada Laborable:</span>
                      <span className="font-semibold text-white">{healthStats.details.ordinary.laborables} h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Fines de Semana:</span>
                      <span className="font-semibold text-white">{healthStats.details.ordinary.weekend} h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Días Festivos:</span>
                      <span className="font-semibold text-white">{healthStats.details.ordinary.holidays} h</span>
                    </div>
                    <div className="border-t border-white/5 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Horas Diurnas (06-22h):</span>
                      <span className="font-semibold text-white">{healthStats.details.ordinary.day} h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Horas Nocturnas (22-06h):</span>
                      <span className="font-semibold text-white">{healthStats.details.ordinary.night} h</span>
                    </div>
                  </div>
                </div>

                {/* Horas Extras */}
                <div className="group relative cursor-help">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      Horas Extras
                    </span>
                    <span className="font-bold text-orange-400">
                      {formatHoursToClock(healthStats.extraHours)}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-orange-500 transition-all duration-500" 
                      style={{ width: `${healthStats.netPlannedHours > 0 ? Math.min((healthStats.extraHours / healthStats.netPlannedHours) * 100, 100) : 0}%` }} 
                    />
                  </div>

                  {/* Tooltip Extras */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 hidden group-hover:flex flex-col gap-2 p-4 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-slate-300 z-[100] pointer-events-none transition-all duration-200">
                    <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      Desglose: Horas Extras
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">En Días Laborables:</span>
                      <span className="font-semibold text-white">{healthStats.details.extra.laborables} h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">En Fines de Semana:</span>
                      <span className="font-semibold text-white">{healthStats.details.extra.weekend} h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">En Días Festivos:</span>
                      <span className="font-semibold text-white">{healthStats.details.extra.holidays} h</span>
                    </div>
                    <div className="border-t border-white/5 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Extras Diurnas (06-22h):</span>
                      <span className="font-semibold text-white">{healthStats.details.extra.day} h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Extras Nocturnas (22-06h):</span>
                      <span className="font-semibold text-white">{healthStats.details.extra.night} h</span>
                    </div>
                  </div>
                </div>

                {/* Vacaciones */}
                <div className="group relative cursor-help">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Vacaciones
                    </span>
                    <span className="font-bold text-indigo-400">
                      {healthStats.vacationDays} {healthStats.vacationDays === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500" 
                      style={{ width: `${healthStats.vacationDays > 0 ? 100 : 0}%` }} 
                    />
                  </div>

                  {/* Tooltip Vacaciones */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 hidden group-hover:flex flex-col gap-2 p-4 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-slate-300 z-[100] pointer-events-none transition-all duration-200">
                    <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Vacaciones ({healthStats.vacationDays} {healthStats.vacationDays === 1 ? 'día' : 'días'})
                    </div>
                    {healthStats.details.vacations.length === 0 ? (
                      <span className="text-slate-500 italic py-1">Sin vacaciones registradas</span>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-1">
                        {healthStats.details.vacations.map((v, i) => (
                          <div key={i} className="flex flex-col border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                            <div className="flex justify-between text-white font-medium">
                              <span>
                                {new Date(v.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                {v.end && ` - ${new Date(v.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`}
                              </span>
                              <span className="text-indigo-400 font-bold">{v.days} {v.days === 1 ? 'día' : 'días'}</span>
                            </div>
                            {v.reason && <span className="text-[10px] text-slate-400 mt-0.5 truncate" title={v.reason}>{v.reason}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Permisos Retribuidos */}
                <div className="group relative cursor-help">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      Permisos Retribuidos
                    </span>
                    <span className="font-bold text-teal-400">
                      {formatHoursToClock(healthStats.paidLeaveHours)}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-teal-500 transition-all duration-500" 
                      style={{ width: `${healthStats.paidLeaveHours > 0 ? 100 : 0}%` }} 
                    />
                  </div>

                  {/* Tooltip Permisos Retribuidos */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 hidden group-hover:flex flex-col gap-2 p-4 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-slate-300 z-[100] pointer-events-none transition-all duration-200">
                    <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      Permisos Retribuidos
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Disfrutados (Aprobados)</span>
                      {healthStats.details.paidLeave.approved.length === 0 ? (
                        <span className="text-slate-500 italic pb-1">Ninguno disfrutado</span>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1 pb-1">
                          {healthStats.details.paidLeave.approved.map((p, i) => (
                            <div key={i} className="flex justify-between items-baseline text-[11px] border-b border-white/5 pb-1 last:border-0 last:pb-0">
                              <div className="flex flex-col">
                                <span className="text-white font-medium truncate max-w-[140px]">{p.typeLabel}</span>
                                {p.reason && <span className="text-[9px] text-slate-400 truncate max-w-[140px]">{p.reason}</span>}
                              </div>
                              <span className="text-teal-400 font-semibold shrink-0">{p.days} {p.days === 1 ? 'día' : 'días'} ({p.hours}h)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 border-t border-white/5 pt-1.5">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Propuestos (Pendientes)</span>
                      {healthStats.details.paidLeave.pending.length === 0 ? (
                        <span className="text-slate-500 italic">Sin solicitudes pendientes</span>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1">
                          {healthStats.details.paidLeave.pending.map((p, i) => (
                            <div key={i} className="flex justify-between items-baseline text-[11px] border-b border-white/5 pb-1 last:border-0 last:pb-0">
                              <div className="flex flex-col">
                                <span className="text-slate-200 font-medium truncate max-w-[140px]">{p.typeLabel}</span>
                                {p.reason && <span className="text-[9px] text-slate-400 truncate max-w-[140px]">{p.reason}</span>}
                              </div>
                              <span className="text-amber-400 font-semibold shrink-0">{p.days} {p.days === 1 ? 'día' : 'días'} ({p.hours}h)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pausas / Descansos */}
                <div className="group relative cursor-help">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      Pausas / Descansos
                    </span>
                    <span className="font-bold text-yellow-400">
                      {formatHoursToClock(healthStats.breakHours)}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-yellow-500 transition-all duration-500" 
                      style={{ width: `${healthStats.breakHours > 0 ? 100 : 0}%` }} 
                    />
                  </div>

                  {/* Tooltip Pausas */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 hidden group-hover:flex flex-col gap-2 p-4 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-slate-300 z-[100] pointer-events-none transition-all duration-200">
                    <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      Estadísticas de Descansos
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Descansos:</span>
                      <span className="font-semibold text-white">{healthStats.details.breaks.count} pausas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Duración Promedio:</span>
                      <span className="font-semibold text-white">{healthStats.details.breaks.average} min / pausa</span>
                    </div>
                    <div className="border-t border-white/5 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Promedio Diario:</span>
                      <span className="font-semibold text-white">{healthStats.details.breaks.dailyAverage} min / día</span>
                    </div>
                  </div>
                </div>

                {/* Bajas Médicas */}
                <div className="group relative cursor-help">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Bajas Médicas
                    </span>
                    <span className="font-bold text-red-400">
                      {healthStats.medicalDays} {healthStats.medicalDays === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-red-500 transition-all duration-500" 
                      style={{ width: `${healthStats.medicalDays > 0 ? 100 : 0}%` }} 
                    />
                  </div>

                  {/* Tooltip Bajas */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 hidden group-hover:flex flex-col gap-2 p-4 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-slate-300 z-[100] pointer-events-none transition-all duration-200">
                    <div className="font-bold text-white border-b border-white/10 pb-1.5 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Bajas Médicas ({healthStats.medicalDays} {healthStats.medicalDays === 1 ? 'día' : 'días'})
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Confirmadas</span>
                      {healthStats.details.medical.approved.length === 0 ? (
                        <span className="text-slate-500 italic pb-1">Ninguna baja registrada</span>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1 pb-1">
                          {healthStats.details.medical.approved.map((m, i) => (
                            <div key={i} className="flex justify-between items-baseline text-[11px] border-b border-white/5 pb-1 last:border-0 last:pb-0">
                              <div className="flex flex-col">
                                <span className="text-white font-medium truncate max-w-[140px]">
                                  {new Date(m.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                  {m.end ? ` - ${new Date(m.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}` : ' (Abierta)'}
                                </span>
                                {m.reason && <span className="text-[9px] text-slate-400 truncate max-w-[140px]">{m.reason}</span>}
                              </div>
                              <span className="text-red-400 font-bold shrink-0">{m.days} {m.days === 1 ? 'd' : 'd'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 border-t border-white/5 pt-1.5">
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Pendientes</span>
                      {healthStats.details.medical.pending.length === 0 ? (
                        <span className="text-slate-500 italic">Sin solicitudes pendientes</span>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto pr-1">
                          {healthStats.details.medical.pending.map((m, i) => (
                            <div key={i} className="flex justify-between items-baseline text-[11px] border-b border-white/5 pb-1 last:border-0 last:pb-0">
                              <div className="flex flex-col">
                                <span className="text-slate-200 font-medium truncate max-w-[140px]">
                                  {new Date(m.start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                  {m.end ? ` - ${new Date(m.end).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}` : ' (Abierta)'}
                                </span>
                                {m.reason && <span className="text-[9px] text-slate-400 truncate max-w-[140px]">{m.reason}</span>}
                              </div>
                              <span className="text-amber-400 font-bold shrink-0">{m.days} {m.days === 1 ? 'd' : 'd'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Grid: Calendario y Detalle de Fichajes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado Izquierdo: Calendario (8/12) */}
        <div className="lg:col-span-7 bg-surface-dark border border-white/5 rounded-2xl p-5 flex flex-col h-fit">
          {/* Cabecera del Calendario */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg">Historial y Horarios</span>
              <span className="text-slate-400 text-xs mt-0.5">Navega y selecciona un día para ver fichajes</span>
            </div>
            
            <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/5">
              <button onClick={prevMonth} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <div className="px-3 flex flex-col items-center min-w-[100px]">
                <span className="text-sm font-semibold text-white">
                  {currentDate.toLocaleString('es-ES', { month: 'long' })}
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  {currentDate.getFullYear()}
                </span>
              </div>
              <button onClick={nextMonth} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Grid del Calendario */}
          <div className="grid grid-cols-7 gap-1 text-center font-semibold mb-2 text-slate-500 text-xs">
            <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, idx) => {
              if (cell.dayNumber === null) {
                return <div key={`empty-${idx}`} className="aspect-square bg-transparent rounded-lg" />;
              }

              const isSelected = formatDateString(cell.date!) === formatDateString(selectedDate);
              const isToday = formatDateString(cell.date!) === formatDateString(new Date());

              // Clases de fondo y borde según el estado
              let stateClasses = 'hover:bg-white/5 border-white/5';
              let dotClass = '';

              if (cell.status === 'completed') {
                stateClasses = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20';
                dotClass = 'bg-emerald-400';
              } else if (cell.status === 'incomplete') {
                stateClasses = 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20';
                dotClass = 'bg-amber-400';
              } else if (cell.status === 'absent') {
                stateClasses = 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20';
                dotClass = 'bg-red-400';
              } else if (cell.status === 'scheduled') {
                stateClasses = 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20';
                dotClass = 'bg-primary';
              }

              return (
                <button
                  key={`day-${cell.dayNumber}`}
                  onClick={() => {
                    if (cell.status === 'empty') {
                      handleOpenFastShiftModal(cell.date!);
                    } else {
                      setSelectedDate(cell.date!);
                    }
                  }}
                  className={`aspect-square rounded-xl border flex flex-col justify-between p-1.5 transition-all text-xs font-semibold relative ${stateClasses} ${
                    isSelected ? 'ring-2 ring-primary border-primary bg-primary/10' : ''
                  } ${isToday ? 'font-bold' : ''}`}
                >
                  <span className={`leading-none flex items-center justify-center rounded-full w-5 h-5 ${
                    isToday ? 'bg-white text-black' : isSelected ? 'text-primary' : 'text-slate-300'
                  }`}>
                    {cell.dayNumber}
                  </span>
                  
                  {/* Pequeño punto indicador de estado */}
                  {dotClass && (
                    <span className={`w-1.5 h-1.5 rounded-full mx-auto ${dotClass}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Leyenda del Calendario */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-6 pt-4 border-t border-white/5 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Turno Completado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Jornada Incompleta / Fichaje Pendiente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>Ausente sin fichajes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span>Turno Programado</span>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Turno y Gestión de Fichajes del Día Seleccionado (5/12) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Caja de Turno Planificado */}
          <div className="bg-surface-dark border border-white/5 rounded-2xl p-5">
            <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider text-slate-400">Turno Planificado</h3>
            {selectedDayShift ? (
              <div className="bg-black/20 border border-primary/20 rounded-xl p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Horario Teórico</p>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedDayShift.start_time} - {selectedDayShift.end_time}</p>
                  </div>
                </div>
                {selectedDayShift.notes && (
                  <div className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-help relative group" title={selectedDayShift.notes}>
                    <Info size={16} />
                    <span className="absolute bottom-full right-0 mb-2 w-48 bg-black border border-white/10 rounded-lg p-2 text-[10px] text-slate-300 hidden group-hover:block shadow-xl z-20">
                      {selectedDayShift.notes}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-black/10 border border-dashed border-white/10 rounded-xl p-4 text-center text-slate-500 text-xs">
                No hay ningún turno planificado para esta fecha.
              </div>
            )}
          </div>

          {/* Caja de Fichajes Reales */}
          <div className="bg-surface-dark border border-white/5 rounded-2xl p-5 flex-1 flex flex-col min-h-[300px]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider text-slate-400">Fichajes Reales</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button 
                onClick={handleOpenAddModal} 
                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} /> Registrar
              </button>
            </div>

            {selectedDayEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 border border-dashed border-white/5 rounded-xl bg-black/10">
                <Clock size={28} className="text-slate-600 mb-2" />
                <p className="text-xs font-semibold">No hay fichajes</p>
                <p className="text-[11px] text-slate-600 mt-1">Registra un fichaje manual en caso de olvido.</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[400px] pr-1">
                {selectedDayEntries.map((entry) => {
                  const type = entry.entry_type;
                  
                  // Detalle visual por tipo de fichaje
                  let typeConfig = {
                    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                    icon: <Play size={14} />
                  };

                  if (type === 'clock-out') {
                    typeConfig = {
                      bg: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
                      icon: <X size={14} />
                    };
                  } else if (type === 'break-start') {
                    typeConfig = {
                      bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                      icon: <Coffee size={14} />
                    };
                  } else if (type === 'others-out') {
                    typeConfig = {
                      bg: 'bg-pink-500/10 border-pink-500/20 text-pink-400',
                      icon: <FileText size={14} />
                    };
                  }

                  return (
                    <div key={entry.id} className="flex justify-between items-center p-3 bg-black/20 border border-white/5 rounded-xl hover:border-white/10 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${typeConfig.bg}`}>
                          {typeConfig.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{entry.entry_time}</p>
                          <p className="text-[11px] text-slate-500 capitalize">{entry.description || type}</p>
                        </div>
                      </div>

                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEditModal(entry)} 
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button 
                          onClick={() => handleOpenDeleteModal(entry)} 
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documentos del Empleado */}
      <div className="bg-surface-dark border border-white/5 rounded-2xl p-6">
        <div className="flex flex-col mb-6 gap-4">
          <div>
            <h3 className="text-white font-bold text-sm tracking-wider">Documentos</h3>
            <p className="text-xs text-slate-400 mt-1">Nóminas, contratos y certificados de retenciones</p>
          </div>
          
          <div className="flex justify-between items-center bg-black/20 p-1.5 rounded-xl border border-white/5">
             <div className="flex gap-1">
               {(['nomina', 'contrato', 'otro'] as const).map(tab => (
                 <button
                   key={tab}
                   onClick={() => setDocTab(tab)}
                   className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                     docTab === tab 
                       ? 'bg-white/10 text-white' 
                       : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                   }`}
                 >
                   {tab === 'nomina' ? 'Nóminas' : tab === 'contrato' ? 'Contrato' : 'Otros'}
                 </button>
               ))}
             </div>
             
             {(!employee.dni_nie || !employee.ss_number) ? (
                <div 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
                  title="Debes rellenar el DNI/NIE y el Número de la Seguridad Social para poder subir documentos"
                >
                  <Upload size={14} />
                  {docTab === 'nomina' ? 'Subir Nómina' : docTab === 'contrato' ? 'Subir Contrato' : 'Subir Documento'}
                </div>
              ) : (docTab === 'contrato' && documents.some(d => d.document_type === 'contrato')) ? (
                <div 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
                  title="El empleado ya tiene un contrato subido"
                >
                  <Upload size={14} />
                  Subir Contrato
                </div>
              ) : (
                <button 
                  onClick={() => {
                    setUploadDocType(docTab);
                    setUploadDocTitle('');
                    setUploadDocPeriod(getLocalDateString(new Date()).slice(0, 7));
                    setUploadDocFile(null);
                    setIsUploadDocModalOpen(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    isUploadingDoc 
                      ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                      : 'bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 hover:border-transparent shadow-lg shadow-primary/10'
                  }`}
                >
                  {isUploadingDoc ? (
                    <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {isUploadingDoc ? 'Subiendo...' : (docTab === 'nomina' ? 'Subir Nómina' : docTab === 'contrato' ? 'Subir Contrato' : 'Subir Documento')}
                </button>
              )}
          </div>
        </div>

        {documents.filter(d => d.document_type === docTab).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 border border-dashed border-white/10 rounded-xl gap-3">
             <span className="text-slate-500 text-sm">
                No hay {docTab === 'nomina' ? 'nóminas' : docTab === 'contrato' ? 'contratos' : 'otros documentos'} subidos para este empleado.
             </span>
             {(!employee.dni_nie || !employee.ss_number) && (
               <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2 rounded-lg flex items-center gap-2 text-left max-w-md">
                 <AlertTriangle size={16} className="shrink-0" />
                 <span>Faltan datos obligatorios (DNI o Seguridad Social). Completa su Información Personal para poder subir documentos.</span>
               </div>
             )}
          </div>
        ) : (
          <div className="space-y-2">
            {documents.filter(d => d.document_type === docTab).map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-xl hover:border-white/10 transition-colors group">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                       <FileIcon size={18} />
                    </div>
                    <div>
                       <p className="text-sm font-semibold text-white">{doc.title}</p>
                       <p className="text-xs text-slate-400 capitalize">
                          {doc.document_type} {doc.period ? `(${doc.period})` : ''} • {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                       </p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        try {
                           const url = await documentService.getDownloadUrl(doc.file_url);
                           setPreviewUrl(url);
                           setPreviewTitle(doc.title);
                           setIsPreviewModalOpen(true);
                        } catch (e) {
                           console.error(e);
                           alert("Error al abrir el visor.");
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Previsualizar"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                           const url = await documentService.getDownloadUrl(doc.file_url);
                           window.open(url, '_blank');
                        } catch (e) {
                           console.error(e);
                           alert("Error al obtener el enlace de descarga.");
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Descargar"
                    >
                      <Download size={16} />
                    </button>
                    {isAdminOrHr && (
                      <button 
                        onClick={async () => {
                          if (window.confirm("¿Estás seguro de eliminar este documento?")) {
                             try {
                               await documentService.deleteDocument(doc.id, doc.file_url);
                               if (profile && activeCompany && employee) {
                                 const empName = employee.full_name || employee.name || 'Empleado';
                                 const actionType = doc.document_type === 'nomina' ? 'payroll_deleted' : doc.document_type === 'contrato' ? 'contract_deleted' : 'document_deleted';
                                 const actionText = doc.document_type === 'nomina' ? `Eliminó la nómina de ${doc.period || ''} de ${empName}` : doc.document_type === 'contrato' ? `Eliminó el contrato de ${empName}` : `Eliminó un documento ("${doc.title}") de ${empName}`;
                                 await logService.logAction(
                                   activeCompany.id,
                                   profile.id,
                                   actionType,
                                   actionText,
                                   { employee_id: employee.id, employee_name: empName, document_title: doc.title }
                                 );
                               }
                               await loadDocuments();
                             } catch (e) {
                               console.error(e);
                               alert("Error al eliminar documento.");
                             }
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODALES DE GESTIÓN DE FICHAJES Y TURNOS */}
      
      {/* Modal Turno Rápido */}
      <AnimatePresence>
        {isFastShiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-dark border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Nuevo Turno Personalizado</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {fastShiftDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsFastShiftModalOpen(false)} className="text-slate-400 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={20} />
                </button>
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
                    onClick={() => setFastShiftIsSplit(prev => !prev)}
                    className={`w-9 h-5 rounded-full transition-all relative focus:outline-none ${fastShiftIsSplit ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all ${fastShiftIsSplit ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Horario */}
                <div className="space-y-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                  <div>
                    {fastShiftIsSplit && (
                      <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2 animate-fadeIn">Primer Tramo (Mañana)</span>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                          {fastShiftIsSplit ? "Entrada 1" : "Hora Entrada"}
                        </label>
                        <input
                          type="time"
                          value={fastShiftStart}
                          onChange={(e) => {
                            setFastShiftError(null);
                            setFastShiftStart(e.target.value);
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">
                          {fastShiftIsSplit ? "Salida 1" : "Hora Salida"}
                        </label>
                        <input
                          type="time"
                          value={fastShiftEnd}
                          onChange={(e) => {
                            setFastShiftError(null);
                            setFastShiftEnd(e.target.value);
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: fastShiftIsSplit ? '1fr' : '0fr',
                      transition: 'grid-template-rows 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms cubic-bezier(0.25, 1, 0.5, 1)',
                      opacity: fastShiftIsSplit ? 1 : 0,
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
                              value={fastShiftStart2}
                              onChange={(e) => {
                                setFastShiftError(null);
                                setFastShiftStart2(e.target.value);
                              }}
                              className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-white outline-none text-sm font-medium transition-all ${fastShiftError && fastShiftError.includes('segundo tramo') ? 'border-red-500 ring-1 ring-red-500/20' : 'border-white/10'
                                }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1 uppercase font-semibold">Salida 2</label>
                            <input
                              type="time"
                              value={fastShiftEnd2}
                              onChange={(e) => {
                                setFastShiftError(null);
                                setFastShiftEnd2(e.target.value);
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
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tiempo de Descanso (Break)</label>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          placeholder="Minutos..."
                          className="w-full pl-8 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 text-sm font-semibold"
                          value={fastShiftBreak || 0}
                          onChange={(e) => setFastShiftBreak(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                          ☕
                        </div>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-500 font-semibold">
                          min
                        </div>
                      </div>

                      <div className="flex gap-1">
                        {[5, 10, 30].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              const current = fastShiftBreak || 0;
                              setFastShiftBreak(current + mins);
                            }}
                            className="px-2.5 py-2 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-lg text-xs font-bold text-slate-300 transition-all active:scale-95"
                          >
                            +{mins}
                          </button>
                        ))}
                        {fastShiftBreak > 0 && (
                          <button
                            type="button"
                            onClick={() => setFastShiftBreak(0)}
                            className="px-2 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-all active:scale-95"
                            title="Quitar descanso"
                          >
                            Borrar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateRows: fastShiftBreak > 0 ? '1fr' : '0fr',
                      transition: 'grid-template-rows 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms cubic-bezier(0.25, 1, 0.5, 1)',
                      opacity: fastShiftBreak > 0 ? 1 : 0,
                    }}
                    className="overflow-hidden"
                  >
                    <div className="min-h-0">
                      <div className="space-y-2 bg-white/[0.01] border border-white/5 p-3.5 rounded-xl mt-3">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">¿Cómo computa el descanso?</span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setFastShiftBreakPaid(true)}
                            className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${fastShiftBreakPaid
                              ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-md'
                              : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-2 h-2 rounded-full ${fastShiftBreakPaid ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                              <span className={`text-xs font-bold ${fastShiftBreakPaid ? 'text-emerald-400' : 'text-slate-300'}`}>
                                Dentro (Pagado)
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 leading-tight">
                              El descanso computa como tiempo efectivo.
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFastShiftBreakPaid(false)}
                            className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${!fastShiftBreakPaid
                              ? 'bg-slate-500/10 border-white/20 ring-1 ring-white/10 shadow-md'
                              : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-2 h-2 rounded-full ${!fastShiftBreakPaid ? 'bg-amber-400' : 'bg-slate-500'}`} />
                              <span className={`text-xs font-bold ${!fastShiftBreakPaid ? 'text-white' : 'text-slate-300'}`}>
                                Fuera (No pagado)
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 leading-tight">
                              Se resta del total de horas de la jornada.
                            </span>
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
                        onClick={() => setFastShiftColor(c.key)}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${c.key} ${fastShiftColor === c.key
                          ? 'border-white scale-110 shadow-lg'
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
                      checked={fastShiftHasPlus}
                      onChange={(e) => setFastShiftHasPlus(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Contexto del Turno (Notas) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Contexto del Turno (Notas)</label>
                  <textarea
                    value={fastShiftNotes}
                    onChange={(e) => {
                      setFastShiftError(null);
                      setFastShiftNotes(e.target.value);
                    }}
                    placeholder="Ej: Cobertura por baja médica, refuerzo por evento..."
                    rows={2}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none text-sm font-medium resize-none placeholder:text-slate-600 transition-all ${fastShiftError && fastShiftError.includes('Notas')
                      ? 'border-red-500 ring-1 ring-red-500/20'
                      : 'border-white/10'
                      }`}
                  />
                </div>
              </div>

              {fastShiftError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-fadeIn mx-0.5 mt-4">
                  <span>⚠️</span>
                  <span className="font-semibold leading-tight">{fastShiftError}</span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 mt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsFastShiftModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveFastShift}
                  disabled={savingAction}
                  className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {savingAction ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Asignar Turno'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Modal: Registrar Fichaje */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !savingAction && setIsAddModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Registrar Fichaje Manual</h3>
                    <p className="text-xs text-slate-400 mt-1">Añade un registro olvidado para este trabajador.</p>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateEntry} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Tipo de Fichaje</label>
                    <CustomSelect
                      value={modalEntryType}
                      onChange={(val) => setModalEntryType(val)}
                      options={[
                        { value: "clock-in", label: "Entrada Trabajo (Clock-in)" },
                        { value: "clock-out", label: "Salida Trabajo (Clock-out)" },
                        { value: "break-start", label: "Inicio Descanso (Break-start)" },
                        { value: "break-end", label: "Fin Descanso (Break-end)" },
                        { value: "others-out", label: "Salida Permiso/Otros" },
                        { value: "others-in", label: "Retorno Permiso/Otros" }
                      ]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Hora</label>
                    <input 
                      type="time" 
                      required
                      className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                      value={modalTime}
                      onChange={e => setModalTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Notas / Descripción (Opcional)</label>
                    <textarea 
                      placeholder="Ej: Fichaje manual debido a olvido del trabajador"
                      className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none text-sm min-h-[80px] resize-none"
                      value={modalDescription}
                      onChange={e => setModalDescription(e.target.value)}
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 transition-colors text-sm"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={savingAction}
                      className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 min-w-[120px] flex justify-center text-sm"
                    >
                      {savingAction ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Registrar'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: Editar Fichaje */}
        {isEditModalOpen && selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !savingAction && setIsEditModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">Editar Fichaje</h3>
                    <p className="text-xs text-slate-400 mt-1">Corrige los datos del fichaje seleccionado.</p>
                  </div>
                  <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleUpdateEntry} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Tipo de Fichaje</label>
                    <CustomSelect
                      value={modalEntryType}
                      onChange={(val) => setModalEntryType(val)}
                      options={[
                        { value: "clock-in", label: "Entrada Trabajo (Clock-in)" },
                        { value: "clock-out", label: "Salida Trabajo (Clock-out)" },
                        { value: "break-start", label: "Inicio Descanso (Break-start)" },
                        { value: "break-end", label: "Fin Descanso (Break-end)" },
                        { value: "others-out", label: "Salida Permiso/Otros" },
                        { value: "others-in", label: "Retorno Permiso/Otros" }
                      ]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Hora</label>
                    <input 
                      type="time" 
                      required
                      className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                      value={modalTime}
                      onChange={e => setModalTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Notas / Descripción</label>
                    <textarea 
                      placeholder="Ej: Fichaje editado por el manager"
                      className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none text-sm min-h-[80px] resize-none"
                      value={modalDescription}
                      onChange={e => setModalDescription(e.target.value)}
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsEditModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 transition-colors text-sm"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={savingAction}
                      className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 min-w-[120px] flex justify-center text-sm"
                    >
                      {savingAction ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: Eliminar Fichaje */}
        {isDeleteModalOpen && selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !savingAction && setIsDeleteModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface-dark w-full max-w-sm rounded-2xl border border-red-500/30 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto border border-red-500/20">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">¿Eliminar este fichaje?</h3>
                <p className="text-slate-400 text-xs mb-6">
                  Estás a punto de eliminar el fichaje de las <strong>{selectedEntry.entry_time}</strong> ({selectedEntry.description || selectedEntry.entry_type}). Esta acción es irreversible.
                </p>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={savingAction}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 border border-white/10 transition-colors text-xs"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDeleteEntry}
                    disabled={savingAction}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition-all disabled:opacity-30 flex justify-center items-center gap-2 text-xs"
                  >
                    {savingAction ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Eliminar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Subir Documento */}
      <AnimatePresence>
        {isUploadDocModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-dark border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {uploadDocType === 'nomina' ? 'Subir Nómina' : uploadDocType === 'contrato' ? 'Subir Contrato' : 'Subir Documento'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-[250px] truncate">{uploadDocFile?.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsUploadDocModalOpen(false)} 
                  disabled={savingAction}
                  className="text-slate-400 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {uploadDocType === 'nomina' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold tracking-wider mt-4">
                      Mes de la Nómina
                    </label>
                    <input
                      type="month"
                      value={uploadDocPeriod}
                      onChange={(e) => setUploadDocPeriod(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                    />
                  </motion.div>
                )}

                {uploadDocType === 'otro' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold tracking-wider mt-4">
                      Nombre / Contexto del Documento
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Certificado de retenciones, Baja médica..."
                      value={uploadDocTitle}
                      onChange={(e) => setUploadDocTitle(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
                    />
                  </motion.div>
                )}

                <div 
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                       const file = e.dataTransfer.files[0];
                       if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                           setUploadDocFile(file);
                       } else {
                           alert('Solo se permiten archivos PDF');
                       }
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 mt-4 text-center transition-colors ${dragActive ? 'border-primary bg-primary/10' : 'border-white/10 hover:border-white/20'}`}
                >
                   <Upload size={24} className={`mx-auto mb-3 ${dragActive ? 'text-primary' : 'text-slate-400'}`} />
                   <p className="text-sm text-slate-300 font-semibold mb-1">
                      {uploadDocType === 'nomina' ? 'Sube la nómina' : uploadDocType === 'contrato' ? 'Sube el contrato' : 'Sube tu documento'}
                   </p>
                   <p className="text-xs text-slate-500 mb-4">Arrastra el archivo PDF aquí o haz clic para buscarlo</p>
                   <label className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors inline-block">
                     Seleccionar archivo
                     <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) setUploadDocFile(e.target.files[0]);
                     }} />
                   </label>
                   {uploadDocFile && (
                      <div className="mt-4 p-3 bg-black/40 rounded-lg flex items-center gap-3 border border-white/5 text-left max-w-sm mx-auto">
                         <FileIcon size={18} className="text-primary shrink-0" />
                         <span className="text-xs font-semibold text-white truncate flex-1">{uploadDocFile.name}</span>
                         <button onClick={(e) => { e.preventDefault(); setUploadDocFile(null); }} className="text-slate-400 hover:text-red-400">
                           <X size={14} />
                         </button>
                      </div>
                   )}
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsUploadDocModalOpen(false)}
                  disabled={savingAction}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingAction || !uploadDocFile || (uploadDocType === 'otro' && !uploadDocTitle.trim())}
                  onClick={async () => {
                    if (!uploadDocFile || !activeCompany || !employeeId) return;
                    setSavingAction(true);
                    
                    let finalTitle = uploadDocFile.name;
                    if (uploadDocType === 'nomina') finalTitle = `Nómina ${uploadDocPeriod}`;
                    if (uploadDocType === 'contrato') finalTitle = 'Contrato de Trabajo';
                    if (uploadDocType === 'otro') finalTitle = uploadDocTitle.trim() || finalTitle;

                    try {
                      await documentService.uploadDocument(
                        uploadDocFile, 
                        activeCompany.id, 
                        employeeId, 
                        uploadDocType, 
                        finalTitle, 
                        uploadDocType === 'nomina' ? uploadDocPeriod : undefined
                      );
                      if (profile && employee) {
                        const empName = employee.full_name || employee.name || 'Empleado';
                        const actionType = uploadDocType === 'nomina' ? 'payroll_added' : uploadDocType === 'contrato' ? 'contract_added' : 'document_added';
                        const actionText = uploadDocType === 'nomina' ? `Subió la nómina de ${uploadDocPeriod} para ${empName}` : uploadDocType === 'contrato' ? `Subió el contrato para ${empName}` : `Subió un documento ("${finalTitle}") para ${empName}`;
                        await logService.logAction(
                          activeCompany.id,
                          profile.id,
                          actionType,
                          actionText,
                          { employee_id: employee.id, employee_name: empName, document_title: finalTitle }
                        );
                      }
                      await loadDocuments();
                      setIsUploadDocModalOpen(false);
                    } catch (error) {
                      console.error(error);
                      alert("Error al subir documento");
                    } finally {
                      setSavingAction(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {savingAction ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                  ) : (
                    'Confirmar Subida'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visor de PDF */}
      <AnimatePresence>
        {isPreviewModalOpen && previewUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-dark border border-white/10 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                    <FileIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{previewTitle}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Visor Seguro de Documentos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Download size={14} />
                    Descargar
                  </button>
                  <button 
                    onClick={() => {
                      setIsPreviewModalOpen(false);
                      setPreviewUrl(null);
                    }} 
                    className="text-slate-400 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-slate-900">
                <iframe 
                  src={`${previewUrl}#toolbar=0&navpanes=0`} 
                  className="w-full h-full border-0"
                  title="Visor PDF"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default EmployeeDetail;
