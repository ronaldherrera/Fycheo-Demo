import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, UserPlus, ChevronDown, ChevronRight, X, Mail, Shield, Pencil, Trash2, AlertTriangle, Search, ClipboardList, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ImportEmployeesModal } from '../components/ImportEmployeesModal';
import { employeeService } from '../services/employeeService';
import { teamService } from '../services/teamService';
import { shiftService } from '../services/shiftService';
import { absenceService } from '../services/absenceService';
import { settingsService, type CompanySettings } from '../services/settingsService';
import { logService } from '../services/logService';
import { taskService, type TaskType, type TaskPriority, type Task } from '../services/taskService';
import { useAuth } from '../contexts/AuthContext';
import type { Employee, Team, EmployeeRole, Shift, Absence } from '../types';
import { calculateBasicStats } from '../utils/statsUtils';

const roleLabels: Record<EmployeeRole, { label: string }> = {
  admin: { label: 'Administrador' },
  hr: { label: 'Recursos Humanos' },
  manager: { label: 'Manager' },
  employee: { label: 'Base' },
};

const Teams = () => {
  const { activeCompany, profile } = useAuth();
  const isAdminOrHr = activeCompany?.role === 'admin' || activeCompany?.role === 'hr';
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Estados para datos reales
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [directoryTab, setDirectoryTab] = useState<'all' | 'pending'>('all');

  // Precálculo de Estadísticas (Rendimiento)
  const employeeStats = useMemo(() => {
    const statsMap: Record<string, ReturnType<typeof calculateBasicStats>> = {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    employees.forEach(emp => {
      statsMap[emp.id] = calculateBasicStats(emp.id, shifts, timeEntries, absences, monthStart, monthEnd);
    });
    return statsMap;
  }, [employees, shifts, timeEntries, absences]);  // Modal State: Add Member
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedTeamForAdd, setSelectedTeamForAdd] = useState<string | null>(null);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState<Exclude<EmployeeRole, 'admin'>>('employee');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Modal State: Create/Edit Team
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);

  // Modal State: Delete Team
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal State: Quitar del equipo
  const [isDeleteEmpModalOpen, setIsDeleteEmpModalOpen] = useState(false);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [deleteEmpConfirmationText, setDeleteEmpConfirmationText] = useState('');
  const [isDeletingEmp, setIsDeletingEmp] = useState(false);

  // Modal State: Eliminar de la empresa
  const [isRemoveFromCompanyModalOpen, setIsRemoveFromCompanyModalOpen] = useState(false);
  const [empToRemove, setEmpToRemove] = useState<Employee | null>(null);
  const [removeConfirmationText, setRemoveConfirmationText] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  const [isTeamPermModalOpen, setIsTeamPermModalOpen] = useState(false);
  const [teamForPerms, setTeamForPerms] = useState<Team | null>(null);
  const [activeTeamPerms, setActiveTeamPerms] = useState<Record<string, string[]>>({});
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [activePermKey, setActivePermKey] = useState<string | null>(null);
  const [teamPermsSearchQuery, setTeamPermsSearchQuery] = useState('');

  // Modal State: Asignar Tarea
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTeamId, setTaskTeamId] = useState<string | null>(null);
  const [taskTeamEmployees, setTaskTeamEmployees] = useState<Employee[]>([]);
  const [taskSelectedRecipients, setTaskSelectedRecipients] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<TaskType>('task');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('normal');
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSuccess, setTaskSuccess] = useState<string | null>(null);

  // Seguimiento de tareas por equipo
  const [activeTabByTeam, setActiveTabByTeam] = useState<Record<string, 'members' | 'tasks'>>({});
  const [teamTasks, setTeamTasks] = useState<Record<string, Task[]>>({});
  const [loadingTasksFor, setLoadingTasksFor] = useState<string | null>(null);
  const [taskViewFilter, setTaskViewFilter] = useState<Record<string, 'all' | 'pending' | 'done'>>({});
  const [taskPersonFilter, setTaskPersonFilter] = useState<Record<string, string>>({});

  const teamPermissionList = [
    { key: 'is_manager', label: 'Rol de Responsable', desc: 'Otorga funciones de Responsable del equipo sin alterar su cargo real.' },
    { key: 'view_schedules', label: 'Ver Turnos', desc: 'Permite ver los horarios de todos los miembros del equipo.' },
    { key: 'edit_schedules', label: 'Modificar Turnos', desc: 'Permite crear, editar y eliminar turnos del equipo.' },
    { key: 'manage_timeoff', label: 'Gestionar Vacaciones', desc: 'Permite aprobar o rechazar solicitudes de este equipo.' },
    { key: 'view_team_reports', label: 'Ver Analíticas', desc: 'Permite acceder a los reportes de horas y ausencias de este equipo.' }
  ];

  useEffect(() => {
    loadData();
  }, [activeCompany?.id]);

  const loadData = async () => {
    if (!activeCompany?.id) return;
    try {
      setLoading(true);
      const [teamsData, empData, settingsData] = await Promise.all([
         teamService.getTeams(activeCompany.id),
         employeeService.getEmployees(activeCompany.id),
         settingsService.getCompanySettings(activeCompany.id)
      ]);
      
      const mappedEmployees = empData.map((emp) => ({
          ...emp,
          name: emp.full_name || emp.name || (emp.email ? emp.email.split('@')[0] : 'Sin correo'),
      }));

      setTeams(teamsData);
      setCompanySettings(settingsData || null);
      setEmployees(mappedEmployees);

      // Descargar datos reales para estadísticas
      const userIds = mappedEmployees.map(e => e.id);
      if (userIds.length > 0) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        
        const [fetchedShifts, fetchedAbsences, fetchedEntries] = await Promise.all([
          shiftService.getShifts(activeCompany.id),
          absenceService.getAbsences(activeCompany.id).catch(() => []),
          employeeService.getTimeEntriesForUsers(userIds, startOfMonth, endOfMonth).catch(() => [])
        ]);

        setShifts(fetchedShifts);
        setAbsences(fetchedAbsences);
        setTimeEntries(fetchedEntries);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers para Miembros ---
  const openMemberModal = (teamId: string) => {
      setSelectedTeamForAdd(teamId);
      setAddEmail('');
      setAddName('');
      setAddRole('employee');
      setAddError(null);
      setAddSuccess(null);
      setIsMemberModalOpen(true);
  };

  const handleAddMember = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTeamForAdd || !addEmail.trim() || !activeCompany?.id) return;
      
      setIsAdding(true);
      setAddError(null);
      setAddSuccess(null);

      try {
          const user = await employeeService.searchUserByEmail(addEmail);
          if (!user) throw new Error("El usuario no está registrado en la App de Fycheo. Pídele que se registre primero.");
          
          // 1. Vincular a la empresa (si ya pertenece, solo actualizamos el equipo)
          try {
            await employeeService.linkUserToCompany(user.id, activeCompany.id, addRole, selectedTeamForAdd);
          } catch (linkErr: any) {
            if (linkErr.message?.includes('ya pertenece')) {
              await employeeService.updateEmployee(user.id, activeCompany.id, { team_id: selectedTeamForAdd });
            } else {
              throw linkErr;
            }
          }
          
          // 2. Sincronizar el nombre si el administrador lo rellenó
          if (addName.trim()) {
              try {
                  await employeeService.updateEmployeeProfileName(user.id, addName.trim());
              } catch (updateErr) {
                  console.error("Error al actualizar el nombre del perfil del empleado:", updateErr);
              }
          }
          
          setAddSuccess(`${addName.trim() || user.full_name || user.email} ha sido añadido con éxito.`);
          await loadData();
          setTimeout(() => setIsMemberModalOpen(false), 2000);
      } catch (err: any) {
          setAddError(err.message || "Error al añadir al usuario.");
      } finally {
          setIsAdding(false);
      }
  };

  // --- Handlers para Equipos ---
  const openCreateTeamModal = () => {
      setEditingTeam(null);
      setTeamName('');
      setTeamDesc('');
      setIsTeamModalOpen(true);
  };

  const openEditTeamModal = (team: Team) => {
      setEditingTeam(team);
      setTeamName(team.name);
      setTeamDesc(team.description || '');
      setIsTeamModalOpen(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeCompany?.id || !teamName.trim()) return;

      setIsSavingTeam(true);
      try {
          if (editingTeam) {
              await teamService.updateTeam(editingTeam.id, { name: teamName, description: teamDesc });
          } else {
              await teamService.createTeam({ name: teamName, description: teamDesc, company_id: activeCompany.id });
          }
          await loadData();
          setIsTeamModalOpen(false);
      } catch (err) {
          console.error(err);
          alert("Error al guardar el equipo");
      } finally {
          setIsSavingTeam(false);
      }
  };

  // --- Handlers para Eliminar Equipo ---
  const openDeleteModal = (team: Team) => {
      setTeamToDelete(team);
      setDeleteConfirmationText('');
      setIsDeleteModalOpen(true);
  };

  const requiredConfirmationString = teamToDelete && activeCompany ? `eliminar equipo ${teamToDelete.name} de ${activeCompany.name}` : '';
  const canDelete = deleteConfirmationText.trim().toLowerCase() === requiredConfirmationString.toLowerCase();

  const handleDeleteTeam = async () => {
      if (!teamToDelete || !canDelete) return;
      setIsDeleting(true);
      try {
          await teamService.deleteTeam(teamToDelete.id);
          setExpandedTeamId(null);
          await loadData();
          setIsDeleteModalOpen(false);
      } catch (err) {
          console.error(err);
          alert("Error al eliminar el equipo");
      } finally {
          setIsDeleting(false);
      }
  };

  // --- Handlers para Eliminar Empleado ---
  const openDeleteEmpModal = (emp: Employee) => {
      setEmpToDelete(emp);
      setDeleteEmpConfirmationText('');
      setIsDeleteEmpModalOpen(true);
  };

  const requiredEmpConfirmationString = empToDelete ? `quitar a ${empToDelete.name} del equipo` : '';
  const canDeleteEmp = deleteEmpConfirmationText.trim().toLowerCase() === requiredEmpConfirmationString.toLowerCase();

  const handleDeleteEmp = async () => {
      if (!empToDelete || !activeCompany?.id || !canDeleteEmp) return;
      setIsDeletingEmp(true);
      try {
          await employeeService.updateEmployee(empToDelete.id, activeCompany.id, { team_id: null });
          await loadData();
          setIsDeleteEmpModalOpen(false);
      } catch (err) {
          console.error(err);
          alert("Error al quitar al empleado del equipo");
      } finally {
          setIsDeletingEmp(false);
      }
  };


  const requiredRemoveString = empToRemove ? `eliminar a ${empToRemove.name} de la empresa` : '';
  const canRemove = removeConfirmationText.trim().toLowerCase() === requiredRemoveString.toLowerCase();

  const handleRemoveFromCompany = async () => {
      if (!empToRemove || !activeCompany?.id || !canRemove) return;
      if (empToRemove.role === 'admin') return;
      setIsRemoving(true);
      try {
          await employeeService.unlinkUserFromCompany(empToRemove.id, activeCompany.id);
          await loadData();
          setIsRemoveFromCompanyModalOpen(false);
          setEmpToRemove(null);
          setRemoveConfirmationText('');
      } catch (err) {
          console.error(err);
          alert("Error al eliminar al empleado de la empresa");
      } finally {
          setIsRemoving(false);
      }
  };

  // --- Handlers para Tareas ---
  const openTaskModal = (teamId: string, teamEmps: Employee[]) => {
    setTaskTeamId(teamId);
    setTaskTeamEmployees(teamEmps);
    setTaskSelectedRecipients(teamEmps.map(e => e.id));
    setTaskType('task');
    setTaskTitle('');
    setTaskDesc('');
    setTaskDueDate('');
    setTaskPriority('normal');
    setTaskError(null);
    setTaskSuccess(null);
    setIsTaskModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany?.id || !taskTeamId || !taskTitle.trim() || !profile?.id || taskSelectedRecipients.length === 0) return;
    setIsSavingTask(true);
    setTaskError(null);
    setTaskSuccess(null);
    try {
      await taskService.createTask(
        {
          company_id:      activeCompany.id,
          assigned_to:     'ALL',
          team_id:         taskTeamId,
          type:            taskType,
          title:           taskTitle.trim(),
          description:     taskDesc.trim() || undefined,
          due_date:        taskDueDate || null,
          priority:        taskPriority,
          team_member_ids: taskSelectedRecipients,
        },
        profile.id
      );
      const recipientLabel =
        taskSelectedRecipients.length === taskTeamEmployees.length
          ? `todos los miembros (${taskSelectedRecipients.length})`
          : taskSelectedRecipients.length === 1
            ? taskTeamEmployees.find(e => e.id === taskSelectedRecipients[0])?.name ?? 'el empleado'
            : `${taskSelectedRecipients.length} miembros`;
      setTaskSuccess(`${taskType === 'task' ? 'Tarea' : 'Aviso'} enviado a ${recipientLabel} ✓`);
      if (taskTeamId) loadTeamTasks(taskTeamId);
      setTimeout(() => setIsTaskModalOpen(false), 1800);
    } catch (err: any) {
      setTaskError(err.message || 'Error al crear la tarea');
    } finally {
      setIsSavingTask(false);
    }
  };

  // --- Handlers para Seguimiento de Tareas ---
  const loadTeamTasks = async (teamId: string) => {
    setLoadingTasksFor(teamId);
    try {
      const tasks = await taskService.getTasksByTeam(teamId);
      setTeamTasks(prev => ({ ...prev, [teamId]: tasks }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTasksFor(null);
    }
  };

  const handleDeleteTask = async (taskId: string, teamId: string) => {
    try {
      await taskService.deleteTask(taskId);
      setTeamTasks(prev => ({
        ...prev,
        [teamId]: (prev[teamId] || []).filter(t => t.id !== taskId),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const switchTab = (teamId: string, tab: 'members' | 'tasks') => {
    setActiveTabByTeam(prev => ({ ...prev, [teamId]: tab }));
    if (tab === 'tasks') loadTeamTasks(teamId);
  };

  // --- Handlers para Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, empId: string) => {

    if (!isAdminOrHr) return;
    e.dataTransfer.setData('empId', empId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necesario para permitir el drop
  };

  const handleDrop = async (e: React.DragEvent, teamId: string) => {
    e.preventDefault();
    if (!isAdminOrHr || !activeCompany?.id) return;
    const empId = e.dataTransfer.getData('empId');
    if (!empId) return;

    // Actualización optimista local
    setEmployees(prev => prev.map(emp => 
      emp.id === empId ? { ...emp, team_id: teamId } : emp
    ));

    try {
      await employeeService.updateEmployee(empId, activeCompany.id, { team_id: teamId });
      
      const movedEmp = employees.find(e => e.id === empId);
      const targetTeam = teams.find(t => t.id === teamId);
      if (movedEmp && targetTeam && profile) {
        await logService.logAction(
          activeCompany.id,
          profile.id,
          'team_changed',
          `Movió a ${movedEmp.name} al equipo ${targetTeam.name}`,
          { employee_id: empId, team_id: teamId, affected: movedEmp.name }
        );
      }
    } catch (error) {
      console.error('Error moviendo empleado:', error);
      // Revertir en caso de error (idealmente recargar data)
      await loadData();
    }
  };

  // Filtrar empleados por equipo, búsqueda y estado
  const getTeamEmployees = (teamId: string) => {
    return employees.filter(e => {
      if (e.team_id !== teamId) return false;
      
      // Filtro de búsqueda
      if (searchQuery && !e.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Filtro de estado
      if (statusFilter !== 'all') {
        const stats = employeeStats[e.id];
        // Si no está aceptado, no tendrá stats, ignorar filtro o tratarlo
        if (e.accepted === false) return false;
        if (!stats) return false;
        
        if (statusFilter === 'working' && stats.state.label !== 'Trabajando') return false;
        if (statusFilter === 'sick' && stats.state.label !== 'Baja') return false;
        if (statusFilter === 'vacation' && stats.state.label !== 'Vacaciones') return false;
        if (statusFilter === 'permission' && stats.state.label !== 'Permiso') return false;
        if (statusFilter === 'absent' && ['Baja', 'Vacaciones', 'Trabajando', 'Permiso', 'Descansando'].includes(stats.state.label)) return false;
      }
      
      return true;
    });
  };

  // --- Handlers para Permisos de Equipo ---
  const openTeamPermsModal = (team: Team) => {
      setTeamForPerms(team);
      setActiveTeamPerms(companySettings?.team_permissions?.[team.id] || {});
      setActivePermKey(null);
      setTeamPermsSearchQuery('');
      setIsTeamPermModalOpen(true);
  };

  const handleSaveTeamPerms = async () => {
      if (!teamForPerms || !activeCompany?.id) return;
      setIsSavingPerms(true);
      try {
          // Guardar permisos granulares en settings
          const currentSettings = companySettings || { schedule: {}, general: { tolerance: '0', timezone: 'Europe/Madrid' } } as CompanySettings;
          const newTeamPermissions = {
              ...(currentSettings.team_permissions || {}),
              [teamForPerms.id]: activeTeamPerms
          };
          
          await settingsService.updateCompanySettings(activeCompany.id, {
              ...currentSettings,
              team_permissions: newTeamPermissions
          });
          
          await loadData();
          setIsTeamPermModalOpen(false);
      } catch (err) {
          console.error(err);
          alert("Error al guardar permisos del equipo");
      } finally {
          setIsSavingPerms(false);
      }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipos</h1>
          <p className="text-slate-400 text-sm">Gestiona la estructura y añade personal</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-slate-800 text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors shadow-sm border border-white/5">
            <UserPlus size={20} />
            <span className="hidden sm:inline">Importar CSV</span>
          </button>
          {isAdminOrHr && (
            <button onClick={openCreateTeamModal} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20">
              <Plus size={20} />
              <span>Nuevo Equipo</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de Equipos */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-surface-dark border border-white/5 rounded-2xl p-12 text-center">
             <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                 <Users size={32} />
             </div>
             <h3 className="text-lg font-bold text-white mb-2">No hay equipos</h3>
             <p className="text-slate-400 max-w-md mx-auto mb-6">Aún no has creado ningún equipo para tu organización. Empieza creando uno para organizar a tu personal.</p>
             {isAdminOrHr && (
               <button onClick={openCreateTeamModal} className="bg-primary text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                   Crear mi primer equipo
               </button>
             )}
          </div>
        ) : (
          <>
             {/* Barra de Filtros y Búsqueda */}
             <div className="flex flex-col sm:flex-row gap-4 mb-6">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                 <input 
                   type="text" 
                   placeholder="Buscar empleado por nombre..." 
                   className="w-full pl-10 pr-4 py-2.5 bg-surface-dark border border-white/5 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/50 outline-none"
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                 />
               </div>
               <div className="w-full flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                 <button onClick={() => setStatusFilter('all')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === 'all' ? 'bg-white/10 text-white' : 'bg-surface-dark text-slate-400 hover:text-white border border-white/5'}`}>Todos</button>
                 <button onClick={() => setStatusFilter('working')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${statusFilter === 'working' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-surface-dark text-slate-400 hover:text-emerald-400 border border-white/5'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Trabajando
                 </button>
                 <button onClick={() => setStatusFilter('absent')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${statusFilter === 'absent' ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' : 'bg-surface-dark text-slate-400 hover:text-slate-300 border border-white/5'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div> Ausentes
                 </button>
                 <button onClick={() => setStatusFilter('vacation')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${statusFilter === 'vacation' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-surface-dark text-slate-400 hover:text-amber-400 border border-white/5'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Vacaciones
                 </button>
                 <button onClick={() => setStatusFilter('sick')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${statusFilter === 'sick' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-surface-dark text-slate-400 hover:text-red-400 border border-white/5'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> Bajas
                 </button>
                 <button onClick={() => setStatusFilter('permission')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${statusFilter === 'permission' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 'bg-surface-dark text-slate-400 hover:text-pink-400 border border-white/5'}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div> Permisos
                 </button>
               </div>
             </div>

             {teams.map((team, i) => {
            const teamEmployees = getTeamEmployees(team.id);
            const globalManagers = employees.filter(emp => emp.role === 'admin' || emp.role === 'hr');
            
            const teamManagerIds = companySettings?.team_permissions?.[team.id]?.is_manager || [];
            const specificManagers = teamEmployees.filter(emp => emp.role === 'manager' || teamManagerIds.includes(emp.id));
            
            // Combinar y eliminar duplicados
            const allManagers = [...globalManagers, ...specificManagers];
            const teamManagers = allManagers.filter((emp, index, self) => 
                index === self.findIndex((t) => t.id === emp.id)
            );
            const isExpanded = expandedTeamId === team.id;
            const activeTab = activeTabByTeam[team.id] || 'members';
            const tasks = teamTasks[team.id] || [];
            const pendingCount = tasks.filter(t => t.status === 'pending').length;
            const taskFilter = taskViewFilter[team.id] || 'all';
            const personFilter = taskPersonFilter[team.id] || 'ALL';
            const filteredTasks = tasks.filter(t => {
              if (taskFilter !== 'all' && t.status !== taskFilter) return false;
              if (personFilter !== 'ALL' && t.assigned_to !== personFilter) return false;
              return true;
            });
            const today = new Date().toISOString().split('T')[0];

            return (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={team.id} 
                className="bg-surface-dark rounded-2xl border border-white/5 shadow-sm overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, team.id)}
              >
                {/* Cabecera del Equipo */}
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors group"
                  onClick={() => {
                    const next = isExpanded ? null : team.id;
                    setExpandedTeamId(next);
                    if (next) loadTeamTasks(next);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                      <Users size={24} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{team.name}</h3>
                      <p className="text-sm text-slate-400">{team.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Botones de acción del equipo */}
                    {isAdminOrHr && (
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openTeamPermsModal(team)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Permisos del Equipo">
                              <Shield size={18} />
                          </button>
                          <button onClick={() => openEditTeamModal(team)} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Editar Equipo">
                              <Pencil size={18} />
                          </button>
                          <button onClick={() => openDeleteModal(team)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Eliminar Equipo">
                              <Trash2 size={18} />
                          </button>
                      </div>
                    )}

                    <div className="text-slate-400 p-1 bg-black/20 rounded-lg ml-2">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </div>
                </div>

                {/* Contenido Expandible */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-black/20"
                    >
                      {/* Tab bar */}
                      <div className="flex items-center justify-between px-5 border-b border-white/5" onClick={e => e.stopPropagation()}>
                        <div className="flex">
                          <button
                            onClick={() => setActiveTabByTeam(prev => ({ ...prev, [team.id]: 'members' }))}
                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'members' ? 'border-primary text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
                          >
                            Miembros ({teamEmployees.length})
                          </button>
                          <button
                            onClick={() => switchTab(team.id, 'tasks')}
                            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tasks' ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-400 hover:text-amber-300'}`}
                          >
                            Tareas
                            {pendingCount > 0 && (
                              <span className="bg-amber-500/20 text-amber-400 text-[11px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                                {pendingCount}
                              </span>
                            )}
                          </button>
                        </div>
                        {isAdminOrHr && (
                          <div className="flex items-center gap-2">
                            {activeTab === 'tasks' && (
                              <button
                                onClick={() => openTaskModal(team.id, teamEmployees)}
                                className="text-xs font-semibold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                              >
                                <ClipboardList size={14} /> Asignar tarea
                              </button>
                            )}
                            {activeTab === 'members' && (
                              <button
                                onClick={() => openMemberModal(team.id)}
                                className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                              >
                                <UserPlus size={14} /> Añadir miembro
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tab content */}
                      <div className="p-4 sm:p-5">
                        {activeTab === 'members' ? (
                          <>
                            {teamManagers.length > 0 && (
                              <details className="mb-6 px-1 group">
                                <summary className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 select-none hover:text-white transition-colors w-fit">
                                  <ChevronRight size={16} className="group-open:rotate-90 transition-transform" />
                                  Responsables ({teamManagers.length})
                                </summary>
                                <div className="flex flex-wrap gap-3 mt-2 pl-6">
                                  {teamManagers.map(mgr => (
                                    <Link key={mgr.id} to={`/manager/equipos/trabajador/${mgr.id}`} className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg w-fit hover:bg-primary/20 hover:border-primary/40 transition-all">
                                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold overflow-hidden border border-primary/30 shrink-0">
                                          {mgr.avatar ? (
                                              <img src={mgr.avatar} alt={mgr.name} className="w-full h-full object-cover" />
                                          ) : (
                                              (mgr.name || mgr.email).charAt(0).toUpperCase()
                                          )}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium text-blue-400 leading-none">{mgr.name}</span>
                                        <span className="text-xs text-blue-400/70 mt-0.5">{roleLabels[mgr.role]?.label || mgr.role}</span>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              </details>
                            )}

                            {teamEmployees.length === 0 ? (
                              <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">
                                No hay empleados en este equipo todavía.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {teamEmployees.map(emp => {
                                  const stats = employeeStats[emp.id] || {
                                    state: { label: 'Fuera de turno', colorClass: 'text-slate-400', bgClass: 'bg-slate-400' },
                                    hoursFormatted: '+00:00',
                                    totalMinutes: 0,
                                    punctuality: 100,
                                    punctualityColor: 'text-emerald-400'
                                  };
                                  return (
                                    <div
                                      key={emp.id}
                                      className="flex items-center justify-between p-3 rounded-xl bg-surface-dark border border-white/5 hover:border-white/10 transition-colors group/emp"
                                      draggable={isAdminOrHr}
                                      onDragStart={(e) => handleDragStart(e, emp.id)}
                                    >
                                      <Link to={`/manager/equipos/trabajador/${emp.id}`} className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 text-sm font-bold overflow-hidden border border-white/10 shrink-0">
                                           {emp.avatar ? (
                                               <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                           ) : (
                                               (emp.name || emp.email).charAt(0).toUpperCase()
                                           )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="font-medium text-slate-200 text-sm truncate group-hover/emp:text-primary transition-colors">{emp.name}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[11px] text-slate-500 block truncate">{roleLabels[emp.role]?.label || emp.role}</span>
                                            {emp.accepted === false ? (
                                                <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400 truncate">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></div>
                                                    Invitación Pendiente
                                                </span>
                                            ) : (
                                                <span className={`flex items-center gap-1.5 text-[11px] font-medium ${stats.state.colorClass} truncate`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${stats.state.bgClass} shrink-0`}></div>
                                                    {stats.state.label}
                                                </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      <div className="flex items-center gap-3 shrink-0 pl-2">
                                        {emp.accepted === false ? (
                                           <div className="hidden sm:flex flex-col items-end mr-1">
                                              <span className="text-[11px] font-medium text-slate-500">--:--h</span>
                                              <span className="text-[10px] text-slate-500 mt-0.5 font-medium">--% punt.</span>
                                           </div>
                                        ) : (
                                           <div className="hidden sm:flex flex-col items-end mr-1">
                                              <span className="text-[11px] font-medium text-slate-300">{stats.hoursFormatted}h</span>
                                              <span className={`text-[10px] ${stats.punctualityColor} mt-0.5 font-medium`}>{stats.punctuality}% punt.</span>
                                           </div>
                                        )}
                                        {isAdminOrHr && (
                                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDeleteEmpModal(emp); }} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 opacity-100 md:opacity-0 md:group-hover/emp:opacity-100 transition-all shrink-0" title="Eliminar del equipo">
                                            <Trash2 size={16} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          /* Vista de Tareas */
                          <>
                            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                {(['all', 'pending', 'done'] as const).map(f => (
                                  <button
                                    key={f}
                                    onClick={() => setTaskViewFilter(prev => ({ ...prev, [team.id]: f }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                                      taskFilter === f
                                        ? f === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                          : f === 'done'  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                          : 'bg-white/10 text-white border-white/15'
                                        : 'text-slate-400 hover:text-white bg-black/20 border-white/5'
                                    }`}
                                  >
                                    {f === 'all'     && `Todas (${tasks.length})`}
                                    {f === 'pending' && `Pendientes (${tasks.filter(t => t.status === 'pending').length})`}
                                    {f === 'done'    && `Completadas (${tasks.filter(t => t.status === 'done').length})`}
                                  </button>
                                ))}
                              </div>
                              <div className="w-72 shrink-0">
                                <CustomSelect
                                  value={personFilter}
                                  onChange={val => setTaskPersonFilter(prev => ({ ...prev, [team.id]: val }))}
                                  options={[
                                    { value: 'ALL', label: 'Todos los miembros' },
                                    ...employees
                                      .filter(e => e.team_id === team.id)
                                      .map(emp => ({ value: emp.id, label: emp.name || emp.email })),
                                  ]}
                                  size="sm"
                                  icon={<Users size={14} />}
                                  searchable
                                />
                              </div>
                            </div>

                            {loadingTasksFor === team.id ? (
                              <div className="py-10 flex items-center justify-center">
                                <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                              </div>
                            ) : filteredTasks.length === 0 ? (
                              <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">
                                {tasks.length === 0 ? 'No hay tareas asignadas a este equipo.' : 'No hay tareas con este filtro.'}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {filteredTasks.map(task => {
                                  const isOverdue = task.status === 'pending' && !!task.due_date && task.due_date < today;
                                  const assigneeName = employees.find(e => e.id === task.assigned_to)?.name
                                    || task.assignee?.full_name || task.assignee?.email || '—';
                                  const priorityColors: Record<string, string> = {
                                    low:    'bg-slate-500/20 text-slate-400 border-slate-500/30',
                                    normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                    high:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
                                    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
                                  };
                                  const priorityLabels: Record<string, string> = {
                                    low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente',
                                  };
                                  return (
                                    <div
                                      key={task.id}
                                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors group/task ${
                                        task.status === 'done'
                                          ? 'bg-black/10 border-white/5 opacity-60'
                                          : 'bg-surface-dark border-white/5 hover:border-white/10'
                                      }`}
                                    >
                                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${task.status === 'done' ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-amber-500'}`} />

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-2 flex-wrap">
                                          <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                                            {task.title}
                                          </span>
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${priorityColors[task.priority]}`}>
                                            {priorityLabels[task.priority]}
                                          </span>
                                          {task.type === 'notice' && (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border bg-blue-500/20 text-blue-400 border-blue-500/30 shrink-0">
                                              Aviso
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                          <span className="text-[11px] text-slate-500">
                                            Para: <span className="text-slate-400">{assigneeName}</span>
                                          </span>
                                          {task.due_date && (
                                            <span className={`text-[11px] ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                                              {isOverdue ? '⚠ ' : ''}{new Date(task.due_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}{isOverdue ? ' · Vencida' : ''}
                                            </span>
                                          )}
                                          {task.status === 'done' && task.done_at && (
                                            <span className="text-[11px] text-emerald-600">
                                              ✓ {new Date(task.done_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {isAdminOrHr && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id, team.id); }}
                                          className="p-1.5 text-slate-600 hover:text-red-400 rounded-lg hover:bg-red-500/10 opacity-0 group-hover/task:opacity-100 transition-all shrink-0"
                                          title="Eliminar tarea"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          </>
        )}
      </div>

      {/* ======================================================== */}
      {/* DIRECTORIO DE EMPLEADOS */}
      {/* ======================================================== */}
      <div className="mt-12 mb-12">
        <div className="mb-6 border-b border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end">
          <div className="flex-1 overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users size={24} className="text-primary" /> Directorio de Empleados
            </h2>
            <div className="flex gap-6 overflow-x-auto hide-scrollbar">
               <button 
                 onClick={() => setDirectoryTab('all')}
                 className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${directoryTab === 'all' ? 'border-primary text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
               >
                 Sin Equipo ({employees.filter(e => !e.team_id && e.accepted !== false).length})
               </button>
               <button 
                 onClick={() => setDirectoryTab('pending')}
                 className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${directoryTab === 'pending' ? 'border-amber-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
               >
                 Pendientes de Registro
                 {employees.filter(e => e.accepted === false).length > 0 && (
                   <span className="bg-amber-500/20 text-amber-400 py-0.5 px-2 rounded-full text-[10px]">
                     {employees.filter(e => e.accepted === false).length}
                   </span>
                 )}
               </button>
            </div>
          </div>
        </div>

        <div className="bg-surface-dark border border-white/5 rounded-2xl p-4 sm:p-6">
           {(() => {
              const dirEmployees = directoryTab === 'pending' 
                ? employees.filter(e => e.accepted === false)
                : employees.filter(e => !e.team_id && e.accepted !== false);

              if (dirEmployees.length === 0) {
                 return (
                   <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-white/10 rounded-xl">
                     No hay empleados en esta categoría.
                   </div>
                 );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {dirEmployees.map(emp => {
                    const stats = employeeStats[emp.id] || {
                      state: { label: 'Fuera de turno', colorClass: 'text-slate-400', bgClass: 'bg-slate-400' },
                      hoursFormatted: '+00:00',
                      totalMinutes: 0,
                      punctuality: 100,
                      punctualityColor: 'text-emerald-400'
                    };
                    const teamName = teams.find(t => t.id === emp.team_id)?.name || 'Sin equipo asignado';
                    return (
                      <div
                        key={emp.id}
                        className="flex flex-col p-4 rounded-xl bg-[#151B2B] border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-colors group/emp"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <Link to={`/manager/equipos/trabajador/${emp.id}`} className="flex items-center gap-3 min-w-0 group-hover/emp:opacity-80 transition-opacity flex-1">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 text-sm font-bold overflow-hidden border border-white/10 shrink-0">
                                {emp.avatar ? (
                                    <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                ) : (
                                    (emp.name || emp.email).charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-200 text-sm truncate">{emp.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{emp.email}</p>
                            </div>
                          </Link>
                          {isAdminOrHr && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/emp:opacity-100 transition-opacity">
                              {emp.accepted === false && (
                                <button 
                                  onClick={(e) => {
                                      e.preventDefault();
                                      // TODO: Lógica para reenviar invitación
                                      alert("La función de reenviar invitación se implementará aquí");
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-primary rounded-lg hover:bg-primary/10 transition-all shrink-0" 
                                  title="Reenviar invitación"
                                >
                                  <Mail size={16} />
                                </button>
                              )}
                              {emp.role !== 'admin' && (
                                <button
                                  onClick={() => { setEmpToRemove(emp); setRemoveConfirmationText(''); setIsRemoveFromCompanyModalOpen(true); }}
                                  className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all shrink-0"
                                  title="Eliminar de la empresa"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 mt-auto">
                          <div className="flex items-center justify-between text-xs">
                             <span className="text-slate-500">Rol:</span>
                             <span className="text-slate-300 font-medium">{roleLabels[emp.role]?.label || emp.role}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                             <span className="text-slate-500">Equipo:</span>
                             <span className="text-slate-300 font-medium truncate max-w-[120px] text-right">{teamName}</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                            {emp.accepted === false ? (
                                <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></div>
                                    Invitación Pendiente
                                </span>
                            ) : (
                                <span className={`flex items-center gap-1.5 text-[11px] font-medium ${stats.state.colorClass}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${stats.state.bgClass} shrink-0`}></div>
                                    {stats.state.label}
                                </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
           })()}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODALES */}
      {/* ======================================================== */}

      <AnimatePresence>
        {/* Modal: Añadir Miembro */}
        {isMemberModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isAdding && setIsMemberModalOpen(false)}
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
                                <h3 className="text-xl font-bold text-white">Vincular a la Organización</h3>
                                <p className="text-sm text-slate-400 mt-1">Busca a un usuario que ya esté registrado en la App de Fycheo.</p>
                            </div>
                            <button onClick={() => setIsMemberModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {addError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
                                {addError}
                            </div>
                        )}

                        {addSuccess && (
                            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl">
                                {addSuccess}
                            </div>
                        )}

                        <form onSubmit={handleAddMember} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Nombre Completo (Opcional)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 flex items-center">
                                        <Users size={18} />
                                    </span>
                                    <input 
                                        type="text" 
                                        placeholder="Ej: Ronald Herrera"
                                        className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none"
                                        value={addName}
                                        onChange={e => setAddName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Correo Electrónico</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input 
                                        type="email" 
                                        required
                                        placeholder="usuario@ejemplo.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none"
                                        value={addEmail}
                                        onChange={e => setAddEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Rol en la empresa</label>
                                <CustomSelect
                                    value={addRole}
                                    onChange={(val) => setAddRole(val as any)}
                                    options={Object.entries(roleLabels)
                                        .filter(([val]) => val !== 'admin')
                                        .map(([val, {label}]) => ({
                                            value: val,
                                            label: label
                                        }))}
                                    icon={<Shield size={18} />}
                                />
                            </div>

                            <div className="pt-2">
                                <button 
                                    type="submit" 
                                    disabled={isAdding || !!addSuccess}
                                    className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAdding ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Buscar y Añadir'}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        )}

        {/* Modal: Crear / Editar Equipo */}
        {isTeamModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isSavingTeam && setIsTeamModalOpen(false)}
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
                                <h3 className="text-xl font-bold text-white">{editingTeam ? 'Editar Equipo' : 'Nuevo Equipo'}</h3>
                                <p className="text-sm text-slate-400 mt-1">{editingTeam ? 'Modifica los detalles del departamento' : 'Crea un nuevo departamento para organizar a tu personal'}</p>
                            </div>
                            <button onClick={() => setIsTeamModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveTeam} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Nombre del equipo</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder="Ej: Desarrollo, Ventas..."
                                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none"
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300">Descripción (Opcional)</label>
                                <textarea 
                                    placeholder="Ej: Equipo encargado de la infraestructura..."
                                    className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-primary/50 outline-none min-h-[100px] resize-none"
                                    value={teamDesc}
                                    onChange={e => setTeamDesc(e.target.value)}
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsTeamModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSavingTeam || !teamName.trim()}
                                    className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 min-w-[120px] flex justify-center"
                                >
                                    {isSavingTeam ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        )}

        {/* Modal: Eliminar Equipo */}
        {isDeleteModalOpen && teamToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-surface-dark w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl shadow-red-500/10 relative z-10 overflow-hidden"
                >
                    <div className="p-6">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white text-center mb-2">¿Eliminar este equipo?</h3>
                        <p className="text-slate-400 text-sm text-center mb-6">
                            Estás a punto de eliminar el equipo <strong>{teamToDelete.name}</strong>. Esta es una acción irreversible y todos los datos asociados (miembros desvinculados del equipo, turnos asignados) podrían perderse para siempre.
                        </p>

                        <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-6">
                            <p className="text-xs text-slate-400 mb-2 font-medium">
                                Para confirmar, escribe exactamente la siguiente frase:
                            </p>
                            <div className="bg-surface-dark font-mono text-xs text-red-400 p-2 rounded border border-red-500/20 mb-3 select-all">
                                {requiredConfirmationString}
                            </div>
                            <input 
                                type="text" 
                                placeholder="Escribe la frase aquí..."
                                className="w-full px-3 py-2 text-sm bg-black/50 border border-white/10 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-red-500 outline-none"
                                value={deleteConfirmationText}
                                onChange={e => setDeleteConfirmationText(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 border border-white/10 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDeleteTeam}
                                disabled={!canDelete || isDeleting}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:hover:bg-red-500 flex justify-center items-center gap-2"
                            >
                                {isDeleting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sí, eliminar equipo'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}

        {/* Modal: Eliminar Empleado */}
        {/* Modal: Eliminar de la Empresa */}
        {isRemoveFromCompanyModalOpen && empToRemove && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isRemoving && setIsRemoveFromCompanyModalOpen(false)} />
                <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="bg-surface-dark w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl shadow-red-500/10 relative z-10 overflow-hidden">
                    <div className="p-6">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white text-center mb-2">¿Eliminar de la empresa?</h3>
                        <p className="text-slate-400 text-sm text-center mb-6">
                            <strong>{empToRemove.name}</strong> perderá el acceso a esta organización. Esta acción no elimina su cuenta de Fycheo.
                        </p>
                        <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-6">
                            <p className="text-xs text-slate-400 mb-2 font-medium">Para confirmar, escribe exactamente:</p>
                            <div className="bg-surface-dark font-mono text-xs text-red-400 p-2 rounded border border-red-500/20 mb-3 select-all">
                                {requiredRemoveString}
                            </div>
                            <input type="text" placeholder="Escribe la frase aquí..."
                                className="w-full px-3 py-2 text-sm bg-black/50 border border-white/10 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-red-500 outline-none"
                                value={removeConfirmationText}
                                onChange={e => setRemoveConfirmationText(e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsRemoveFromCompanyModalOpen(false)} disabled={isRemoving}
                                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 border border-white/10 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleRemoveFromCompany} disabled={!canRemove || isRemoving}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition-all disabled:opacity-30 flex justify-center items-center gap-2">
                                {isRemoving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sí, eliminar de la empresa'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}

        {isDeleteEmpModalOpen && empToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isDeletingEmp && setIsDeleteEmpModalOpen(false)}
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-surface-dark w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl shadow-red-500/10 relative z-10 overflow-hidden"
                >
                    <div className="p-6">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white text-center mb-2">¿Quitar del equipo?</h3>
                        <p className="text-slate-400 text-sm text-center mb-6">
                            <strong>{empToDelete.name}</strong> será desasignado del equipo pero seguirá perteneciendo a la organización. Puedes volver a asignarle un equipo en cualquier momento.
                        </p>

                        <div className="bg-black/30 border border-white/5 rounded-xl p-4 mb-6">
                            <p className="text-xs text-slate-400 mb-2 font-medium">
                                Para confirmar, escribe exactamente la siguiente frase:
                            </p>
                            <div className="bg-surface-dark font-mono text-xs text-red-400 p-2 rounded border border-red-500/20 mb-3 select-all">
                                {requiredEmpConfirmationString}
                            </div>
                            <input 
                                type="text" 
                                placeholder="Escribe la frase aquí..."
                                className="w-full px-3 py-2 text-sm bg-black/50 border border-white/10 rounded-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-red-500 outline-none"
                                value={deleteEmpConfirmationText}
                                onChange={e => setDeleteEmpConfirmationText(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsDeleteEmpModalOpen(false)}
                                disabled={isDeletingEmp}
                                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 border border-white/10 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDeleteEmp}
                                disabled={!canDeleteEmp || isDeletingEmp}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:hover:bg-red-500 flex justify-center items-center gap-2"
                            >
                                {isDeletingEmp ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sí, quitar del equipo'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        )}

        {/* Modal: Permisos del Equipo */}
        {isTeamPermModalOpen && teamForPerms && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={() => !isSavingPerms && setIsTeamPermModalOpen(false)}
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-surface-dark w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {!activePermKey ? (
                        <>
                            <div className="p-6 border-b border-white/5 shrink-0 flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">Permisos: {teamForPerms.name}</h3>
                                    <p className="text-sm text-slate-400">Delega responsabilidades específicas en este equipo.</p>
                                </div>
                                <button onClick={() => setIsTeamPermModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6 space-y-3">
                                {teamPermissionList.map(perm => (
                                    <div 
                                        key={perm.key}
                                        onClick={() => setActivePermKey(perm.key)}
                                        className="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer group flex items-center justify-between gap-4"
                                    >
                                        <div className="flex-1">
                                            <h5 className="text-white font-semibold mb-0.5 group-hover:text-primary transition-colors">{perm.label}</h5>
                                            <p className="text-sm text-slate-400 leading-relaxed">{perm.desc}</p>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium px-2.5 py-1 rounded-lg bg-black/30 border border-white/5 group-hover:border-primary/20 group-hover:text-primary/80 transition-colors">
                                                <span>{(activeTeamPerms[perm.key] || []).length} usuarios</span>
                                            </div>
                                            <div className="text-slate-500 group-hover:text-primary transition-colors">
                                                <ChevronRight size={20} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-white/5 shrink-0 bg-black/20 flex justify-end gap-3">
                                <button 
                                    onClick={() => setIsTeamPermModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleSaveTeamPerms}
                                    disabled={isSavingPerms}
                                    className="bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 min-w-[120px] flex justify-center"
                                >
                                    {isSavingPerms ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Guardar Permisos'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="p-6 border-b border-white/5 shrink-0 flex gap-4 items-start">
                                <button onClick={() => setActivePermKey(null)} className="p-1.5 mt-0.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-white/5 bg-black/20">
                                    <ChevronRight size={18} className="rotate-180" />
                                </button>
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">
                                        {teamPermissionList.find(p => p.key === activePermKey)?.label}
                                    </h3>
                                    <p className="text-sm text-slate-400">Selecciona los miembros del equipo que tendrán este permiso.</p>
                                </div>
                            </div>
                            
                            <div className="p-4 border-b border-white/5 bg-black/20 shrink-0">
                                <div className="flex items-center gap-3 px-3 py-2 bg-black/50 rounded-lg border border-white/5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                                    <Search className="text-slate-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar empleado..." 
                                        className="bg-transparent border-none outline-none text-white w-full text-sm placeholder-slate-500"
                                        value={teamPermsSearchQuery}
                                        onChange={(e) => setTeamPermsSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div className="overflow-y-auto p-2 min-h-[300px]">
                                {getTeamEmployees(teamForPerms.id).filter(e => e.role !== 'admin' && e.role !== 'hr').length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 text-sm">
                                        No hay empleados en este equipo para asignar permisos.
                                    </div>
                                ) : (
                                    getTeamEmployees(teamForPerms.id)
                                        .filter(e => e.role !== 'admin' && e.role !== 'hr')
                                        .filter(e => (e.name || e.full_name || '').toLowerCase().includes(teamPermsSearchQuery.toLowerCase()))
                                        .map(emp => {
                                        const hasAccess = (activeTeamPerms[activePermKey] || []).includes(emp.id);

                                        return (
                                            <div key={emp.id} className="p-3 rounded-lg flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer" onClick={() => {
                                                setActiveTeamPerms(prev => {
                                                    const current = prev[activePermKey] || [];
                                                    return {
                                                        ...prev,
                                                        [activePermKey]: hasAccess 
                                                            ? current.filter(id => id !== emp.id)
                                                            : [...current, emp.id]
                                                    };
                                                });
                                            }}>
                                                <div className="flex items-center gap-3 pointer-events-none">
                                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden ring-1 ring-white/10">
                                                        {emp.avatar ? (
                                                            <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            (emp.name || emp.email)?.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{emp.name}</p>
                                                        <p className="text-xs text-slate-400 capitalize">{roleLabels[emp.role]?.label || emp.role}</p>
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
                                    })
                                )}
                            </div>
                            
                            <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
                                <button 
                                    onClick={() => setActivePermKey(null)}
                                    className="w-full bg-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold transition-all"
                                >
                                    Hecho
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* ======================================================== */}
      {/* MODAL: ASIGNAR TAREA / AVISO */}
      {/* ======================================================== */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isSavingTask && setIsTaskModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface-dark w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl relative z-10 overflow-hidden"
            >
              {/* Cabecera */}
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <ClipboardList size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-none">Asignar tarea o aviso</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Los destinatarios lo verán en la App</p>
                  </div>
                </div>
                <button onClick={() => setIsTaskModalOpen(false)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

                {/* Tipo: Tarea / Aviso */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Tipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTaskType('task')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        taskType === 'task'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-white/3 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <ClipboardList size={15} /> Tarea
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskType('notice')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        taskType === 'notice'
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-white/3 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span style={{ fontSize: 15 }}>📢</span> Aviso
                    </button>
                  </div>
                </div>

                {/* Destinatario — Multi-select */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destinatario</label>
                    <button
                      type="button"
                      onClick={() =>
                        setTaskSelectedRecipients(
                          taskSelectedRecipients.length === taskTeamEmployees.length
                            ? []
                            : taskTeamEmployees.map(e => e.id)
                        )
                      }
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {taskSelectedRecipients.length === taskTeamEmployees.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {taskTeamEmployees.map(emp => {
                      const selected = taskSelectedRecipients.includes(emp.id);
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() =>
                            setTaskSelectedRecipients(prev =>
                              selected ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                            )
                          }
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            selected
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-white/3 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                            {emp.avatar
                              ? <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                              : (emp.name || emp.email).charAt(0).toUpperCase()
                            }
                          </div>
                          <span>{emp.name || emp.email}</span>
                          {selected && <Check size={12} className="shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {taskSelectedRecipients.length === 0 && (
                    <p className="text-xs text-red-400 mt-2">Selecciona al menos un destinatario</p>
                  )}
                </div>

                {/* Título */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {taskType === 'task' ? 'Título de la tarea' : 'Título del aviso'} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder={taskType === 'task' ? 'Ej: Completar informe mensual' : 'Ej: Reunión mañana a las 10h'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción <span className="text-slate-600 font-normal normal-case">(opcional)</span></label>
                  <textarea
                    value={taskDesc}
                    onChange={e => setTaskDesc(e.target.value)}
                    rows={3}
                    placeholder="Detalles adicionales..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                  />
                </div>

                {/* Fecha límite (solo tareas) */}
                {taskType === 'task' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fecha límite <span className="text-slate-600 font-normal normal-case">(opcional)</span></label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={e => setTaskDueDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                )}

                {/* Prioridad */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Prioridad</label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { value: 'low',    label: 'Baja',    color: 'text-slate-400 border-slate-600',         active: 'bg-slate-500/20 border-slate-400 text-slate-200' },
                      { value: 'normal', label: 'Normal',  color: 'text-blue-400 border-blue-600',           active: 'bg-blue-500/20 border-blue-400 text-blue-200' },
                      { value: 'high',   label: 'Alta',    color: 'text-orange-400 border-orange-600',       active: 'bg-orange-500/20 border-orange-400 text-orange-200' },
                      { value: 'urgent', label: 'Urgente', color: 'text-red-400 border-red-600',             active: 'bg-red-500/20 border-red-400 text-red-200' },
                    ] as const).map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setTaskPriority(p.value)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          taskPriority === p.value ? p.active : `bg-white/3 ${p.color} hover:border-white/20`
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback */}
                {taskError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    <AlertTriangle size={15} />{taskError}
                  </div>
                )}
                {taskSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm">
                    ✓ {taskSuccess}
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    disabled={isSavingTask}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/10"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTask || !taskTitle.trim() || taskSelectedRecipients.length === 0}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20"
                  >
                    {isSavingTask ? 'Enviando...' : (taskType === 'task' ? 'Asignar tarea' : 'Enviar aviso')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showImportModal && (
        <ImportEmployeesModal 
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default Teams;
