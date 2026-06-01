import { useState, useEffect } from 'react';
import { DownloadCloud, Table2, Check, Download, Filter, Settings2, RefreshCcw, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CustomSelect } from '../components/ui/CustomSelect';
import { exportService } from '../services/exportService';
import { supabase } from '../services/supabase';
import { pdfjs, Document, Page } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function Export() {
  const { activeCompany, profile } = useAuth();
  
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportType, setExportType] = useState<'shifts' | 'schedule' | 'absences'>('shifts');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  
  const [teams, setTeams] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Column definitions based on type
  const columnConfigs: Record<string, string[]> = {
    shifts: ['Empleado', 'Email', 'Equipo', 'Fecha', 'Hora', 'Tipo', 'Descripción', 'Método', 'Ubicación', 'Minutos'],
    schedule: ['Empleado', 'Email', 'Equipo', 'Fecha', 'Inicio', 'Fin', 'Estado', 'Publicado', 'Horas_Extra', 'Notas'],
    absences: ['Empleado', 'Email', 'Equipo', 'Tipo', 'Estado', 'Inicio', 'Fin', 'Motivo']
  };

  const [selectedColumns, setSelectedColumns] = useState<string[]>(columnConfigs['shifts']);

  // Update selected columns when exportType changes
  useEffect(() => {
    setSelectedColumns(columnConfigs[exportType]);
  }, [exportType]);

  // Fetch teams and employees
  useEffect(() => {
    async function loadFilters() {
      if (!activeCompany) return;
      const { data: teamsData } = await supabase.from('teams').select('id, name').eq('company_id', activeCompany.id);
      if (teamsData) setTeams(teamsData);

      const { data: members } = await supabase.from('company_members').select('user_id').eq('company_id', activeCompany.id);
      if (members && members.length > 0) {
        const ids = members.map(m => m.user_id);
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids).order('full_name');
        if (profs) setEmployees(profs);
      }
    }
    loadFilters();
  }, [activeCompany]);

  // Fetch preview data
  useEffect(() => {
    async function loadData() {
      if (!activeCompany) return;
      setLoadingPreview(true);
      setErrorMsg('');
      try {
        const { startDate, endDate } = getPeriodDates(selectedPeriod);
        let data: any[] = [];
        if (exportType === 'shifts') {
          data = await exportService.fetchTimeEntriesData(activeCompany.id, startDate, endDate, teamFilter, employeeFilter);
        } else if (exportType === 'schedule') {
          data = await exportService.fetchShiftsData(activeCompany.id, startDate, endDate, teamFilter, employeeFilter);
        } else if (exportType === 'absences') {
          data = await exportService.fetchAbsencesData(activeCompany.id, startDate, endDate, teamFilter, employeeFilter);
        }
        setPreviewData(data);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error cargando datos');
        setPreviewData([]);
      } finally {
        setLoadingPreview(false);
      }
    }
    
    // Add a slight debounce conceptually by simply waiting for state to settle
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeCompany, exportType, selectedPeriod, teamFilter, employeeFilter, customStartDate, customEndDate]);

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const getPeriodDates = (period: string) => {
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (period) {
      case 'week':
        const dayOfWeek = today.getDay() || 7;
        startDate.setDate(today.getDate() - dayOfWeek + 1);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'last_week':
        const lastWeekDay = today.getDay() || 7;
        startDate.setDate(today.getDate() - lastWeekDay - 6);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'last_month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
      case 'custom':
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
    }
    return { startDate, endDate };
  };

  useEffect(() => {
    if (exportFormat === 'pdf' && previewData.length > 0 && selectedColumns.length > 0 && activeCompany) {
      try {
        const { startDate, endDate } = getPeriodDates(selectedPeriod);
        const url = exportService.getCustomPDFPreviewUrl(
          previewData, 
          selectedColumns, 
          exportType, 
          startDate, 
          endDate,
          activeCompany.name
        );
        setPdfPreviewUrl(url);
      } catch (err) {
        console.error('Error previewing PDF', err);
      }
    } else {
      setPdfPreviewUrl(null);
    }
  }, [previewData, selectedColumns, exportFormat, selectedPeriod, activeCompany]);

  const handleExportCSV = async () => {
    if (!activeCompany || !profile) return;
    if (selectedColumns.length === 0) {
      setErrorMsg('Selecciona al menos una columna para exportar.');
      return;
    }
    setIsExporting(true);
    setErrorMsg('');

    try {
      const { startDate, endDate } = getPeriodDates(selectedPeriod);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const filename = `${exportType}_${startStr}_${endStr}`;
      
      await exportService.downloadCustomCSV(
        previewData, 
        selectedColumns, 
        filename, 
        activeCompany.id, 
        profile.id, 
        exportType
      );
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al generar la exportación');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!activeCompany || !profile) return;
    if (selectedColumns.length === 0) {
      setErrorMsg('Selecciona al menos una columna para exportar.');
      return;
    }
    setIsExporting(true);
    setErrorMsg('');

    try {
      const { startDate, endDate } = getPeriodDates(selectedPeriod);
      await exportService.downloadCustomPDF(
        previewData,
        selectedColumns,
        `Fycheo_${exportType}`,
        activeCompany.id,
        profile.id,
        exportType,
        startDate,
        endDate,
        activeCompany.name
      );
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al generar la exportación PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const teamOptions = [
    { value: 'all', label: 'Toda la Organización' },
    ...teams.map(t => ({ value: t.id, label: t.name }))
  ];

  const employeeOptions = [
    { value: 'all', label: 'Todos los Empleados' },
    ...employees.map(e => ({ value: e.id, label: e.full_name }))
  ];

  const typeOptions = [
    { value: 'shifts', label: 'Registro de Fichajes' },
    { value: 'schedule', label: 'Cuadrante de Turnos' },
    { value: 'absences', label: 'Bajas y Ausencias' }
  ];

  const periodOptions = [
    { value: 'week', label: 'Esta Semana' },
    { value: 'last_week', label: 'Semana Pasada' },
    { value: 'month', label: 'Este Mes' },
    { value: 'last_month', label: 'Mes Pasado' },
    { value: 'year', label: 'Este Año' },
    { value: 'custom', label: 'Periodo Personalizado' }
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fadeIn max-w-[1400px] mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <DownloadCloud size={24} />
            </div>
            Report Builder
          </h1>
          <p className="text-slate-400 mt-2">Configura tu informe a medida y visualiza los datos en tiempo real antes de exportar.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Panel Izquierdo: Configuración */}
        <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0 overflow-y-auto pr-2 custom-scrollbar">
          
          <div className="bg-surface-dark border border-white/5 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Filter size={16} className="text-primary" />
              Origen y Filtros
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Origen de Datos</label>
                <CustomSelect value={exportType} onChange={(v) => setExportType(v as any)} options={typeOptions} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Periodo</label>
                <CustomSelect value={selectedPeriod} onChange={(v) => setSelectedPeriod(v)} options={periodOptions} className="w-full" />
              </div>

              {selectedPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-2 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Desde</label>
                    <input 
                      type="date" 
                      value={customStartDate} 
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="w-full bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Hasta</label>
                    <input 
                      type="date" 
                      value={customEndDate} 
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="w-full bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filtro de Equipo</label>
                <CustomSelect value={teamFilter} onChange={(v) => setTeamFilter(v)} options={teamOptions} className="w-full" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filtro de Empleado</label>
                <CustomSelect value={employeeFilter} onChange={(v) => setEmployeeFilter(v)} options={employeeOptions} searchable className="w-full" />
              </div>
            </div>
          </div>

          <div className="bg-surface-dark border border-white/5 rounded-2xl p-5 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 shrink-0">
                <Settings2 size={16} className="text-blue-400" />
                Columnas Visibles
              </h2>
              <button 
                onClick={() => {
                  if (selectedColumns.length === columnConfigs[exportType].length) {
                    setSelectedColumns([]);
                  } else {
                    setSelectedColumns(columnConfigs[exportType]);
                  }
                }}
                className="text-[10px] uppercase tracking-wider font-bold text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap bg-blue-500/10 px-2 py-1 rounded-md"
              >
                {selectedColumns.length === columnConfigs[exportType].length ? 'Ninguna' : 'Todas'}
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar pr-2">
              {columnConfigs[exportType].map(col => {
                const isActive = selectedColumns.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => toggleColumn(col)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      isActive 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-100' 
                        : 'bg-black/20 border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-sm font-medium">{col.replace('_', ' ')}</span>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                      isActive ? 'bg-blue-500 text-white' : 'border border-white/20'
                    }`}>
                      {isActive && <Check size={12} strokeWidth={3} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        {/* Panel Derecho: Previsualización */}
        <div className="flex-1 bg-surface-dark border border-white/5 rounded-2xl flex flex-col min-h-0 relative overflow-hidden">
          <div className="p-4 md:p-5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-lg text-slate-300">
                <Table2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Previsualización de Datos</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {loadingPreview ? 'Cargando datos...' : `${previewData.length} registros encontrados`}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-end border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
              <div className="flex items-center bg-black/40 border border-white/5 p-1 rounded-xl flex-1 sm:flex-initial justify-center">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial ${
                    exportFormat === 'csv' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200 transparent border border-transparent'
                  }`}
                >
                  <Download size={14} />
                  CSV
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 flex-1 sm:flex-initial ${
                    exportFormat === 'pdf' 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200 transparent border border-transparent'
                  }`}
                >
                  <FileText size={14} />
                  PDF
                </button>
              </div>

              <button
                onClick={exportFormat === 'csv' ? handleExportCSV : handleExportPDF}
                disabled={isExporting || previewData.length === 0 || selectedColumns.length === 0}
                className={`py-2 px-6 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 ${
                  isExporting || previewData.length === 0 || selectedColumns.length === 0
                  ? 'bg-primary/20 text-primary/50 cursor-not-allowed shadow-none' 
                  : 'bg-primary hover:bg-primary-hover text-white shadow-primary/20 hover:scale-[1.02]'
                }`}
              >
                {isExporting ? <RefreshCcw size={16} className="animate-spin" /> : <Download size={16} />}
                <span>{isExporting ? 'Procesando...' : 'Exportar'}</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium shrink-0">
              {errorMsg}
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden p-0 rounded-xl">
            {loadingPreview ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                <RefreshCcw size={32} className="animate-spin text-primary" />
                <p className="text-sm font-medium">Actualizando vista...</p>
              </div>
            ) : previewData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 p-8 text-center">
                <Table2 size={48} className="text-white/5 mb-2" />
                <p className="text-base font-medium text-slate-300">No hay datos disponibles</p>
                <p className="text-sm">Prueba a cambiar el periodo o los filtros seleccionados.</p>
              </div>
            ) : selectedColumns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 p-8 text-center">
                <Settings2 size={48} className="text-white/5 mb-2" />
                <p className="text-base font-medium text-slate-300">Ninguna columna seleccionada</p>
                <p className="text-sm">Activa al menos una columna en el panel izquierdo para ver los datos.</p>
              </div>
            ) : (
              /* PREVISUALIZACION */
              exportFormat === 'pdf' && pdfPreviewUrl ? (
                <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-black/10 rounded-xl">
                  <Document 
                    file={pdfPreviewUrl} 
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    className="grid grid-cols-1 xl:grid-cols-2 gap-8 auto-rows-max justify-items-center"
                  >
                    {Array.from(new Array(numPages), (_, index) => (
                      <div 
                        key={`page_${index + 1}`} 
                        onClick={() => setZoomedPage(index + 1)}
                        className="shadow-2xl rounded-sm overflow-hidden border border-white/10 bg-white w-full max-w-[800px] transition-transform hover:scale-[1.03] cursor-pointer relative group"
                      >
                        <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors z-10 flex items-center justify-center">
                          <div className="bg-primary text-white px-4 py-2 rounded-full font-bold opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0 shadow-xl">
                            Ampliar Página {index + 1}
                          </div>
                        </div>
                        <Page 
                          pageNumber={index + 1} 
                          renderTextLayer={false} 
                          renderAnnotationLayer={false}
                          className="w-full [&>.react-pdf\_\_Page\_\_canvas]:!w-full [&>.react-pdf\_\_Page\_\_canvas]:!h-auto"
                        />
                      </div>
                    ))}
                  </Document>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1 custom-scrollbar -mx-6 px-6 relative">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        {selectedColumns.map(col => (
                          <th key={col} className="px-4 py-3 font-semibold whitespace-nowrap">{col.replace('_', ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 50).map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          {selectedColumns.map(col => (
                            <td key={col} className="px-4 py-3 whitespace-nowrap text-slate-300">
                              {row[col] !== null ? row[col] : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>
      
      {/* MODAL ZOOM PDF */}
      {zoomedPage !== null && pdfPreviewUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-8 backdrop-blur-sm"
          onClick={() => setZoomedPage(null)}
        >
          <div className="relative w-full h-full max-w-6xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">
                Previsualización - Página {zoomedPage} de {numPages}
              </h3>
              <button 
                onClick={() => setZoomedPage(null)} 
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex justify-center items-center rounded-xl relative group p-2 pb-6">
              {/* Controles flotantes */}
              {zoomedPage > 1 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setZoomedPage(zoomedPage - 1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-md transition-all shadow-xl opacity-0 group-hover:opacity-100 z-10"
                >
                  <ChevronLeft size={32} />
                </button>
              )}
              {zoomedPage < numPages && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setZoomedPage(zoomedPage + 1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-md transition-all shadow-xl opacity-0 group-hover:opacity-100 z-10"
                >
                  <ChevronRight size={32} />
                </button>
              )}

              <Document file={pdfPreviewUrl} className="h-full flex justify-center">
                <div className="shadow-2xl rounded-sm overflow-hidden bg-white h-full inline-block">
                  <Page 
                    pageNumber={zoomedPage}
                    renderTextLayer={false} 
                    renderAnnotationLayer={false}
                    className="h-full [&>.react-pdf\_\_Page\_\_canvas]:!h-full [&>.react-pdf\_\_Page\_\_canvas]:!w-auto transition-opacity"
                  />
                </div>
              </Document>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
