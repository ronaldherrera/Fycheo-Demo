import { supabase } from './supabase';
import { logService } from './logService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportService = {
  /**
   * Genera y descarga un archivo CSV personalizado
   */
  async downloadCustomCSV(data: any[], selectedColumns: string[], filename: string, companyId: string, managerId: string, reportType: string) {
    if (data.length === 0) {
      throw new Error('No hay datos para exportar.');
    }

    // Filtrar data por columnas seleccionadas
    const filteredData = data.map(row => {
      const newRow: any = {};
      selectedColumns.forEach(col => {
        if (row.hasOwnProperty(col)) {
          newRow[col] = row[col];
        }
      });
      return newRow;
    });

    const headers = selectedColumns;
    const csvContent = [
      headers.join(','), // Header row
      ...filteredData.map(row => 
        headers.map(header => {
          let cell = row[header] === null || row[header] === undefined ? '' : row[header];
          // Escape quotes and wrap in quotes if there's a comma
          cell = cell.toString().replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) {
            cell = `"${cell}"`;
          }
          return cell;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Registrar auditoría
    await logService.logAction(
      companyId,
      managerId,
      'export_generated',
      `Exportó un informe personalizado de tipo: ${reportType} (CSV)`,
      { type: reportType, count: filteredData.length, columns: selectedColumns, format: 'csv' }
    );
  },

  /**
   * Dibuja un gráfico de barras vectorial nativo usando jsPDF
   */
  _drawBarChart(doc: any, x: number, y: number, width: number, height: number, dataMap: Record<string, number>, title: string) {
    const keys = Object.keys(dataMap);
    const values = Object.values(dataMap);
    if (keys.length === 0) return;

    const maxVal = Math.max(...values, 1);
    
    // Fondo y título
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, width, height, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), x + 6, y + 8);

    // Área del gráfico
    const chartX = x + 12;
    const chartY = y + 15;
    const chartWidth = width - 20;
    const chartHeight = height - 25;

    // Líneas de cuadrícula horizontales
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const lineY = chartY + chartHeight - (i * (chartHeight / 4));
      doc.line(chartX, lineY, chartX + chartWidth, lineY);
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "normal");
      doc.text(Math.round((i * maxVal) / 4).toString(), chartX - 2, lineY + 2, { align: 'right' });
    }

    // Dibujar barras
    const maxBarWidth = 15;
    const barWidth = Math.min((chartWidth / keys.length) * 0.5, maxBarWidth);
    const gap = (chartWidth - (barWidth * keys.length)) / (keys.length + 1);

    for (let i = 0; i < keys.length; i++) {
      const val = values[i];
      const barHeight = (val / maxVal) * chartHeight;
      const barX = chartX + gap + (i * (barWidth + gap));
      const barY = chartY + chartHeight - barHeight;

      // Color esmeralda corporativo
      doc.setFillColor(16, 185, 129);
      if (barHeight > 0) {
        doc.rect(barX, barY, barWidth, barHeight, 'F');
      }

      // Etiqueta del eje X truncada
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      const rawLabel = keys[i];
      const label = rawLabel.length > 8 ? rawLabel.substring(0, 7) + '..' : rawLabel;
      // Centrar texto bajo la barra
      doc.text(label, barX + (barWidth / 2), chartY + chartHeight + 4, { align: 'center' });
      // Mostrar valor encima de la barra
      if (barHeight > 0) {
        doc.text(val.toString(), barX + (barWidth / 2), barY - 2, { align: 'center' });
      }
    }
  },

  /**
   * Construye el documento PDF internamente
   */
  /**
   * Construye el documento PDF internamente
   */
  _buildCustomPDF(data: any[], selectedColumns: string[], reportType: string, periodStart: Date, periodEnd: Date, companyName: string = 'Nuestra Empresa') {
    if (data.length === 0) {
      throw new Error('No hay datos para exportar.');
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Configuración de colores corporativos
    const darkBg: [number, number, number] = [15, 23, 42]; // slate-900

    // 1. Cabecera Corporativa (Banda Oscura)
    doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
    doc.rect(0, 0, 210, 40, 'F');

    // Logo / Nombre App
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("FYCHEO", 14, 25);

    // Título del Documento
    let title = 'Reporte Oficial';
    if (reportType === 'shifts') title = 'Registro de Fichajes';
    if (reportType === 'schedule') title = 'Cuadrante de Turnos';
    if (reportType === 'absences') title = 'Registro de Ausencias';
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 200);
    doc.text(title.toUpperCase(), 210 - 14, 25, { align: 'right' });

    // 2. Bloque de Resumen e Información de Empresa
    doc.setTextColor(darkBg[0], darkBg[1], darkBg[2]);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(companyName.toUpperCase(), 14, 52);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    const startStr = periodStart.toLocaleDateString();
    const endStr = periodEnd.toLocaleDateString();
    doc.text(`Periodo analizado: ${startStr} al ${endStr}`, 14, 58);
    doc.text(`Total de registros: ${data.length}`, 14, 63);
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 68);
    doc.text(`Ref: DOC-${Math.random().toString(36).substr(2, 8).toUpperCase()}`, 14, 73);

    // 3. Procesar datos para KPIs y Gráficos
    let metric1Title = "Total Registros";
    let metric1Value = data.length.toString();
    let metric2Title = "-";
    let metric2Value = "-";
    let chartTitle = "Distribución de Registros";
    let chartData: Record<string, number> = {};

    if (reportType === 'shifts' || reportType === 'schedule') {
      metric2Title = "Media Hrs/Turno";
      let totalSeconds = 0;
      data.forEach(row => {
        // Agrupar por empleado
        const emp = row['empleado'] || row['email'] || 'Desconocido';
        const empName = typeof emp === 'string' ? emp.split('@')[0] : 'Emp';
        chartData[empName] = (chartData[empName] || 0) + 1;

        // Calcular duración
        if (row['inicio'] && row['fin']) {
           const [h1, m1] = String(row['inicio']).split(':').map(Number);
           const [h2, m2] = String(row['fin']).split(':').map(Number);
           if (!isNaN(h1) && !isNaN(h2)) {
             let dH = h2 - h1;
             let dM = m2 - m1;
             if (dH < 0) dH += 24;
             totalSeconds += (dH * 3600) + (dM * 60);
           }
        }
      });
      if (data.length > 0 && totalSeconds > 0) {
        const avgHrs = (totalSeconds / data.length) / 3600;
        metric2Value = avgHrs.toFixed(1) + " h";
      }
      chartTitle = reportType === 'shifts' ? "Fichajes por Empleado (Top 10)" : "Turnos por Empleado (Top 10)";
      
      // Ordenar y coger top 10 para que quepa en el gráfico
      const sortedEntries = Object.entries(chartData).sort((a, b) => b[1] - a[1]).slice(0, 10);
      chartData = Object.fromEntries(sortedEntries);

    } else if (reportType === 'absences') {
      metric2Title = "Tipos Únicos";
      const types = new Set();
      data.forEach(row => {
        const type = row['tipo'] || 'Desconocido';
        types.add(type);
        chartData[String(type)] = (chartData[String(type)] || 0) + 1;
      });
      metric2Value = types.size.toString();
      chartTitle = "Ausencias por Tipo";
    }

    // Dibujar KPIs
    const kpiY = 82;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, kpiY, 88, 20, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(metric1Title.toUpperCase(), 18, kpiY + 6);
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(metric1Value, 18, kpiY + 15);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, kpiY, 88, 20, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(metric2Title.toUpperCase(), 112, kpiY + 6);
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(metric2Value, 112, kpiY + 15);

    // Dibujar Gráfico
    const chartY = kpiY + 25;
    this._drawBarChart(doc, 14, chartY, 182, 55, chartData, chartTitle);

    // 4. Formatear datos para autotable
    const headers = selectedColumns;
    const rows = data.map(row => {
      return headers.map(header => {
        return row[header] === null || row[header] === undefined ? '' : row[header].toString();
      });
    });

    // 5. Dibujar tabla (empieza debajo del dashboard)
    autoTable(doc, {
      head: [headers.map(h => h.replace('_', ' ').toUpperCase())],
      body: rows,
      startY: 170,
      styles: {
        fontSize: 7.5,
        cellPadding: 4,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: darkBg,
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    });

    // 5. Pie de página y Numeración
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${pageCount}`,
        210 / 2,
        297 - 12,
        { align: 'center' }
      );
      doc.text(
        'Documento generado automáticamente por Fycheo - Gestión Integral de RRHH',
        210 / 2,
        297 - 7,
        { align: 'center' }
      );
    }

    return doc;
  },

  /**
   * Genera y descarga un archivo PDF corporativo
   */
  async downloadCustomPDF(data: any[], selectedColumns: string[], filename: string, companyId: string, managerId: string, reportType: string, periodStart: Date, periodEnd: Date, companyName: string) {
    const doc = this._buildCustomPDF(data, selectedColumns, reportType, periodStart, periodEnd, companyName);
    
    // 5. Descargar
    doc.save(`${filename}.pdf`);

    // 6. Registro de auditoría
    await logService.logAction(
      companyId,
      managerId,
      'export_generated',
      `Exportó un informe personalizado de tipo: ${reportType} (PDF)`,
      { type: reportType, count: data.length, columns: selectedColumns, format: 'pdf' }
    );
  },

  /**
   * Genera una URL Blob de previsualización del PDF en memoria
   */
  getCustomPDFPreviewUrl(data: any[], selectedColumns: string[], reportType: string, periodStart: Date, periodEnd: Date, companyName: string): string {
    const doc = this._buildCustomPDF(data, selectedColumns, reportType, periodStart, periodEnd, companyName);
    return doc.output('bloburl').toString();
  },

  /**
   * Extrae datos de fichajes (sin descargarlos)
   */
  async fetchTimeEntriesData(companyId: string, startDate: Date, endDate: Date, teamIdFilter: string | null, employeeIdFilter: string | null) {
    // 1. Obtener empleados de la empresa (filtrando por equipo si es necesario)
    let memberQuery = supabase
      .from('company_members')
      .select('user_id, team_id')
      .eq('company_id', companyId)
      .eq('role', 'employee');
      
    if (teamIdFilter && teamIdFilter !== 'all') {
      memberQuery = memberQuery.eq('team_id', teamIdFilter);
    }
    if (employeeIdFilter && employeeIdFilter !== 'all') {
      memberQuery = memberQuery.eq('user_id', employeeIdFilter);
    }

    const { data: members, error: memError } = await memberQuery;
    if (memError) throw memError;
    
    const employeeIds = members?.map(m => m.user_id) || [];
    if (employeeIds.length === 0) return [];

    const memberTeamMap = (members || []).reduce((acc: any, m: any) => {
      acc[m.user_id] = m.team_id;
      return acc;
    }, {});

    // 2. Obtener perfiles
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', employeeIds);
      
    if (profError) throw profError;
    
    const profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p;
      return acc;
    }, {});

    // 3. Obtener equipos para los nombres de equipos
    const { data: teams } = await supabase.from('teams').select('id, name').eq('company_id', companyId);
    const teamMap = (teams || []).reduce((acc: any, t: any) => {
      acc[t.id] = t.name;
      return acc;
    }, {});

    // 4. Obtener fichajes
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { data: timeEntries, error: teError } = await supabase
      .from('time_entries')
      .select('*')
      .in('user_id', employeeIds)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: false })
      .order('entry_time', { ascending: true });

    if (teError) throw teError;

    // 5. Formatear
    return (timeEntries || []).map(entry => {
      const profile = profileMap[entry.user_id];
      const teamId = memberTeamMap[entry.user_id];
      return {
        Empleado: profile?.full_name || 'Desconocido',
        Email: profile?.email || '',
        Equipo: teamId ? (teamMap[teamId] || 'Sin Equipo') : 'Sin Equipo',
        Fecha: entry.date,
        Hora: entry.entry_time,
        Tipo: this.translateEntryType(entry.entry_type),
        Descripción: entry.description || '',
        Método: entry.is_manual ? 'Manual' : 'Dispositivo',
        Ubicación: (entry.latitude != null && entry.longitude != null)
          ? `${entry.latitude}, ${entry.longitude}`
          : 'No disponible',
        Minutos: entry.minutes || 0
      };
    });
  },

  /**
   * Extrae cuadrante de turnos
   */
  async fetchShiftsData(companyId: string, startDate: Date, endDate: Date, teamIdFilter: string | null, employeeIdFilter: string | null) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    let query = supabase
      .from('shifts')
      .select('*')
      .eq('company_id', companyId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true });

    const { data: shifts, error } = await query;
    if (error) throw error;

    const employeeIds = [...new Set((shifts || []).map(s => s.employee_id))];
    if (employeeIds.length === 0) return [];

    let memberQuery = supabase
      .from('company_members')
      .select('user_id, team_id')
      .eq('company_id', companyId)
      .in('user_id', employeeIds);

    if (teamIdFilter && teamIdFilter !== 'all') {
      memberQuery = memberQuery.eq('team_id', teamIdFilter);
    }
    if (employeeIdFilter && employeeIdFilter !== 'all') {
      memberQuery = memberQuery.eq('user_id', employeeIdFilter);
    }

    const { data: members } = await memberQuery;
    const allowedIds = new Set((members || []).map(m => m.user_id));
    const memberTeamMap = (members || []).reduce((acc: any, m: any) => {
      acc[m.user_id] = m.team_id;
      return acc;
    }, {});
    
    // Filtrar shifts por allowedIds
    const filteredShifts = (shifts || []).filter(s => allowedIds.has(s.employee_id));

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(allowedIds));

    const profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const { data: teams } = await supabase.from('teams').select('id, name').eq('company_id', companyId);
    const teamMap = (teams || []).reduce((acc: any, t: any) => {
      acc[t.id] = t.name;
      return acc;
    }, {});

    return filteredShifts.map(shift => {
      const profile = profileMap[shift.employee_id];
      const teamId = memberTeamMap[shift.employee_id];
      return {
        Empleado: profile?.full_name || 'Desconocido',
        Email: profile?.email || '',
        Equipo: teamId ? (teamMap[teamId] || 'Sin Equipo') : 'Sin Equipo',
        Fecha: shift.date,
        Inicio: shift.start_time,
        Fin: shift.end_time,
        Estado: shift.status,
        Publicado: shift.is_published ? 'Sí' : 'No',
        Horas_Extra: shift.overtime || 0,
        Notas: shift.notes || ''
      };
    });
  },

  /**
   * Extrae ausencias
   */
  async fetchAbsencesData(companyId: string, startDate: Date, endDate: Date, teamIdFilter: string | null, employeeIdFilter: string | null) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { data: absences, error } = await supabase
      .from('absences')
      .select('*')
      .eq('company_id', companyId)
      .lte('start_date', endStr)
      .gte('end_date', startStr)
      .order('start_date', { ascending: false });

    if (error) throw error;

    const employeeIds = [...new Set((absences || []).map(s => s.employee_id))];
    if (employeeIds.length === 0) return [];

    let memberQuery = supabase
      .from('company_members')
      .select('user_id, team_id')
      .eq('company_id', companyId)
      .in('user_id', employeeIds);

    if (teamIdFilter && teamIdFilter !== 'all') {
      memberQuery = memberQuery.eq('team_id', teamIdFilter);
    }
    if (employeeIdFilter && employeeIdFilter !== 'all') {
      memberQuery = memberQuery.eq('user_id', employeeIdFilter);
    }

    const { data: members } = await memberQuery;
    const allowedIds = new Set((members || []).map(m => m.user_id));
    const memberTeamMap = (members || []).reduce((acc: any, m: any) => {
      acc[m.user_id] = m.team_id;
      return acc;
    }, {});
    
    const filteredAbsences = (absences || []).filter(a => allowedIds.has(a.employee_id));

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(allowedIds));

    const profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const { data: teams } = await supabase.from('teams').select('id, name').eq('company_id', companyId);
    const teamMap = (teams || []).reduce((acc: any, t: any) => {
      acc[t.id] = t.name;
      return acc;
    }, {});

    return filteredAbsences.map(absence => {
      const profile = profileMap[absence.employee_id];
      const teamId = memberTeamMap[absence.employee_id];
      return {
        Empleado: profile?.full_name || 'Desconocido',
        Email: profile?.email || '',
        Equipo: teamId ? (teamMap[teamId] || 'Sin Equipo') : 'Sin Equipo',
        Tipo: this.translateAbsenceType(absence.type),
        Estado: this.translateAbsenceStatus(absence.status),
        Inicio: absence.start_date,
        Fin: absence.end_date,
        Motivo: absence.reason || ''
      };
    });
  },

  translateEntryType(type: string) {
    const types: Record<string, string> = {
      'clock-in': 'Entrada',
      'clock-out': 'Salida',
      'break-start': 'Inicio Descanso',
      'break-end': 'Fin Descanso',
      'medical-out': 'Salida Médico',
      'medical-in': 'Entrada Médico',
      'others-out': 'Salida Permiso',
      'others-in': 'Entrada Permiso'
    };
    return types[type] || type;
  },

  translateAbsenceType(type: string) {
    const types: Record<string, string> = {
      'vacation': 'Vacaciones',
      'sick': 'Baja Médica',
      'maternity': 'Maternidad/Paternidad',
      'permission': 'Permiso',
      'unjustified': 'No Justificada',
      'other': 'Otro'
    };
    return types[type] || type;
  },

  translateAbsenceStatus(status: string) {
    const statuses: Record<string, string> = {
      'pending': 'Pendiente',
      'approved': 'Aprobada',
      'rejected': 'Rechazada'
    };
    return statuses[status] || status;
  }
};
