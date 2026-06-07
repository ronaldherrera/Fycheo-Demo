import { useState, useEffect, useRef } from 'react';
import { Clock, CalendarDays, Sun, Settings as SettingsIcon, Plus, Trash2, X, Check, CheckCircle, Pencil, Shield, Search, ChevronRight, ChevronDown, Briefcase, Loader2, Palmtree, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useAuth } from '../contexts/AuthContext';
import { settingsService } from '../services/settingsService';
import type { Holiday, LeavePolicy } from '../services/settingsService';
import { employeeService } from '../services/employeeService';
import type { Employee } from '../types';

const Settings = () => {
  const { activeCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<'horarios' | 'festivos' | 'general' | 'permisos' | 'jornadas' | 'tiempo_libre'>('horarios');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const initialDataRef = useRef<string>('');

  // Estados para tipos de jornada
  const [shiftTypes, setShiftTypes] = useState<any[]>([]);
  const [isShiftTypeModalOpen, setIsShiftTypeModalOpen] = useState(false);
  const [editingShiftTypeId, setEditingShiftTypeId] = useState<string | null>(null);
  const [shiftTypeForm, setShiftTypeForm] = useState({
    name: '',
    start: '09:00',
    end: '18:00',
    hex: '#3b82f6',
    isSplit: false,
    start2: '16:00',
    end2: '20:00',
    breakMins: 0,
    breakPaid: false,
    breakMins2: 0,
    breakPaid2: false,
    hasPlus: false
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const COLOR_PALETTE = [
    { name: 'Azul', hex: '#3b82f6', bg: 'bg-blue-500' },
    { name: 'Rojo', hex: '#ef4444', bg: 'bg-red-500' },
    { name: 'Verde Esmeralda', hex: '#10b981', bg: 'bg-emerald-500' },
    { name: 'Amarillo', hex: '#facc15', bg: 'bg-yellow-400' },
    { name: 'Naranja', hex: '#f97316', bg: 'bg-orange-500' },
    { name: 'Morado', hex: '#9333ea', bg: 'bg-purple-600' },
    { name: 'Cian Eléctrico', hex: '#22d3ee', bg: 'bg-cyan-400' },
    { name: 'Rosa Chicle', hex: '#f472b6', bg: 'bg-pink-400' },
    { name: 'Verde Lima', hex: '#84cc16', bg: 'bg-lime-500' },
    { name: 'Marrón Tierra', hex: '#92400e', bg: 'bg-amber-800' },
    { name: 'Gris Claro', hex: '#cbd5e1', bg: 'bg-slate-300' },
    { name: 'Gris Carbón', hex: '#475569', bg: 'bg-slate-600' },
  ];

  const LEAVE_COLOR_PALETTE = [
    { name: 'Índigo Profundo', hex: '#6366f1', bg: 'bg-indigo-500' },
    { name: 'Rosa Fuerte', hex: '#f43f5e', bg: 'bg-rose-500' },
    { name: 'Verde Mar', hex: '#14b8a6', bg: 'bg-teal-500' },
    { name: 'Cielo Claro', hex: '#0ea5e9', bg: 'bg-sky-500' },
    { name: 'Violeta', hex: '#8b5cf6', bg: 'bg-violet-500' },
    { name: 'Ambar Brillante', hex: '#f59e0b', bg: 'bg-amber-500' },
    { name: 'Rojo Carmesí', hex: '#be123c', bg: 'bg-rose-700' },
    { name: 'Azul Marino', hex: '#1e3a8a', bg: 'bg-blue-900' },
    { name: 'Verde Oliva', hex: '#4d7c0f', bg: 'bg-lime-700' },
  ];
  
  const isAdminOrHr = activeCompany?.role === 'admin' || activeCompany?.role === 'hr';

  // Mock states for UI
  const [schedule, setSchedule] = useState({
    monday: { active: true, start: '09:00', end: '18:00' },
    tuesday: { active: true, start: '09:00', end: '18:00' },
    wednesday: { active: true, start: '09:00', end: '18:00' },
    thursday: { active: true, start: '09:00', end: '18:00' },
    friday: { active: true, start: '09:00', end: '15:00' },
    saturday: { active: false, start: '10:00', end: '14:00' },
    sunday: { active: false, start: '', end: '' },
  });

  const [generalSettings, setGeneralSettings] = useState({
    tolerance: '0',
    timezone: 'Europe/Madrid'
  });

  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [isLeavePolicyModalOpen, setIsLeavePolicyModalOpen] = useState(false);
  const [isLimitPeriodDropdownOpen, setIsLimitPeriodDropdownOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState<Omit<LeavePolicy, 'id'>>({
    name: '',
    color: 'bg-teal-500',
    hex: '#14b8a6',
    minAmount: 0,
    maxAmount: 1,
    limitUnit: 'days',
    limitPeriod: 'month',
    maxTimes: 0,
    isPaid: true,
    consecutiveDays: true
  });

  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activePermissionKey, setActivePermissionKey] = useState<string | null>(null);

  const permissionCategories = [
    {
      title: 'Permisos Generales de la Organización',
      permissions: [
        { key: 'view_settings', title: 'Acceder a Configuración', desc: 'Permite ver la pestaña de Configuración de la empresa.' },
        { key: 'edit_settings', title: 'Modificar Configuración', desc: 'Permite editar horarios, festivos y ajustes generales.' },
        { key: 'edit_teams', title: 'Gestión de Equipos', desc: 'Permite crear nuevos equipos o mover empleados de un equipo a otro.' },
        { key: 'manage_employees', title: 'Invitar Empleados', desc: 'Permite invitar nuevos usuarios a la empresa o darlos de baja.' },
        { key: 'view_reports', title: 'Ver Analíticas', desc: 'Permite acceder a los reportes de horas extra, retrasos y ausencias.' },
      ]
    }
  ];

  const allPermissions = permissionCategories.flatMap(c => c.permissions);

  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    if (activeCompany?.id) {
      loadSettings();
    }
  }, [activeCompany?.id]);  const loadSettings = async () => {
    if (!activeCompany) return;
    setIsLoaded(false);
    initialDataRef.current = '';
    try {
      const [holidaysData, settingsData, employeesData] = await Promise.all([
        settingsService.getHolidays(activeCompany.id),
        settingsService.getCompanySettings(activeCompany.id),
        isAdminOrHr ? employeeService.getEmployees(activeCompany.id) : Promise.resolve([])
      ]);
      setHolidays(holidaysData);
      if (isAdminOrHr) {
          setEmployees(employeesData.filter(e => e.role !== 'admin' && e.role !== 'hr'));
      }
      
      if (settingsData) {
        const scheduleVal = settingsData.schedule || schedule;
        const generalVal = settingsData.general || generalSettings;
        const permissionsVal = settingsData.permissions || permissions;
        const shiftTypesVal = settingsData.shift_types || [];
        const leavePoliciesVal = settingsData.leave_policies || [];

        setSchedule(scheduleVal as any);
        setGeneralSettings(generalVal);
        setPermissions(permissionsVal);
        setShiftTypes(shiftTypesVal as any);
        setLeavePolicies(leavePoliciesVal);

        initialDataRef.current = JSON.stringify({
          schedule: scheduleVal,
          general: generalVal,
          permissions: permissionsVal,
          shift_types: shiftTypesVal,
          leave_policies: leavePoliciesVal
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoaded(true);
    }
  };

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', type: 'closed', start: '09:00', end: '14:00' });

  const daysOfWeek = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
  ];

  useEffect(() => {
    if (!isLoaded || !activeCompany?.id) return;

    const currentString = JSON.stringify({
      schedule,
      general: generalSettings,
      permissions,
      shift_types: shiftTypes,
      leave_policies: leavePolicies
    });

    if (currentString === initialDataRef.current) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    const delayDebounceFn = setTimeout(async () => {
      try {
        await settingsService.updateCompanySettings(activeCompany.id, {
          schedule: schedule as any,
          general: generalSettings,
          permissions: isAdminOrHr ? permissions : undefined,
          shift_types: shiftTypes as any,
          leave_policies: leavePolicies
        });
        
        initialDataRef.current = currentString;
        setSaveStatus('saved');
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [schedule, generalSettings, permissions, shiftTypes, leavePolicies, isLoaded, activeCompany?.id]);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Configuración de Organización</h1>
          
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
        <p className="text-slate-400 text-sm">Gestiona horarios, festivos y reglas generales</p>
      </div>

      {/* Tabs */}
      <div className="w-full flex overflow-x-auto hide-scrollbar gap-2 border-b border-white/5 pb-px">
        <button
          onClick={() => setActiveTab('horarios')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'horarios' ? 'border-primary text-primary font-medium' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Clock size={18} />
          <span>Horario Laboral</span>
        </button>
        <button
          onClick={() => setActiveTab('jornadas')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'jornadas' ? 'border-primary text-primary font-medium' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Briefcase size={18} />
          <span>Tipos de Jornada</span>
        </button>
        <button
          onClick={() => setActiveTab('festivos')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'festivos' ? 'border-primary text-primary font-medium' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <CalendarDays size={18} />
          <span>Festivos y Cierres</span>
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'general' ? 'border-primary text-primary font-medium' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <SettingsIcon size={18} />
          <span>General</span>
        </button>
        <button
          onClick={() => setActiveTab('tiempo_libre')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'tiempo_libre' ? 'border-primary text-primary font-medium' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Palmtree size={18} />
          <span>Tiempo Libre</span>
        </button>
        {isAdminOrHr && (
          <button
            onClick={() => setActiveTab('permisos')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'permisos' ? 'border-primary text-primary font-medium' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Shield size={18} />
            <span>Permisos</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-surface-dark rounded-2xl border border-white/5 shadow-sm p-6">
        {activeTab === 'horarios' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Horario Base Semanal</h3>
              <p className="text-sm text-slate-400 mb-6">Define los días y horas de apertura habituales de la empresa.</p>
              
              <div className="space-y-3">
                {daysOfWeek.map((day) => {
                  const data = schedule[day.key as keyof typeof schedule];
                  return (
                    <div key={day.key} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-black/40 transition-colors">
                      <div className="w-32 flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={data.active}
                          onChange={(e) => setSchedule({...schedule, [day.key]: {...data, active: e.target.checked}})}
                          className="w-4 h-4 rounded border-slate-600 bg-surface-dark text-primary focus:ring-primary focus:ring-offset-surface-dark"
                        />
                        <span className={`font-medium ${data.active ? 'text-white' : 'text-slate-500'}`}>{day.label}</span>
                      </div>
                      
                      {data.active ? (
                        <div className="flex items-center gap-3 flex-1">
                          <input 
                            type="time" 
                            value={data.start}
                            onChange={(e) => setSchedule({...schedule, [day.key]: {...data, start: e.target.value}})}
                            className="bg-surface-dark border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-primary outline-none"
                          />
                          <span className="text-slate-500">a</span>
                          <input 
                            type="time" 
                            value={data.end}
                            onChange={(e) => setSchedule({...schedule, [day.key]: {...data, end: e.target.value}})}
                            className="bg-surface-dark border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 text-sm text-slate-500 italic">Cerrado</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <Sun className="text-blue-400 shrink-0 mt-0.5" size={24} />
                    <div>
                        <h4 className="text-blue-400 font-semibold mb-1">Trabajo en Domingos</h4>
                        <p className="text-sm text-blue-400/80 leading-relaxed">
                            Si tu organización opera los domingos, asegúrate de marcarlo arriba. Más adelante podrás configurar reglas especiales para el pago o compensación de horas en fines de semana en la sección de políticas.
                        </p>
                    </div>
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'jornadas' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Tipos de Jornada (Turnos Predefinidos)</h3>
                <p className="text-sm text-slate-400">Configura los turnos habituales para que el manager pueda asignarlos rápidamente arrastrando en la escaleta.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingShiftTypeId(null);
                  setShiftTypeForm({ 
                    name: '', 
                    start: '09:00', 
                    end: '17:00', 
                    hex: '#3b82f6',
                    isSplit: false,
                    start2: '16:00',
                    end2: '20:00',
                    breakMins: 0,
                    breakPaid: false,
                    breakMins2: 0,
                    breakPaid2: false,
                    hasPlus: false
                  });
                  setIsShiftTypeModalOpen(true);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-primary bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors shrink-0"
              >
                <Plus size={16} /> Añadir Turno
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shiftTypes.map(type => {
                const colorObj = COLOR_PALETTE.find(c => c.hex === type.hex) || { bg: type.color || 'bg-blue-500' };
                return (
                  <div key={type.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-black/20 group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-3.5 h-12 rounded-full ${colorObj.bg}`}></div>
                      <div>
                        <h4 className="text-white font-medium flex items-center gap-2">
                          <span>{type.name}</span>
                          {type.isSplit && (
                            <span className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                              Partido
                            </span>
                          )}
                          {type.hasPlus && (
                            <span 
                              className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5"
                              title="Este turno incluye plus salarial"
                            >
                              ⚡ Plus
                            </span>
                          )}
                          {type.breakMins && type.breakMins > 0 ? (
                            <span 
                              className={`text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 select-none ${
                                type.breakPaid 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                              }`}
                              title={`Tiempo de descanso: ${type.breakMins} minutos (${type.breakPaid ? 'dentro' : 'fuera'} de la jornada)`}
                            >
                              ☕ {type.breakMins}m
                            </span>
                          ) : null}
                        </h4>
                        <div className="flex flex-col mt-0.5">
                          <span className="text-xs text-slate-400 font-medium">
                            {type.isSplit
                              ? `${type.start} - ${type.end} y ${type.start2} - ${type.end2}`
                              : (() => {
                                  if (type.breakMins > 0 && !type.breakPaid) {
                                    const [eH, eM] = type.end.split(':').map(Number);
                                    const realMins = eH * 60 + eM + type.breakMins;
                                    const realEnd = `${String(Math.floor(realMins / 60) % 24).padStart(2, '0')}:${String(realMins % 60).padStart(2, '0')}`;
                                    return `${type.start} - ${realEnd} (salida real)`;
                                  }
                                  return `${type.start} - ${type.end}`;
                                })()
                            }
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">Duración trabajada: {type.duration}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingShiftTypeId(type.id);
                          setShiftTypeForm({ 
                            name: type.name, 
                            start: type.start, 
                            end: type.end, 
                            hex: type.hex,
                            isSplit: !!type.isSplit,
                            start2: type.start2 || '16:00',
                            end2: type.end2 || '20:00',
                            breakMins: type.breakMins || 0,
                            breakPaid: !!type.breakPaid,
                            breakMins2: type.breakMins2 || 0,
                            breakPaid2: !!type.breakPaid2,
                            hasPlus: !!type.hasPlus
                          });
                          setIsShiftTypeModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`¿Estás seguro de que quieres eliminar la jornada "${type.name}"?`)) {
                            const updated = shiftTypes.filter(t => t.id !== type.id);
                            setShiftTypes(updated);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'festivos' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">Días Especiales y Festivos</h3>
                    <p className="text-sm text-slate-400">Configura cierres completos o días con horario reducido/especial.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingHolidayId(null);
                    setHolidayForm({ name: '', date: '', type: 'closed', start: '09:00', end: '14:00' });
                    setIsHolidayModalOpen(true);
                  }}
                  className="flex items-center gap-2 text-sm font-semibold text-primary bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors"
                >
                    <Plus size={16} /> Añadir fecha
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {holidays.map(holiday => {
                    const d = new Date(holiday.date);
                    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
                    const isNormallyClosed = !schedule[dayKeys[d.getDay()]]?.active;

                    let colorClasses = { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
                    if (holiday.type === 'closed') {
                        colorClasses = { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' };
                    } else if (isNormallyClosed) {
                        colorClasses = { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20' };
                    } else if (holiday.type === 'special_hours') {
                        colorClasses = { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' };
                    }

                    return (
                    <div key={holiday.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-black/20 group hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center border ${colorClasses.bg} ${colorClasses.text} ${colorClasses.border}`}>
                                <span className="text-xs font-bold leading-none">{holiday.date.split('-')[2]}</span>
                                <span className="text-[10px] uppercase leading-none mt-0.5">Mes {holiday.date.split('-')[1]}</span>
                            </div>
                            <div>
                                <h4 className="text-white font-medium">{holiday.name}</h4>
                                <div className="flex flex-col">
                                    <span className="text-xs text-slate-500">{holiday.date}</span>
                                    {holiday.type === 'special_hours' && (
                                        <span className={`text-xs mt-0.5 font-medium ${isNormallyClosed ? 'text-fuchsia-400/80' : 'text-orange-400/80'}`}>Horario: {holiday.start_time?.slice(0, 5)} a {holiday.end_time?.slice(0, 5)}</span>
                                    )}
                                    {holiday.type === 'closed' && (
                                        <span className="text-xs text-red-400/80 mt-0.5 font-medium">Cerrado todo el día</span>
                                    )}
                                    {holiday.type === 'open_normal' && (
                                        <span className={`text-xs mt-0.5 font-medium ${isNormallyClosed ? 'text-fuchsia-400/80' : 'text-emerald-400/80'}`}>Abierto (Horario habitual)</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => {
                                    setEditingHolidayId(holiday.id);
                                    setHolidayForm({
                                        name: holiday.name,
                                        date: holiday.date,
                                        type: holiday.type,
                                        start: holiday.start_time?.slice(0, 5) || '09:00',
                                        end: holiday.end_time?.slice(0, 5) || '14:00'
                                    });
                                    setIsHolidayModalOpen(true);
                                }}
                                className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <Pencil size={18} />
                            </button>
                            <button 
                                onClick={async () => {
                                  try {
                                    await settingsService.deleteHoliday(holiday.id);
                                    setHolidays(h => h.filter(x => x.id !== holiday.id));
                                  } catch (err) {
                                    console.error(err);
                                    alert("Error al eliminar el festivo.");
                                  }
                                }}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                    );
                })}
            </div>
          </motion.div>
        )}

        {activeTab === 'general' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Ajustes Generales</h3>
              <p className="text-sm text-slate-400 mb-6">Configuraciones adicionales de la organización.</p>
            </div>

            <div className="max-w-md space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Tolerancia de fichaje (minutos)</label>
                    <CustomSelect
                      value={generalSettings.tolerance}
                      onChange={(val) => setGeneralSettings({ ...generalSettings, tolerance: val })}
                      options={[
                        { value: "0", label: "0 minutos (Estricto)" },
                        { value: "5", label: "5 minutos" },
                        { value: "10", label: "10 minutos" },
                        { value: "15", label: "15 minutos" }
                      ]}
                    />
                    <p className="text-xs text-slate-500 mt-1">Margen de tiempo antes de marcar un retraso.</p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Zona Horaria</label>
                    <CustomSelect
                      value={generalSettings.timezone}
                      onChange={(val) => setGeneralSettings({ ...generalSettings, timezone: val })}
                      options={[
                        { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST)" },
                        { value: "America/Mexico_City", label: "America/Mexico_City (CST)" }
                      ]}
                    />
                </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'tiempo_libre' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Políticas de Tiempo Libre y Permisos</h3>
                <p className="text-sm text-slate-400">Define las reglas de permisos y descansos garantizados por contrato.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingPolicyId(null);
                  setPolicyForm({
                    name: '',
                    color: 'bg-teal-500',
                    hex: '#14b8a6',
                    minAmount: 0,
                    maxAmount: 1,
                    limitUnit: 'days',
                    limitPeriod: 'month',
                    maxTimes: 0,
                    isPaid: true,
                    consecutiveDays: true
                  });
                  setIsLeavePolicyModalOpen(true);
                }}
                className="flex items-center gap-2 text-sm font-semibold text-primary bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors shrink-0"
              >
                <Plus size={16} /> Añadir Política
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leavePolicies.map(policy => {
                const colorObj = LEAVE_COLOR_PALETTE.find(c => c.hex === policy.hex) || { bg: policy.color || 'bg-slate-500', text: 'text-slate-400' };
                
                const periodText = policy.limitPeriod === 'week' ? 'semana' : policy.limitPeriod === 'month' ? 'mes' : 'año';
                const unitText = policy.limitUnit === 'days' ? 'días' : 'veces';

                return (
                  <div key={policy.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-black/20 group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-3.5 h-12 rounded-full ${colorObj.bg}`}></div>
                      <div>
                        <h4 className="text-white font-medium flex items-center gap-2">
                          {policy.name}
                          <div className="flex items-center gap-1.5 ml-2">
                            <span 
                              className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                policy.isPaid !== false
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                              title={policy.isPaid !== false ? 'Permiso Retribuido' : 'El trabajador debe recuperar este tiempo'}
                            >
                              {policy.isPaid !== false ? '💰 Retribuido' : '⏳ A Recuperar'}
                            </span>
                          </div>
                        </h4>
                        <div className="flex flex-col mt-0.5">
                          <span className="text-sm text-slate-400">
                            {policy.minAmount > 0 ? `Min: ${policy.minAmount} ` : ''}Max: {policy.maxAmount} {unitText} al {periodText}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingPolicyId(policy.id);
                          setPolicyForm({ 
                            name: policy.name,
                            color: policy.color,
                            hex: policy.hex,
                            minAmount: policy.minAmount || 0,
                            maxAmount: policy.maxAmount || (policy as any).limitAmount || 1, // Fallback for old data
                            limitUnit: 'days',
                            limitPeriod: policy.limitPeriod,
                            maxTimes: policy.maxTimes || 0,
                            isPaid: policy.isPaid !== false,
                            consecutiveDays: policy.consecutiveDays !== false
                          });
                          setIsLeavePolicyModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`¿Estás seguro de que quieres eliminar la política "${policy.name}"?`)) {
                            setLeavePolicies(leavePolicies.filter(p => p.id !== policy.id));
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {leavePolicies.length === 0 && (
                <div className="col-span-full p-8 text-center bg-black/20 rounded-xl border border-white/5 border-dashed">
                  <Palmtree size={32} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400 font-medium">No hay políticas configuradas</p>
                  <p className="text-sm text-slate-500 mt-1">Añade reglas para sábados libres, vacaciones, cumpleaños, etc.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'permisos' && isAdminOrHr && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Permisos de Configuración</h3>
              <p className="text-sm text-slate-400 mb-6">Selecciona qué miembros del equipo (Managers o Empleados) pueden ver y modificar esta sección de Configuración. Los Administradores y RRHH siempre tienen acceso total.</p>
            </div>

            <div className="flex flex-col gap-8 max-w-3xl">
                {permissionCategories.map(category => (
                  <div key={category.title} className="space-y-3">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">{category.title}</h4>
                    <div className="flex flex-col gap-2">
                      {category.permissions.map(perm => (
                        <div 
                          key={perm.key}
                          onClick={() => setActivePermissionKey(perm.key)}
                          className="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer group flex items-center justify-between gap-4"
                        >
                          <div className="flex-1">
                            <h5 className="text-white font-semibold mb-0.5 group-hover:text-primary transition-colors">{perm.title}</h5>
                            <p className="text-sm text-slate-400 leading-relaxed">{perm.desc}</p>
                          </div>
                          
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium px-2.5 py-1 rounded-lg bg-black/30 border border-white/5 group-hover:border-primary/20 group-hover:text-primary/80 transition-colors">
                              <span>{(permissions[perm.key] || []).length} usuarios</span>
                            </div>
                            <div className="text-slate-500 group-hover:text-primary transition-colors">
                              <ChevronRight size={20} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal: Asignar Permisos */}
      <AnimatePresence>
        {activePermissionKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setActivePermissionKey(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-white/5 shrink-0 flex justify-between items-start">
                  <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        {allPermissions.find(p => p.key === activePermissionKey)?.title}
                      </h3>
                      <p className="text-sm text-slate-400">Selecciona los empleados con este permiso.</p>
                  </div>
                  <button onClick={() => setActivePermissionKey(null)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                      <X size={20} />
                  </button>
              </div>

              <div className="p-4 border-b border-white/5 bg-black/20 shrink-0">
                  <div className="flex items-center gap-3 px-3 py-2 bg-black/50 rounded-lg border border-white/5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                      <Search className="text-slate-400" size={18} />
                      <input 
                          type="text" 
                          placeholder="Buscar empleado..." 
                          className="bg-transparent border-none outline-none text-white w-full text-sm placeholder-slate-500"
                      />
                  </div>
              </div>

              <div className="overflow-y-auto p-2">
                  {employees.map(employee => {
                      const hasAccess = (permissions[activePermissionKey] || []).includes(employee.id);
                      return (
                          <div key={employee.id} className="p-3 rounded-lg flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {
                              setPermissions(prev => {
                                  const current = prev[activePermissionKey] || [];
                                  return {
                                      ...prev,
                                      [activePermissionKey]: hasAccess 
                                          ? current.filter(id => id !== employee.id)
                                          : [...current, employee.id]
                                  };
                              });
                          }}>
                              <div className="flex items-center gap-3 pointer-events-none">
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden ring-1 ring-white/10">
                                      {employee.avatar ? (
                                          <img src={employee.avatar} alt={employee.full_name} className="w-full h-full object-cover" />
                                      ) : (
                                          <span className="font-bold text-sm">{(employee.full_name || employee.name)?.charAt(0).toUpperCase()}</span>
                                      )}
                                  </div>
                                  <div>
                                      <p className="text-sm font-medium text-white">{employee.full_name}</p>
                                      <p className="text-xs text-slate-400 capitalize">{employee.role}</p>
                                  </div>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer" 
                                  checked={hasAccess}
                                  readOnly
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                              </label>
                          </div>
                      );
                  })}
                  {employees.length === 0 && (
                      <div className="p-8 text-center text-slate-500 text-sm">
                          No hay otros empleados en la organización.
                      </div>
                  )}
              </div>

              <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
                  <button 
                      onClick={() => setActivePermissionKey(null)}
                      className="w-full bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all"
                  >
                      Hecho
                  </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Añadir Fecha Especial */}
      <AnimatePresence>
        {isHolidayModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsHolidayModalOpen(false)}
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
                                <h3 className="text-xl font-bold text-white">
                                  {editingHolidayId ? 'Editar Fecha Especial' : 'Añadir Fecha Especial'}
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">Configura un cierre o un horario reducido.</p>
                            </div>
                            <button onClick={() => setIsHolidayModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!activeCompany?.id || !holidayForm.name || !holidayForm.date) return;
                            
                            try {
                                const payload = {
                                    name: holidayForm.name,
                                    date: holidayForm.date,
                                    type: holidayForm.type as 'closed' | 'special_hours' | 'open_normal',
                                    start_time: holidayForm.type === 'special_hours' ? holidayForm.start : null,
                                    end_time: holidayForm.type === 'special_hours' ? holidayForm.end : null,
                                };

                                if (editingHolidayId) {
                                    const updated = await settingsService.updateHoliday(editingHolidayId, payload as any);
                                    setHolidays(holidays.map(h => h.id === editingHolidayId ? updated : h));
                                } else {
                                    const newHoliday = await settingsService.addHoliday({
                                        ...payload,
                                        company_id: activeCompany.id
                                    } as any);
                                    setHolidays([...holidays, newHoliday]);
                                }
                                
                                setIsHolidayModalOpen(false);
                                setEditingHolidayId(null);
                                setHolidayForm({ name: '', date: '', type: 'closed', start: '09:00', end: '14:00' });
                            } catch (err) {
                                console.error(err);
                                alert("Error al guardar la fecha. ¿Es posible que ya exista una regla para ese día?");
                            }
                        }} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Nombre del día</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="Ej: Nochevieja, Día del Trabajador..."
                                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none"
                                    value={holidayForm.name}
                                    onChange={e => setHolidayForm({...holidayForm, name: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Fecha</label>
                                <input 
                                    type="date" 
                                    required
                                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none"
                                    value={holidayForm.date}
                                    onChange={e => setHolidayForm({...holidayForm, date: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Tipo de jornada</label>
                                <CustomSelect
                                    value={holidayForm.type}
                                    onChange={(val) => setHolidayForm({...holidayForm, type: val as any})}
                                    options={[
                                        { value: "closed", label: "Cerrado todo el día" },
                                        { value: "open_normal", label: "Abierto (Horario habitual)" },
                                        { value: "special_hours", label: "Horario especial / reducido" }
                                    ]}
                                />
                            </div>

                            {holidayForm.type === 'special_hours' && (
                                <div className="flex gap-4">
                                    <div className="space-y-1.5 flex-1">
                                        <label className="text-sm font-semibold text-slate-300">Hora de inicio</label>
                                        <input 
                                            type="time" 
                                            required
                                            className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none"
                                            value={holidayForm.start}
                                            onChange={e => setHolidayForm({...holidayForm, start: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-1.5 flex-1">
                                        <label className="text-sm font-semibold text-slate-300">Hora de fin</label>
                                        <input 
                                            type="time" 
                                            required
                                            className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary/50 outline-none"
                                            value={holidayForm.end}
                                            onChange={e => setHolidayForm({...holidayForm, end: e.target.value})}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsHolidayModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={!holidayForm.name || !holidayForm.date}
                                    className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                                >
                                    {editingHolidayId ? 'Guardar Cambios' : 'Añadir'}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Modal: Añadir/Editar Tipo de Jornada */}
      <AnimatePresence>
        {isShiftTypeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsShiftTypeModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface-dark w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 overflow-y-auto flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {editingShiftTypeId ? 'Editar Tipo de Jornada' : 'Añadir Tipo de Jornada'}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">Configura un turno predefinido para la planificación.</p>
                  </div>
                  <button 
                    onClick={() => setIsShiftTypeModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Nombre del Turno</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: Turno Mañana, Noche, Refuerzo..."
                      className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none"
                      value={shiftTypeForm.name}
                      onChange={e => setShiftTypeForm({...shiftTypeForm, name: e.target.value})}
                    />
                  </div>

                  {/* Selector Jornada Partida */}
                  <div className="flex items-center justify-between py-1 px-0.5">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-300">Jornada Partida</span>
                      <span className="text-[10px] text-slate-500">¿Tiene dos tramos de horario?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={shiftTypeForm.isSplit}
                        onChange={(e) => setShiftTypeForm({...shiftTypeForm, isSplit: e.target.checked})}
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Selector Contiene Plus */}
                  <div className="flex items-center justify-between py-1 px-0.5 border-t border-white/5 pt-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-300">Contiene Plus salarial</span>
                      <span className="text-[10px] text-slate-500">¿Aplica plus de nocturnidad/festivo/otros?</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={shiftTypeForm.hasPlus}
                        onChange={(e) => setShiftTypeForm({...shiftTypeForm, hasPlus: e.target.checked})}
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Horario */}
                  <div className="space-y-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                    <div>
                      {shiftTypeForm.isSplit && (
                        <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2 animate-fadeIn">Primer Tramo</span>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 uppercase font-semibold">
                            {shiftTypeForm.isSplit ? "Entrada 1" : "Hora de inicio"}
                          </label>
                          <input 
                            type="time" 
                            required
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-primary/50 outline-none text-sm font-medium"
                            value={shiftTypeForm.start}
                            onChange={e => {
                              setValidationError(null);
                              setShiftTypeForm({...shiftTypeForm, start: e.target.value});
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-500 uppercase font-semibold">
                            {shiftTypeForm.isSplit ? "Salida 1" : "Hora de fin"}
                          </label>
                          <input 
                            type="time" 
                            required
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-primary/50 outline-none text-sm font-medium"
                            value={shiftTypeForm.end}
                            onChange={e => {
                              setValidationError(null);
                              setShiftTypeForm({...shiftTypeForm, end: e.target.value});
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div 
                      style={{
                        display: 'grid',
                        gridTemplateRows: shiftTypeForm.isSplit ? '1fr' : '0fr',
                        transition: 'grid-template-rows 220ms cubic-bezier(0.25, 1, 0.5, 1), opacity 220ms cubic-bezier(0.25, 1, 0.5, 1)',
                        opacity: shiftTypeForm.isSplit ? 1 : 0,
                      }}
                      className="overflow-hidden"
                    >
                      <div className="min-h-0">
                        <div className="border-t border-white/5 pt-3 mt-1">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2">Segundo Tramo</span>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5 relative">
                              <label className="block text-[10px] text-slate-500 uppercase font-semibold">Entrada 2</label>
                              <input 
                                type="time" 
                                required
                                className={`w-full bg-black/50 border rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-primary/50 outline-none text-sm font-medium transition-all ${
                                  validationError ? 'border-red-500 ring-1 ring-red-500/20' : 'border-white/10'
                                }`}
                                value={shiftTypeForm.start2}
                                onChange={e => {
                                  setValidationError(null);
                                  setShiftTypeForm({...shiftTypeForm, start2: e.target.value});
                                }}
                              />
                              {validationError && (
                                <div className="absolute bottom-full mb-1.5 left-0 z-50 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-1 leading-tight max-w-[200px] border border-red-400 animate-fadeIn">
                                  <span>⚠️</span>
                                  <span>{validationError}</span>
                                </div>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[10px] text-slate-500 uppercase font-semibold">Salida 2</label>
                              <input 
                                type="time" 
                                required
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-primary/50 outline-none text-sm font-medium"
                                value={shiftTypeForm.end2}
                                onChange={e => {
                                  setValidationError(null);
                                  setShiftTypeForm({...shiftTypeForm, end2: e.target.value});
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tiempo de descanso */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-300">Tiempo de Descanso (Break)</label>

                    {/* Inputs de minutos por tramo */}
                    <div className="space-y-2">
                      {[
                        { label: shiftTypeForm.isSplit ? 'T1' : null, mins: shiftTypeForm.breakMins, setMins: (v: number) => setShiftTypeForm({...shiftTypeForm, breakMins: v}) },
                        ...(shiftTypeForm.isSplit ? [{ label: 'T2', mins: shiftTypeForm.breakMins2, setMins: (v: number) => setShiftTypeForm({...shiftTypeForm, breakMins2: v}) }] : []),
                      ].map((tramo, ti) => (
                        <div key={ti} className="flex gap-2 items-center">
                          {tramo.label && <span className="text-[10px] font-black text-slate-500 uppercase w-5 shrink-0">{tramo.label}</span>}
                          <div className="relative flex-1">
                            <input type="number" min="0" placeholder="Minutos..."
                              className="w-full pl-8 pr-10 py-2 bg-black/50 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-primary/50 text-sm font-semibold"
                              value={tramo.mins || 0}
                              onChange={e => tramo.setMins(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">☕</div>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs text-slate-500 font-semibold">min</div>
                          </div>
                          <div className="flex gap-1">
                            {[5, 10, 30].map(m => (
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

                    {/* Selector único de cómputo */}
                    <div style={{ display: 'grid', gridTemplateRows: (shiftTypeForm.breakMins > 0 || shiftTypeForm.breakMins2 > 0) ? '1fr' : '0fr', transition: 'grid-template-rows 220ms cubic-bezier(0.25,1,0.5,1), opacity 220ms', opacity: (shiftTypeForm.breakMins > 0 || shiftTypeForm.breakMins2 > 0) ? 1 : 0 }} className="overflow-hidden">
                      <div className="min-h-0">
                        <div className="space-y-2 bg-white/[0.01] border border-white/5 p-3.5 rounded-xl mt-1">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">¿Cómo computa el descanso?</span>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button type="button" onClick={() => setShiftTypeForm({...shiftTypeForm, breakPaid: true, breakPaid2: true})}
                              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${shiftTypeForm.breakPaid ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20' : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`w-2 h-2 rounded-full ${shiftTypeForm.breakPaid ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                <span className={`text-xs font-bold ${shiftTypeForm.breakPaid ? 'text-emerald-400' : 'text-slate-300'}`}>Dentro (Pagado)</span>
                              </div>
                              <span className="text-[10px] text-slate-400 leading-tight">El descanso computa como tiempo efectivo de trabajo.</span>
                            </button>
                            <button type="button" onClick={() => setShiftTypeForm({...shiftTypeForm, breakPaid: false, breakPaid2: false})}
                              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${!shiftTypeForm.breakPaid ? 'bg-slate-500/10 border-white/20 ring-1 ring-white/10' : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'}`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`w-2 h-2 rounded-full ${!shiftTypeForm.breakPaid ? 'bg-amber-400' : 'bg-slate-500'}`} />
                                <span className={`text-xs font-bold ${!shiftTypeForm.breakPaid ? 'text-white' : 'text-slate-300'}`}>Fuera (No pagado)</span>
                              </div>
                              <span className="text-[10px] text-slate-400 leading-tight">Se resta del total de horas de la jornada.</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">Color Representativo</label>
                    <div className="flex flex-wrap gap-2.5 pt-2 pb-1">
                      {COLOR_PALETTE.map(color => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setShiftTypeForm({ ...shiftTypeForm, hex: color.hex })}
                          className={`w-8 h-8 rounded-full ${color.bg} transition-all flex items-center justify-center ${
                            shiftTypeForm.hex === color.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-dark scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                          }`}
                        >
                          {shiftTypeForm.hex === color.hex && <Check size={14} className="text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview en tiempo real */}
                  {(() => {
                    const toMins = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
                    const fmt = (mins: number) => { const h = Math.floor(Math.abs(mins) / 60); const m = Math.abs(mins) % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; };
                    const fmtTime = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`;

                    const s1 = toMins(shiftTypeForm.start);
                    let e1 = toMins(shiftTypeForm.end);
                    if (e1 <= s1) e1 += 24 * 60;
                    let workedMins = e1 - s1;

                    const bMins1 = shiftTypeForm.breakMins || 0;
                    const bPaid1 = shiftTypeForm.breakPaid;
                    const realExit1Mins = !bPaid1 && bMins1 > 0 ? e1 + bMins1 : e1;
                    const realExit1Str = fmtTime(realExit1Mins);

                    let realExitStr = realExit1Str;
                    let bMins2 = 0; let bPaid2 = false;

                    if (shiftTypeForm.isSplit) {
                      const s2 = toMins(shiftTypeForm.start2);
                      let e2 = toMins(shiftTypeForm.end2);
                      if (e2 <= s2) e2 += 24 * 60;
                      workedMins += e2 - s2;
                      bMins2 = shiftTypeForm.breakMins2 || 0;
                      bPaid2 = shiftTypeForm.breakPaid2;
                      const realExit2Mins = !bPaid2 && bMins2 > 0 ? e2 + bMins2 : e2;
                      realExitStr = fmtTime(realExit2Mins);
                    }

                    const entryStr = shiftTypeForm.start;

                    return (
                      <div className="mt-2 rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resumen de jornada</span>
                        {shiftTypeForm.isSplit ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-1 bg-white/[0.04] rounded-xl p-2.5">
                                <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider">Tramo 1</span>
                                <span className="text-sm font-black text-white">{shiftTypeForm.start} → {realExit1Str}</span>
                                {bMins1 > 0 && <span className="text-[9px] text-slate-400">☕ {bMins1}m {bPaid1 ? '(pagado)' : '(no pagado)'}</span>}
                              </div>
                              <div className="flex flex-col gap-1 bg-white/[0.04] rounded-xl p-2.5">
                                <span className="text-[9px] font-bold text-primary/70 uppercase tracking-wider">Tramo 2</span>
                                <span className="text-sm font-black text-white">{shiftTypeForm.start2} → {realExitStr}</span>
                                {bMins2 > 0 && <span className="text-[9px] text-slate-400">☕ {bMins2}m {bPaid2 ? '(pagado)' : '(no pagado)'}</span>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-0.5">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tiempo trabajado total</span>
                              <span className="text-base font-black text-white">{fmt(workedMins)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Entrada</span>
                                <span className="text-base font-black text-white">{entryStr}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                  {!bPaid1 && bMins1 > 0 ? 'Salida real' : 'Salida'}
                                </span>
                                <span className="text-base font-black text-white">{realExitStr}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tiempo trabajado</span>
                                <span className="text-base font-black text-white">{fmt(workedMins)}</span>
                              </div>
                            </div>
                            {bMins1 > 0 && (
                              <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${bPaid1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                                <span>☕</span>
                                <span><strong>{bMins1} min</strong> — {bPaid1 ? 'retribuido' : `no retribuido (salida a las ${realExitStr})`}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  <div className="pt-4 flex justify-end gap-3 border-t border-white/5 mt-6">
                    <button 
                      type="button" 
                      onClick={() => setIsShiftTypeModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (!shiftTypeForm.name.trim()) return;

                        const startHour = parseInt(shiftTypeForm.start.split(':')[0], 10);
                        const startMin = parseInt(shiftTypeForm.start.split(':')[1], 10);
                        const endHour = parseInt(shiftTypeForm.end.split(':')[0], 10);
                        const endMin = parseInt(shiftTypeForm.end.split(':')[1], 10);
                        const startFraction = startHour + (startMin / 60);
                        let endFraction = endHour + (endMin / 60);
                        if (endFraction < startFraction) endFraction += 24;
                        let duration = endFraction - startFraction;

                        if (shiftTypeForm.isSplit) {
                          const startHour2 = parseInt(shiftTypeForm.start2.split(':')[0], 10);
                          const startMin2 = parseInt(shiftTypeForm.start2.split(':')[1], 10);
                          const endHour2 = parseInt(shiftTypeForm.end2.split(':')[0], 10);
                          const endMin2 = parseInt(shiftTypeForm.end2.split(':')[1], 10);
                          const startFraction2 = startHour2 + (startMin2 / 60);
                          let endFraction2 = endHour2 + (endMin2 / 60);
                          if (endFraction2 < startFraction2) endFraction2 += 24;

                          let startFraction2Adjusted = startFraction2;
                          if (startFraction2Adjusted < startFraction) startFraction2Adjusted += 24;

                          if (startFraction2Adjusted < endFraction) {
                            setValidationError("La hora de entrada del segundo tramo no puede ser anterior a la hora de salida del primer tramo.");
                            return;
                          }

                          duration += (endFraction2 - startFraction2);
                        }

                        // El descanso no retribuido extiende la jornada, no reduce las horas trabajadas

                        const calculatedHours = Math.round(duration * 10) / 10;
                        const colorObj = COLOR_PALETTE.find(c => c.hex === shiftTypeForm.hex) || COLOR_PALETTE[0];

                        const basePayload = {
                          name: shiftTypeForm.name,
                          start: shiftTypeForm.start,
                          end: shiftTypeForm.end,
                          hex: shiftTypeForm.hex,
                          color: colorObj.bg,
                          duration: `${calculatedHours}h`,
                          isSplit: shiftTypeForm.isSplit,
                          start2: shiftTypeForm.isSplit ? shiftTypeForm.start2 : '16:00',
                          end2: shiftTypeForm.isSplit ? shiftTypeForm.end2 : '20:00',
                          breakMins: shiftTypeForm.breakMins,
                          breakPaid: shiftTypeForm.breakPaid,
                          breakMins2: shiftTypeForm.isSplit ? shiftTypeForm.breakMins2 : 0,
                          breakPaid2: shiftTypeForm.isSplit ? shiftTypeForm.breakPaid2 : false,
                          hasPlus: shiftTypeForm.hasPlus
                        };

                        let updatedShiftTypes = [];
                        if (editingShiftTypeId) {
                          updatedShiftTypes = shiftTypes.map(t => t.id === editingShiftTypeId ? {
                            ...t,
                            ...basePayload
                          } : t);
                        } else {
                          const newType = {
                            id: `j-${Date.now()}`,
                            ...basePayload
                          };
                          updatedShiftTypes = [...shiftTypes, newType];
                        }
                        setShiftTypes(updatedShiftTypes);
                        setIsShiftTypeModalOpen(false);
                      }}
                      disabled={!shiftTypeForm.name.trim()}
                      className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                    >
                      {editingShiftTypeId ? 'Guardar Cambios' : 'Añadir'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification (Estilo Fycheo-Web) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none p-4">
        <AnimatePresence mode="popLayout">
          {toastMessage && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg w-full max-w-sm pointer-events-auto bg-emerald-500/10 border-emerald-500/20 bg-surface-dark"
            >
              <div className="shrink-0 mt-0.5">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 text-sm font-medium text-slate-200">
                {toastMessage}
              </div>
              <button 
                onClick={() => setToastMessage(null)}
                className="shrink-0 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Modal: Añadir Política de Tiempo Libre */}
      <AnimatePresence>
        {isLeavePolicyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsLeavePolicyModalOpen(false)}
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
                                <h3 className="text-xl font-bold text-white">
                                  {editingPolicyId ? 'Editar Política' : 'Nueva Política'}
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">Configura reglas dinámicas de permisos y vacaciones.</p>
                            </div>
                            <button onClick={() => setIsLeavePolicyModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!policyForm.name) return;
                            
                            if (editingPolicyId) {
                                setLeavePolicies(leavePolicies.map(p => p.id === editingPolicyId ? { ...policyForm, id: editingPolicyId } : p));
                            } else {
                                setLeavePolicies([...leavePolicies, { ...policyForm, id: `lp-${Date.now()}` }]);
                            }
                            
                            setIsLeavePolicyModalOpen(false);
                            setEditingPolicyId(null);
                        }} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Nombre de la regla</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="Ej: Sábados libres, Vacaciones..."
                                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none"
                                    value={policyForm.name}
                                    onChange={e => setPolicyForm({...policyForm, name: e.target.value})}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Color Identificativo</label>
                                <div className="flex flex-wrap gap-2.5 pt-1.5 pb-1">
                                  {LEAVE_COLOR_PALETTE.map(c => (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      onClick={() => setPolicyForm({...policyForm, hex: c.hex, color: c.bg})}
                                      className={`w-8 h-8 rounded-full ${c.bg} transition-all ${
                                        policyForm.hex === c.hex 
                                        ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-dark scale-110' 
                                        : 'hover:scale-110 opacity-70 hover:opacity-100'
                                      }`}
                                      title={c.name}
                                    />
                                  ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-300">Condiciones de Uso</label>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Cantidad de días */}
                                    <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
                                        <div>
                                            <span className="text-xs font-medium text-slate-400 block mb-2">Días permitidos</span>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    className="w-full px-2 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-center focus:ring-2 focus:ring-primary/50 outline-none"
                                                    value={policyForm.minAmount}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setPolicyForm(prev => ({
                                                            ...prev, 
                                                            minAmount: val,
                                                            maxAmount: Math.max(prev.maxAmount, val)
                                                        }));
                                                    }}
                                                />
                                                <span className="text-slate-500 font-medium">-</span>
                                                <input 
                                                    type="number" 
                                                    min={Math.max(1, policyForm.minAmount)}
                                                    className="w-full px-2 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-center focus:ring-2 focus:ring-primary/50 outline-none"
                                                    value={policyForm.maxAmount}
                                                    onChange={e => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setPolicyForm(prev => ({
                                                            ...prev, 
                                                            maxAmount: val,
                                                            minAmount: Math.min(prev.minAmount, val)
                                                        }));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-between mt-1.5 px-1">
                                            <span className="text-[10px] text-slate-500 font-medium">Mínimo</span>
                                            <span className="text-[10px] text-slate-500 font-medium">Máximo</span>
                                        </div>
                                    </div>

                                    {/* Frecuencia de veces */}
                                    <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
                                        <div>
                                            <span className="text-xs font-medium text-slate-400 block mb-2">Límite de veces</span>
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-full flex items-center">
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        className="w-full pl-2 pr-6 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-center focus:ring-2 focus:ring-primary/50 outline-none"
                                                        value={policyForm.maxTimes}
                                                        onChange={e => setPolicyForm({...policyForm, maxTimes: parseInt(e.target.value) || 0})}
                                                    />
                                                </div>
                                                <span className="text-slate-500 text-xs font-medium">al</span>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsLimitPeriodDropdownOpen(!isLimitPeriodDropdownOpen)}
                                                        className="w-24 px-2 py-2 bg-black/50 border border-white/10 rounded-lg text-white hover:border-white/20 focus:ring-2 focus:ring-primary/50 transition-all flex items-center justify-between outline-none"
                                                    >
                                                        <span className="text-sm font-medium">
                                                            {policyForm.limitPeriod === 'week' ? 'Semana' : policyForm.limitPeriod === 'month' ? 'Mes' : 'Año'}
                                                        </span>
                                                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isLimitPeriodDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    <AnimatePresence>
                                                        {isLimitPeriodDropdownOpen && (
                                                            <>
                                                                <div 
                                                                    className="fixed inset-0 z-40"
                                                                    onClick={() => setIsLimitPeriodDropdownOpen(false)}
                                                                />
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: -10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: -10 }}
                                                                    className="absolute z-50 w-full mt-2 py-1 bg-surface-dark border border-white/10 rounded-xl shadow-xl"
                                                                >
                                                                    {[
                                                                        { value: 'week', label: 'Semana' },
                                                                        { value: 'month', label: 'Mes' },
                                                                        { value: 'year', label: 'Año' }
                                                                    ].map(option => (
                                                                        <button
                                                                            key={option.value}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setPolicyForm({...policyForm, limitPeriod: option.value as any});
                                                                                setIsLimitPeriodDropdownOpen(false);
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                                                                policyForm.limitPeriod === option.value
                                                                                ? 'bg-primary/20 text-primary font-medium'
                                                                                : 'text-slate-300 hover:bg-white/5'
                                                                            }`}
                                                                        >
                                                                            {option.label}
                                                                        </button>
                                                                    ))}
                                                                </motion.div>
                                                            </>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between mt-1.5 px-1">
                                            <span className="text-[10px] text-slate-500">0 = ilimitadas veces</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5">
                                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>Ejemplo: 15 días en total, repartidos en 2 veces al año máximo.</span>
                                </p>

                                {/* Opción de días consecutivos - solo visible si la unidad es 'días' */}
                                {policyForm.limitUnit === 'days' && (
                                  <div className="mt-2">
                                    <span className="text-xs font-medium text-slate-400 block mb-2">Tipo de días</span>
                                    <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 relative">
                                      <button
                                        type="button"
                                        onClick={() => setPolicyForm({...policyForm, consecutiveDays: true})}
                                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all z-10 ${
                                          policyForm.consecutiveDays !== false ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-300'
                                        }`}
                                      >
                                        📆 Consecutivos
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPolicyForm({...policyForm, consecutiveDays: false})}
                                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all z-10 ${
                                          policyForm.consecutiveDays === false ? 'text-sky-400' : 'text-slate-400 hover:text-slate-300'
                                        }`}
                                      >
                                        ✨ Sueltos
                                      </button>
                                      {/* Fondo animado */}
                                      <div
                                        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out z-0"
                                        style={{
                                          left: policyForm.consecutiveDays !== false ? '4px' : 'calc(50%)',
                                          backgroundColor: policyForm.consecutiveDays !== false ? 'rgba(99,102,241,0.12)' : 'rgba(14,165,233,0.12)',
                                          border: `1px solid ${policyForm.consecutiveDays !== false ? 'rgba(99,102,241,0.3)' : 'rgba(14,165,233,0.3)'}`
                                        }}
                                      />
                                    </div>
                                    <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-2">
                                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                      {policyForm.consecutiveDays !== false
                                        ? <span>Los días deben pedirse de forma seguida (ej: del lunes al miércoles).</span>
                                        : <span>Los días pueden pedirse por separado en cualquier momento del período.</span>
                                      }
                                    </div>
                                  </div>
                                )}
                            </div>

                            <div className="flex flex-col space-y-2 pt-3 border-t border-white/5">
                              <label className="text-sm font-semibold text-slate-300">Compensación del Permiso</label>
                              <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 relative">
                                <button 
                                  type="button" 
                                  onClick={() => setPolicyForm({...policyForm, isPaid: true})}
                                  className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all z-10 ${
                                    policyForm.isPaid !== false ? 'text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-300'
                                  }`}
                                >
                                  💰 Retribuido
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => setPolicyForm({...policyForm, isPaid: false})}
                                  className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all z-10 ${
                                    policyForm.isPaid === false ? 'text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-300'
                                  }`}
                                >
                                  ⏳ A Recuperar
                                </button>
                                {/* Indicador de fondo animado */}
                                <div 
                                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out z-0"
                                  style={{
                                    left: policyForm.isPaid !== false ? '4px' : 'calc(50%)',
                                    backgroundColor: policyForm.isPaid !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                    border: `1px solid ${policyForm.isPaid !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                  }}
                                />
                              </div>
                                <div className="text-xs text-slate-500 mt-2 min-h-[2.5rem]">
                                  {policyForm.isPaid !== false 
                                    ? <div className="flex items-start gap-1.5 text-slate-400">
                                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>Al usar este permiso, el trabajador mantendrá su sueldo intacto y no tendrá que devolver las horas.</span>
                                      </div>
                                    : <div className="flex items-start gap-1.5 text-slate-400">
                                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>El tiempo usado en este permiso no está pagado por la empresa y el trabajador deberá recuperarlo.</span>
                                      </div>
                                  }
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                                <button 
                                    type="button" 
                                    onClick={() => setIsLeavePolicyModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                                >
                                    <CheckCircle size={18} /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;
