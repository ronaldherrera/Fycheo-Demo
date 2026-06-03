import { adjustDataToCurrentDate, deAdjustISOString, deAdjustDateString } from '../../lib/date-adjuster';
import { supabase } from './supabase';

export interface DashboardFilters {
  scope: 'org' | 'team' | 'employee';
  targetId?: string; // team_id or employee_id
  date: string; // YYYY-MM-DD
}

export const dashboardService = {
  async getDashboardData(companyId: string, filters: DashboardFilters) {
    if (!companyId) throw new Error('No company ID');

    // 1. Obtener miembros filtrados de company_members
    let query = supabase
      .from('company_members')
      .select(`
        user_id,
        role,
        team_id,
        profiles:user_id (
          id,
          full_name,
          email,
          avatar
        )
      `)
      .eq('company_id', companyId);

    if (filters.scope === 'team' && filters.targetId) {
      query = query.eq('team_id', filters.targetId);
    } else if (filters.scope === 'employee' && filters.targetId) {
      query = query.eq('user_id', filters.targetId);
    }

    const { data: members, error: membersError } = await query;
    if (membersError) throw membersError;

    // Aplanar para mantener compatibilidad con el resto del servicio de dashboard
    const profiles = (members || []).map((m: any) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        id: m.user_id,
        full_name: prof?.full_name || '',
        email: prof?.email || '',
        avatar_url: prof?.avatar || null, // Mapeamos avatar a avatar_url para compatibilidad
        role: m.role,
        team_id: m.team_id
      };
    });

    const employeeIds = profiles.map(p => p.id);
    const totalEmployees = employeeIds.length;

    if (totalEmployees === 0) {
      return this._getEmptyDashboard();
    }

    // 2. Tipos de jornada de la empresa (para deducir nombre del turno)
    const { data: companyData } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', companyId)
      .single();

    const shiftTypes: any[] = companyData?.settings?.shift_types || [];
    const getShiftTypeName = (color: string | null, startTime: string | null, endTime: string | null): string | null => {
      if (!color && !startTime) return null;
      const match = shiftTypes.find(st =>
        st.color === color &&
        (st.start === startTime || st.start_time === startTime) &&
        (st.end === endTime || st.end_time === endTime)
      ) || shiftTypes.find(st =>
        // fallback: solo color
        st.color === color
      );
      return match?.name || null;
    };

    // 3. Fichajes del día seleccionado
    const targetDate = filters.date;
    // Convertir la fecha UI al equivalente en la BD (los datos de demo tienen offset)
    const dbTargetDate = deAdjustDateString(targetDate);
    const { data: rawDayShifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('company_id', companyId)
      .eq('date', dbTargetDate)
      .in('employee_id', employeeIds);
    const dayShifts = adjustDataToCurrentDate(rawDayShifts);

    // 3. Alertas / Pendientes (Ausencias sin aprobar detalladas)
    const { data: rawPendingAbsences } = await supabase
      .from('absences')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .in('employee_id', employeeIds);
    const pendingAbsences = adjustDataToCurrentDate(rawPendingAbsences);

    const alertsList = pendingAbsences?.map(abs => {
      const emp = profiles?.find(p => p.id === abs.employee_id);
      return {
        id: abs.id,
        employeeName: emp?.full_name || emp?.email?.split('@')[0] || 'Desconocido',
        avatar_url: emp?.avatar_url,
        type: abs.type,
        startDate: abs.start_date,
        endDate: abs.end_date
      };
    }) || [];

    // 3.5 Solicitudes de Fichaje (time_entries)
    const { data: rawPendingTimeEntries } = await supabase
      .from('time_entries')
      .select('id, user_id, entry_type, occurred_at')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .in('user_id', employeeIds);
    const pendingTimeEntries = adjustDataToCurrentDate(rawPendingTimeEntries);

    const pendingTimeRequests = pendingTimeEntries?.map(entry => {
      const emp = profiles?.find(p => p.id === entry.user_id);
      return {
        id: entry.id,
        employeeName: emp?.full_name || emp?.email?.split('@')[0] || 'Desconocido',
        avatar_url: emp?.avatar_url,
        type: entry.entry_type,
        date: entry.occurred_at
      };
    }) || [];

    // 4. Ausencias en el día seleccionado
    const { count: absencesToday } = await supabase
      .from('absences')
      .select('id', { count: 'exact' })
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .in('employee_id', employeeIds)
      .lte('start_date', dbTargetDate)
      .gte('end_date', dbTargetDate);

    // 5. Empleados Presentes (basado en fichajes reales de hoy)
    const todayStartLocal = new Date(`${targetDate}T00:00:00`);
    const todayEndLocal = new Date(`${targetDate}T23:59:59.999`);
    const todayStart = todayStartLocal.toISOString();
    const todayEnd = todayEndLocal.toISOString();
    // Desajustar a fechas de la BD para la consulta
    const dbTodayStart = deAdjustISOString(todayStart);
    const dbTodayEnd = deAdjustISOString(todayEnd);
    const { data: rawTodayEntries } = await supabase
      .from('time_entries')
      .select('id, user_id, entry_type, occurred_at, status')
      .in('user_id', employeeIds)
      .gte('occurred_at', dbTodayStart)
      .lte('occurred_at', dbTodayEnd)
      .order('occurred_at', { ascending: true });
    const todayEntries = adjustDataToCurrentDate(rawTodayEntries);

    // Agrupar por empleado y determinar su estado actual
    const entriesByEmployee: Record<string, any[]> = {};
    (todayEntries || []).forEach(entry => {
      if (!entriesByEmployee[entry.user_id]) entriesByEmployee[entry.user_id] = [];
      entriesByEmployee[entry.user_id].push(entry);
    });

    const workingTypes = new Set(['clock-in', 'break-end', 'others-in']);
    const presentEmployees: any[] = [];

    Object.entries(entriesByEmployee).forEach(([userId, entries]) => {
      // Ordenar por tiempo (ya viene ordenado, pero por seguridad)
      entries.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
      const lastEntry = entries[entries.length - 1];
      if (lastEntry && workingTypes.has(lastEntry.entry_type)) {
        const emp = profiles?.find(p => p.id === userId);
        // Buscar la hora del primer clock-in del día
        const firstClockIn = entries.find(e => e.entry_type === 'clock-in');
        const startTime = firstClockIn
          ? new Date(firstClockIn.occurred_at).toTimeString().substring(0, 5)
          : new Date(lastEntry.occurred_at).toTimeString().substring(0, 5);
        presentEmployees.push({
          id: userId,
          employeeName: emp?.full_name || emp?.email?.split('@')[0] || 'Desconocido',
          role: emp?.role || 'Empleado',
          avatar_url: emp?.avatar_url,
          startTime,
          status: 'Trabajando'
        });
      }
    });

    // 6. Tendencia 7 días — usar time_entries por fecha (campo occurred_at)
    const startDateObj = new Date(targetDate);
    startDateObj.setDate(startDateObj.getDate() - 6);
    const sevenDaysAgoStart = new Date(`${startDateObj.toISOString().split('T')[0]}T00:00:00`).toISOString();
    const dbSevenDaysAgoStart = deAdjustISOString(sevenDaysAgoStart);

    const { data: rawRecentEntries } = await supabase
      .from('time_entries')
      .select('occurred_at, user_id')
      .in('user_id', employeeIds)
      .gte('occurred_at', dbSevenDaysAgoStart)
      .lte('occurred_at', dbTodayEnd);
    const recentEntries = adjustDataToCurrentDate(rawRecentEntries);

    // Agrupar por día y contar empleados únicos que ficharon (clock-in)
    const activityMap: Record<string, Set<string>> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      activityMap[dateStr] = new Set();
    }

    recentEntries?.forEach(entry => {
      if (!entry.occurred_at) return;
      const dateStr = new Date(entry.occurred_at).toLocaleDateString('en-CA'); // YYYY-MM-DD en local
      if (activityMap[dateStr] !== undefined) {
        activityMap[dateStr].add(entry.user_id);
      }
    });

    const chartData = Object.keys(activityMap).map(dateStr => {
      const [, m, d] = dateStr.split('-');
      return {
        name: `${d}/${m}`,
        fichajes: activityMap[dateStr].size
      };
    });

    // 7. Timeline 24h — basado en time_entries de hoy
    const timeline24h = new Array(24).fill(0);
    (todayEntries || []).forEach(entry => {
      if (!entry.occurred_at) return;
      const hour = new Date(entry.occurred_at).getHours();
      if (hour >= 0 && hour < 24) timeline24h[hour]++;
    });

    // 8. Fichajes del día (empleados únicos que tienen al menos un clock-in hoy)
    const uniqueClockInsToday = new Set(
      (todayEntries || [])
        .filter(e => e.entry_type === 'clock-in')
        .map(e => e.user_id)
    );
    const shiftsToday = uniqueClockInsToday.size;

    // 9. Horas reales trabajadas hoy (reconstrucción de sesión por empleado)
    let actualHours = 0;
    Object.values(entriesByEmployee).forEach(entries => {
      let workingStart: Date | null = null;
      for (const e of entries) {
        const t = e.entry_type;
        const time = new Date(e.occurred_at);
        if (t === 'clock-in' || t === 'break-end' || t === 'others-in') {
          if (!workingStart) workingStart = time;
        } else if (t === 'clock-out' || t === 'break-start' || t === 'others-out') {
          if (workingStart) {
            actualHours += (time.getTime() - workingStart.getTime()) / 1000 / 3600;
            workingStart = null;
          }
        }
      }
      // Si aún está trabajando (turno abierto), contar hasta ahora
      if (workingStart) {
        actualHours += (new Date().getTime() - workingStart.getTime()) / 1000 / 3600;
      }
    });

    // 10. Horas programadas (turnos planificados del día — shifts sigue siendo la fuente correcta)
    let scheduledHours = 0;
    dayShifts?.forEach(shift => {
      if (shift.start_time && shift.end_time) {
        const [h1, m1] = shift.start_time.split(':').map(Number);
        const [h2, m2] = shift.end_time.split(':').map(Number);
        let duration = (h2 - h1) + (m2 - m1) / 60;
        if (duration < 0) duration += 24;
        scheduledHours += duration;
      }
    });

    // 11. Timelines por empleado para la vista Gantt del día
    const isToday = targetDate === new Date().toLocaleDateString('en-CA');
    const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : 24 * 60;

    const combinedTimelinesMap: Record<string, any> = {};

    // 11.1 Añadir programados
    dayShifts?.forEach(shift => {
      const emp = profiles?.find(p => p.id === shift.employee_id);
      if (!emp) return;
      
      let scheduledStartMin = null;
      let scheduledEndMin = null;
      
      if (shift.start_time && shift.end_time) {
        const [h1, m1] = shift.start_time.split(':').map(Number);
        const [h2, m2] = shift.end_time.split(':').map(Number);
        scheduledStartMin = h1 * 60 + m1;
        scheduledEndMin = h2 * 60 + m2;
        if (scheduledEndMin < scheduledStartMin) scheduledEndMin += 24 * 60; // cruza medianoche
      }

      const nameMatch = (shift.notes || '').match(/^\[([^\]]+)\]/);
      const shiftName = nameMatch ? nameMatch[1] : getShiftTypeName(shift.color, shift.start_time, shift.end_time);
      const scheduledEntry = scheduledStartMin !== null ? {
        startMin: scheduledStartMin,
        endMin: scheduledEndMin,
        color: shift.color || shift.bg_color || '#1e293b',
        name: shiftName,
      } : null;

      if (combinedTimelinesMap[shift.employee_id]) {
        // Segundo turno del mismo empleado → jornada partida
        const existing = combinedTimelinesMap[shift.employee_id];
        existing.isPartida = true;
        existing.scheduled2 = scheduledEntry;
      } else {
        combinedTimelinesMap[shift.employee_id] = {
          userId: shift.employee_id,
          name: emp.full_name || emp.email?.split('@')[0] || 'Desconocido',
          avatar_url: emp.avatar_url,
          scheduled: scheduledEntry,
          scheduled2: null,
          isPartida: false,
          segments: [],
          firstTime: null,
          lastTime: null,
          isStillIn: false
        };
      }
    });

    // 11.2 Añadir fichajes
    Object.entries(entriesByEmployee).forEach(([userId, entries]) => {
      if (!combinedTimelinesMap[userId]) {
        const emp = profiles?.find(p => p.id === userId);
        combinedTimelinesMap[userId] = {
          userId,
          name: emp?.full_name || emp?.email?.split('@')[0] || 'Desconocido',
          avatar_url: emp?.avatar_url,
          scheduled: null,
          segments: [],
          firstTime: null,
          lastTime: null,
          isStillIn: false
        };
      }

      const tObj = combinedTimelinesMap[userId];
      
      let segStart: number | null = null;
      let segType: 'working' | 'break' | 'others' = 'working';

      for (const e of entries) {
        const t = e.entry_type;
        const d = new Date(e.occurred_at);
        const mins = d.getHours() * 60 + d.getMinutes();

        if (t === 'clock-in') {
          if (segStart !== null) {
            tObj.segments.push({ startMin: segStart, endMin: mins, type: segType });
          }
          segStart = mins;
          segType = 'working';
        } else if (t === 'break-end') {
          if (segStart !== null) {
            tObj.segments.push({ startMin: segStart, endMin: mins, type: segType });
          }
          segStart = mins;
          segType = 'working';
        } else if (t === 'others-in') {
          if (segStart !== null) {
            tObj.segments.push({ startMin: segStart, endMin: mins, type: segType });
          }
          segStart = mins;
          segType = 'working';
        } else if (t === 'break-start' && segStart !== null) {
          tObj.segments.push({ startMin: segStart, endMin: mins, type: segType });
          segStart = mins;
          segType = 'break';
        } else if (t === 'others-out' && segStart !== null) {
          tObj.segments.push({ startMin: segStart, endMin: mins, type: segType });
          segStart = mins;
          segType = 'others';
        } else if (t === 'clock-out' && segStart !== null) {
          tObj.segments.push({ startMin: segStart, endMin: mins, type: segType });
          segStart = null;
        }
      }

      // Segmento abierto (sigue en ese estado)
      if (segStart !== null) {
        tObj.segments.push({ startMin: segStart, endMin: nowMinutes, type: segType });
      }

      if (entries.length > 0) {
        const firstEntry = entries[0];
        const lastEntry = entries[entries.length - 1];
        tObj.firstTime = new Date(firstEntry.occurred_at).toTimeString().substring(0, 5);
        tObj.lastTime = new Date(lastEntry.occurred_at).toTimeString().substring(0, 5);
        tObj.isStillIn = segStart !== null;
      }
    });

    const employeeTimelines = Object.values(combinedTimelinesMap);

    return {
      totalEmployees,
      shiftsToday,
      absencesToday: absencesToday || 0,
      pendingAlerts: alertsList.length,
      alertsList,
      pendingTimeRequests,
      presentEmployees,
      chartData,
      timeline24h,
      employeeTimelines,
      scheduledVsActual: {
        scheduled: Math.round(scheduledHours),
        actual: Math.round(actualHours)
      },
      todayEntries: todayEntries || [],
      profiles
    };
  },

  _getEmptyDashboard() {
    return {
      totalEmployees: 0,
      shiftsToday: 0,
      absencesToday: 0,
      pendingAlerts: 0,
      alertsList: [],
      pendingTimeRequests: [],
      presentEmployees: [],
      chartData: [],
      timeline24h: new Array(24).fill(0),
      employeeTimelines: [],
      scheduledVsActual: { scheduled: 0, actual: 0 },
      todayEntries: [],
      profiles: []
    };
  },

  async updateTimeRequestStatus(id: string, status: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('time_entries')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  }
};
