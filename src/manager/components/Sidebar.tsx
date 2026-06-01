import { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Settings, LogOut, User, ChevronRight, Building2, ArrowLeft, Megaphone, CalendarOff, FileDown, Activity, X, Receipt, FolderOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { shiftService } from '../services/shiftService';
import { notificationService } from '../services/notificationService';
import { logService } from '../services/logService';
import logo from '../assets/logo.svg';

interface SidebarProps {
    isOpen?: boolean;
    setIsOpen?: (value: boolean) => void;
    isMobile?: boolean; // Para saber si estamos en modo mobile (overlay)
}

const Sidebar = ({ isOpen = true, setIsOpen, isMobile = false }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCompany, selectCompany, profile } = useAuth();
  const [unpublishedCount, setUnpublishedCount] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [pendingAbsences, setPendingAbsences] = useState(0);

  useEffect(() => {
    // Escuchar actualizaciones desde Shifts.tsx
    const handleDraftsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      setUnpublishedCount(customEvent.detail);
    };

    // Al montar, consultar directamente a BD por si no estamos en Shifts.tsx
    const fetchCount = async () => {
      if (!activeCompany) return;
      try {
        const { count } = await supabase
          .from('shifts')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', activeCompany.id)
          .eq('is_published', false);
        
        setUnpublishedCount(count || 0);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCount();

    window.addEventListener('fycheo-drafts-updated', handleDraftsUpdated);
    return () => window.removeEventListener('fycheo-drafts-updated', handleDraftsUpdated);
  }, [activeCompany]);

  useEffect(() => {
    if (['/manager/exportacion', '/manager/nominas'].includes(location.pathname)) setDocsOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    if (!activeCompany?.id) return;
    const fetchPending = async () => {
      const { count } = await supabase
        .from('absences')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', activeCompany.id)
        .eq('status', 'pending');
      setPendingAbsences(count || 0);
    };
    fetchPending();
    const channel = supabase
      .channel('absences_pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absences', filter: `company_id=eq.${activeCompany.id}` },
        () => fetchPending()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeCompany?.id]);

  const handlePublish = async () => {
    if (!activeCompany || !profile || isPublishing) return;
    try {
      setIsPublishing(true);
      const managerName = profile.full_name || profile.name || "Administrador";

      // Obtener los turnos a publicar de BD
      const { data } = await supabase
        .from('shifts')
        .select('id, status, employee_id')
        .eq('company_id', activeCompany.id)
        .eq('is_published', false);
      
      if (!data || data.length === 0) return;

      const shiftsToUpdate = data.filter(s => s.status !== 'pending_deletion');
      const shiftsToDelete = data.filter(s => s.status === 'pending_deletion');
      
      const shiftIds = shiftsToUpdate.map(s => s.id);
      const deletedShiftIds = shiftsToDelete.map(s => s.id);
      
      await shiftService.publishShifts(shiftIds, deletedShiftIds, managerName);
      
      // Notificar a Shifts.tsx si está abierto
      window.dispatchEvent(new CustomEvent('fycheo-publish-done'));
      
      // Crear notificaciones para los empleados
      const employeeIds = [...new Set(data.map(s => s.employee_id))];
      await notificationService.createNotification(
        employeeIds, 
        activeCompany.id, 
        `Tu horario ha sido actualizado por ${managerName}`, 
        managerName
      );

      await logService.logAction(
        activeCompany.id,
        profile.id,
        'shift_published',
        `Publicó ${data.length} modificaciones de turnos`,
        { publishedCount: data.length, shiftIds, affected: `${employeeIds.length} Empleados` }
      );

      setUnpublishedCount(0);
    } catch (e) {
      console.error("Error al publicar", e);
    } finally {
      setIsPublishing(false);
    }
  };

  const roleNames: Record<string, string> = {
    admin: 'Administrador',
    hr: 'Recursos Humanos',
    manager: 'Manager',
    employee: 'Empleado',
  };

  const canViewSettings = () => {
    if (!activeCompany || !profile) return false;
    if (activeCompany.role === 'admin' || activeCompany.role === 'hr') return true;
    
    // Check custom permissions in settings
    const settings = (activeCompany as any).settings;
    const allowedUsers = settings?.permissions?.view_settings || [];
    return allowedUsers.includes(profile.id);
  };

  const docChildren = [
    { icon: FileDown, label: 'Exportación', path: '/manager/exportacion' },
    ...(canViewSettings() ? [{ icon: Receipt, label: 'Nóminas Masivas', path: '/manager/nominas' }] : []),
  ];

  const navItems: any[] = [
    { icon: LayoutDashboard, label: 'Resumen', path: '/manager' },
    { icon: Users, label: 'Equipos', path: '/manager/equipos' },
    { icon: Calendar, label: 'Turnos', path: '/manager/turnos' },
    { icon: CalendarOff, label: 'Ausencias y Bajas', path: '/manager/ausencias', badge: pendingAbsences },
    { icon: FolderOpen, label: 'Documentación', group: true, children: docChildren },
    ...(canViewSettings() ? [{ icon: Activity, label: 'Registro Actividad', path: '/manager/auditoria' }] : []),
    { icon: User, label: 'Mi Cuenta', path: '/manager/account' },
    ...(canViewSettings() ? [{ icon: Settings, label: 'Configuración', path: '/manager/configuracion' }] : []),
  ];

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/');
  };

  const handleBackToHub = async () => {
      await selectCompany(null);
      navigate('/manager/hub');
  };

  const sidebarContent = (
      <>
        {/* Header: Fycheo Logo (Principal) */}
        <div className="h-16 flex items-center px-6 border-b border-white/5 justify-between shrink-0">
             <Link to="/manager" className={cn("flex items-center gap-2 transition-all", !isOpen && !isMobile && "w-0 opacity-0 overflow-hidden")}>
                <img src={logo} alt="Fycheo" className="h-8 object-contain" />
             </Link>
             
             {isMobile && setIsOpen ? (
                 <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors shrink-0 p-1.5 hover:bg-white/5 rounded-lg">
                     <X size={20} />
                 </button>
             ) : (!isMobile && setIsOpen && (
                 <button onClick={() => setIsOpen(!isOpen)} className="text-slate-400 hover:text-white transition-colors shrink-0 ml-2">
                     {isOpen ? <ChevronRight className="rotate-180" /> : <ChevronRight />}
                 </button>
             ))}
        </div>

        {/* Sub-Header: Active Company Context */}
        {activeCompany && (
            <div className={cn("px-4 py-4 border-b border-white/5", !isOpen && !isMobile && "px-2 py-2")}>
                 <div className={cn("bg-white/5 rounded-xl p-3 flex items-center gap-3 transition-all group border border-white/5 hover:border-white/10", !isOpen && !isMobile && "p-2 justify-center")}>
                     <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden ring-1 ring-white/10">
                          {activeCompany.logo_url ? (
                              <img src={activeCompany.logo_url} alt={activeCompany.name} className="w-full h-full object-cover" />
                          ) : (
                              <Building2 size={16} />
                          )}
                     </div>
                     <div className={cn("flex flex-col min-w-0 overflow-hidden transition-all", !isOpen && !isMobile && "w-0 opacity-0 hidden")}>
                          <span className="text-sm font-bold text-white truncate leading-tight">
                              {activeCompany.name}
                          </span>
                          <button onClick={handleBackToHub} className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 transition-colors text-left mt-0.5">
                             <ArrowLeft size={10} /> Volver al Hub
                          </button>
                     </div>
                 </div>
            </div>
        )}

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {navItems.filter(item => item.group || item.path !== '/account').map((item) => {
              if (item.group) {
                const isChildActive = item.children.some((c: any) => location.pathname === c.path);
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => {
                        if (!isOpen && !isMobile) { setIsOpen?.(true); setDocsOpen(true); }
                        else setDocsOpen(v => !v);
                      }}
                      className={cn(
                        'w-full flex items-center px-3 py-2.5 rounded-lg transition-all group border border-transparent',
                        isChildActive
                          ? 'bg-primary/20 text-white border-white/5'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white',
                        !isOpen && !isMobile && "justify-center px-2"
                      )}
                      title={!isOpen ? item.label : undefined}
                    >
                      <item.icon size={20} className={cn("shrink-0 transition-colors", isChildActive ? "text-primary" : "group-hover:text-primary")} />
                      <span className={cn("ml-3 font-medium transition-all flex-1 text-left whitespace-nowrap", !isOpen && !isMobile && "hidden w-0 opacity-0")}>
                        {item.label}
                      </span>
                      <ChevronRight size={14} className={cn("shrink-0 transition-transform text-slate-500", docsOpen && "rotate-90", !isOpen && !isMobile && "hidden")} />
                    </button>

                    {docsOpen && (isOpen || isMobile) && (
                      <div className="ml-3 mt-1 pl-3 border-l border-white/10 space-y-1">
                        {item.children.map((child: any) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            onClick={() => isMobile && setIsOpen && setIsOpen(false)}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center px-3 py-2 rounded-lg transition-all group border border-transparent text-sm',
                                isActive
                                  ? 'bg-primary/20 text-white border-white/5'
                                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <child.icon size={16} className={cn("shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                                <span className="ml-3 font-medium whitespace-nowrap">{child.label}</span>
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && setIsOpen && setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-3 py-2.5 rounded-lg transition-all group border border-transparent',
                      isActive
                        ? 'bg-primary/20 text-white border-white/5'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white',
                      !isOpen && !isMobile && "justify-center px-2"
                    )
                  }
                  title={!isOpen ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={20} className={cn("shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                      <span className={cn("ml-3 font-medium transition-all whitespace-nowrap flex-1", !isOpen && !isMobile && "hidden w-0 opacity-0")}>
                        {item.label}
                      </span>
                      {item.badge > 0 && (isOpen || isMobile) && (
                        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold shrink-0">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
        </nav>

        <div className="px-4 pb-4 shrink-0">
            <button
                onClick={handlePublish}
                disabled={isPublishing || unpublishedCount === 0}
                className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full",
                    unpublishedCount > 0 
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-transparent"
                      : "bg-transparent border border-blue-500/50 text-blue-400 opacity-60 cursor-default",
                    !isOpen && !isMobile && "justify-center px-0",
                    isPublishing && "opacity-50 pointer-events-none"
                )}
                title={!isOpen ? (unpublishedCount > 0 ? 'Publicar Cambios' : 'Sin cambios') : undefined}
            >
                <Megaphone size={18} className={cn(isPublishing && "animate-pulse", unpublishedCount === 0 && "opacity-70")} />
                <span className={cn("ml-1 whitespace-nowrap", !isOpen && !isMobile && "hidden w-0 opacity-0")}>
                    {isPublishing ? "Publicando..." : (unpublishedCount > 0 ? 'Publicar Cambios' : 'Sin cambios')}
                </span>
            </button>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0 flex flex-col gap-2">
            {profile && (
                <div className={cn("flex items-center gap-3 px-2 transition-all", !isOpen && !isMobile && "justify-center px-0")}>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden ring-1 ring-white/10">
                        {profile.avatar ? (
                            <img src={profile.avatar} alt={profile.full_name || profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="font-bold text-sm">{(profile.full_name || profile.name)?.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div className={cn("flex flex-col min-w-0 overflow-hidden transition-all", !isOpen && !isMobile && "w-0 opacity-0 hidden")}>
                        <span className="text-sm font-medium text-white truncate">
                            {profile.full_name || profile.name}
                        </span>
                        <span className="text-xs text-slate-400 truncate">
                            {roleNames[profile.role] || profile.role}
                        </span>
                    </div>
                </div>
            )}
            <button 
                onClick={handleLogout}
                className={cn(
                    "flex items-center w-full px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors group mt-2",
                    !isOpen && !isMobile && "justify-center mt-0"
                )}
                title={!isOpen ? "Cerrar Sesión" : undefined}
            >
            <LogOut size={20} className="shrink-0" />
            <span className={cn("ml-3 font-medium transition-all whitespace-nowrap", !isOpen && !isMobile && "hidden w-0 opacity-0")}>
                Cerrar Sesión
            </span>
            </button>
        </div>
      </>
  );

  if (isMobile) {
      return (
          <div className="w-full h-full bg-surface-dark flex flex-col">
              {sidebarContent}
          </div>
      );
  }

  return (
    <aside className={cn(
        "hidden md:flex flex-col border-r border-white/5 bg-surface-dark/50 backdrop-blur-xl fixed h-full transition-all duration-300 z-50",
        isOpen ? "w-64" : "w-20"
    )}>
      {sidebarContent}
    </aside>
  );
};

export default Sidebar;
