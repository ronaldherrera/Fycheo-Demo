import type { Shift, Absence } from '../types';

/**
 * Función simplificada para calcular estadísticas básicas de un empleado
 * para la vista de equipos (resumen mensual).
 */
export const calculateBasicStats = (
  employeeId: string,
  shifts: Shift[],
  timeEntries: any[],
  absences: Absence[],
  monthStart: Date,
  monthEnd: Date
) => {
  // 1. Filtrar datos del empleado
  const empShifts = shifts.filter(s => s.employee_id === employeeId && s.status !== 'pending_deletion');
  const empEntries = timeEntries.filter(e => e.user_id === employeeId);
  
  // Agrupar fichajes por fecha local (YYYY-MM-DD)
  const entriesByDate: Record<string, any[]> = {};
  empEntries.forEach(entry => {
    const dStr = entry.occurred_at ? entry.occurred_at.split('T')[0] : entry.date;
    if (!entriesByDate[dStr]) entriesByDate[dStr] = [];
    entriesByDate[dStr].push(entry);
  });

  // Asegurar orden temporal de fichajes
  Object.keys(entriesByDate).forEach(dStr => {
    entriesByDate[dStr].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  });

  // --- A. ESTADO ACTUAL ---
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntries = entriesByDate[todayStr] || [];
  
  let state = { label: 'Fuera de turno', colorClass: 'text-slate-400', bgClass: 'bg-slate-400' };
  
  if (todayEntries.length > 0) {
    const lastEntry = todayEntries[todayEntries.length - 1];
    const type = lastEntry.entry_type;
    if (type === 'clock-in' || type === 'break-end' || type === 'others-in') {
      state = { label: 'Trabajando', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-400' };
    } else if (type === 'break-start') {
      state = { label: 'Descansando', colorClass: 'text-amber-400', bgClass: 'bg-amber-400' };
    } else if (type === 'others-out') {
      state = { label: 'Permiso', colorClass: 'text-pink-400', bgClass: 'bg-pink-400' };
    }
  }

  // --- B. BOLSA DE HORAS Y PUNTUALIDAD (MENSUAL) ---
  let plannedMinutes = 0;
  let realMinutes = 0;
  let onTimeShifts = 0;
  let totalEvaluatedShifts = 0;

  // Analizar turnos del mes
  empShifts.forEach(s => {
    // Calcular minutos planificados
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    plannedMinutes += diff;

    // Calcular puntualidad
    const dayEntries = entriesByDate[s.date] || [];
    const isPast = s.date < todayStr;
    const hasClockIn = dayEntries.some(e => e.entry_type === 'clock-in');

    if (isPast || hasClockIn) {
      totalEvaluatedShifts++;
      const firstIn = dayEntries.find(e => e.entry_type === 'clock-in');
      if (firstIn) {
        const inTime = new Date(firstIn.occurred_at);
        const plannedIn = new Date(`${s.date}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`);
        const diffMin = (inTime.getTime() - plannedIn.getTime()) / 1000 / 60;
        if (diffMin <= 10) {
          onTimeShifts++;
        }
      }
    }
  });

  // Calcular minutos reales trabajados
  Object.keys(entriesByDate).forEach(dStr => {
    const dayEntries = entriesByDate[dStr];
    let workingStart: Date | null = null;
    
    for (const e of dayEntries) {
      const type = e.entry_type;
      const time = new Date(e.occurred_at);

      if (type === 'clock-in' || type === 'break-end' || type === 'others-in') {
        if (!workingStart) workingStart = time;
      } else if (type === 'clock-out' || type === 'break-start' || type === 'others-out') {
        if (workingStart) {
          realMinutes += (time.getTime() - workingStart.getTime()) / 1000 / 60;
          workingStart = null;
        }
      }
    }

    // Si sigue trabajando hoy
    if (dStr === todayStr && workingStart) {
      realMinutes += (new Date().getTime() - workingStart.getTime()) / 1000 / 60;
    }
  });

  // Calcular impacto de bajas médicas en horas planificadas
  let medicalDays = 0;
  const empAbsences = absences.filter(a => a.employee_id === employeeId && a.status === 'approved');
  empAbsences.forEach(a => {
    if (a.type === 'medical') {
      const start = new Date(a.start_date);
      const end = a.end_date ? new Date(a.end_date) : new Date();
      // Simplificación: contar días superpuestos con el mes
      let curr = new Date(start);
      while (curr <= end && curr <= monthEnd) {
        if (curr >= monthStart) medicalDays++;
        curr.setDate(curr.getDate() + 1);
      }
    } else if (a.type === 'vacation' && a.end_date) { // Actualizar el estado si está de vacaciones
      const start = new Date(a.start_date);
      const end = new Date(a.end_date);
      const now = new Date();
      if (now >= start && now <= end && state.label === 'Fuera de turno') {
        state = { label: 'Vacaciones', colorClass: 'text-amber-400', bgClass: 'bg-amber-400' };
      }
    } else if (a.type === 'medical' && !a.end_date) {
      // Baja abierta
      if (state.label === 'Fuera de turno') {
        state = { label: 'Baja', colorClass: 'text-red-400', bgClass: 'bg-red-400' };
      }
    }
  });

  const netPlannedMinutes = Math.max(0, plannedMinutes - (medicalDays * 8 * 60));
  const totalMinutes = Math.round(realMinutes - netPlannedMinutes);
  
  const isPositive = totalMinutes >= 0;
  const absMins = Math.abs(totalMinutes);
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  const hoursFormatted = `${isPositive ? '+' : '-'}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const punctuality = totalEvaluatedShifts > 0 ? Math.round((onTimeShifts / totalEvaluatedShifts) * 100) : 100;
  let punctualityColor = 'text-emerald-400';
  if (punctuality < 90) punctualityColor = 'text-amber-400';
  if (punctuality < 75) punctualityColor = 'text-red-400';

  return {
    state,
    totalMinutes,
    hoursFormatted,
    punctuality,
    punctualityColor
  };
};
