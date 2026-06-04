import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard, Monitor, Smartphone, Building2,
  Users, Clock, CalendarOff, ChevronRight, Loader2,
  BarChart2, RefreshCw, Maximize2
} from 'lucide-react';

const DEMO_COMPANY_ID  = import.meta.env.VITE_DEMO_COMPANY_ID || '';

function trackSection(sectionId: string) {
  const email = localStorage.getItem('fycheo_demo_access');
  if (!email) return;
  supabase.from('demo_events').insert({ email, section: sectionId });
}
const ADMIN_EMAIL      = import.meta.env.VITE_DEMO_ADMIN_EMAIL    || 'demo.admin@fycheo-demo.com';
const ADMIN_PASS       = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'FycheoDemo2024!';
const EMPLOYEE_EMAIL   = 'empleado.demo@fycheo-demo.com';
const EMPLOYEE_PASS    = 'FycheoDemo2024!';

// Credenciales por sección — admin para manager/kiosk, empleado para employee app
const SECTION_CREDS: Record<string, { email: string; password: string }> = {
  manager:  { email: ADMIN_EMAIL,    password: ADMIN_PASS },
  kiosk:    { email: ADMIN_EMAIL,    password: ADMIN_PASS },
  employee: { email: EMPLOYEE_EMAIL, password: EMPLOYEE_PASS },
};

type SectionId = 'manager' | 'kiosk' | 'employee';

interface Section {
  id: SectionId;
  icon: React.ElementType;
  label: string;
  sub: string;
  device: 'desktop' | 'tablet' | 'phone';
  color: string;
  accentBg: string;
  features: string[];
  getUrl: (companyId: string) => string;
}

const SECTIONS: Section[] = [
  {
    id: 'manager',
    icon: LayoutDashboard,
    label: 'Panel Manager',
    sub: 'Dashboard y gestión',
    device: 'desktop',
    color: 'text-primary',
    accentBg: 'bg-primary/10 border-primary/20',
    features: ['Dashboard en tiempo real', 'Escaleta diaria Gantt', 'Gestión de equipos', 'Planificación de turnos', 'Control de ausencias y bajas', 'Registro de actividad', 'Exportación de informes'],
    getUrl: () => `${window.location.origin}/manager`,
  },
  {
    id: 'kiosk',
    icon: Monitor,
    label: 'Kiosko de Fichaje',
    sub: 'Terminal de empleados',
    device: 'tablet',
    color: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10 border-emerald-500/20',
    features: ['Fichaje por DNI', 'Entrada / Salida / Descanso / Permiso', 'Calendario de turnos', 'Historial mensual de horas', 'Balance de puntualidad', 'Resumen anual', 'Solicitud de ausencias'],
    getUrl: (id) => `${window.location.origin}/kiosk/${id}`,
  },
  {
    id: 'employee',
    icon: Smartphone,
    label: 'App Empleado',
    sub: 'PWA móvil · Pedro Jiménez',
    device: 'phone',
    color: 'text-violet-400',
    accentBg: 'bg-violet-500/10 border-violet-500/20',
    features: ['Fichar entrada / salida', 'Ver mis turnos', 'Historial de horas', 'Chat con compañeros', 'Tareas y avisos', 'Mis documentos', 'Solicitar ausencias'],
    getUrl: () => `${window.location.origin}/employee`,
  },
];

// ── ScaledIframe ─────────────────────────────────────────────────
function ScaledIframe({
  src, loading, nativeW, nativeH, loadingColor, fitBoth = false,
}: {
  src: string; loading: boolean;
  nativeW: number; nativeH: number;
  loadingColor: string; fitBoth?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const measure = useCallback(() => {
    if (!wrapRef.current) return;
    const w = wrapRef.current.offsetWidth;
    if (fitBoth) {
      const h = wrapRef.current.offsetHeight;
      setScale(Math.min(w / nativeW, h / nativeH));
    } else {
      setScale(w / nativeW);
    }
  }, [nativeW, nativeH, fitBoth]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [measure]);

  if (fitBoth) {
    const scaledW = Math.round(nativeW * scale);
    const scaledH = Math.round(nativeH * scale);
    return (
      <div ref={wrapRef} style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080C14]">
            <Loader2 size={28} className={`animate-spin ${loadingColor}`} />
            <p className="text-sm text-slate-500">Iniciando demo...</p>
          </div>
        ) : (
          <div style={{ width: scaledW, height: scaledH, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
            <iframe
              src={src}
              title="demo"
              style={{ width: nativeW, height: nativeH, border: 'none', transform: `scale(${scale})`, transformOrigin: 'top left', background: '#080C14' }}
              allow="same-origin"
            />
          </div>
        )}
      </div>
    );
  }

  const scaledH = Math.round(nativeH * scale);
  return (
    <div ref={wrapRef} style={{ width: '100%', height: scaledH, overflow: 'hidden', position: 'relative' }}>
      {loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#080C14]">
          <Loader2 size={28} className={`animate-spin ${loadingColor}`} />
          <p className="text-sm text-slate-500">Iniciando demo...</p>
        </div>
      ) : (
        <iframe
          src={src}
          title="demo"
          style={{ width: nativeW, height: nativeH, border: 'none', transform: `scale(${scale})`, transformOrigin: 'top left', background: '#080C14' }}
          allow="same-origin"
        />
      )}
    </div>
  );
}

export default function DemoShell() {
  // Modo pantalla completa: detectar ?fs=1&section=X en la URL
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isFullscreen = urlParams.get('fs') === '1';
  const fsSection = (urlParams.get('section') as SectionId) || 'manager';

  const [active, setActive]       = useState<SectionId>(isFullscreen ? fsSection : 'manager');
  const [companyId, setCompanyId] = useState(DEMO_COMPANY_ID);
  const [ready, setReady]         = useState(false);
  const [booting, setBooting]     = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [kioskDni, setKioskDni]   = useState<string | null>(null);

  // Medición del contenedor fullscreen para calcular escala "contain"
  const fsCtnRef = useRef<HTMLDivElement>(null);
  const [fsCtnSize, setFsCtnSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!isFullscreen) return;
    const measure = () => {
      if (fsCtnRef.current) setFsCtnSize({ w: fsCtnRef.current.offsetWidth, h: fsCtnRef.current.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (fsCtnRef.current) ro.observe(fsCtnRef.current);
    return () => ro.disconnect();
  }, [isFullscreen]);

  const section = SECTIONS.find(s => s.id === active)!;

  // ── Login inicial al montar ───────────────────────────────────
  useEffect(() => {
    const boot = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let uid = session?.user?.id;

        if (!session) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASS,
          });
          if (error) throw error;
          uid = data.user?.id;
        }

        let cid = companyId;
        if (!cid && uid) {
          const { data } = await supabase.from('companies').select('id').eq('owner_id', uid).limit(1).maybeSingle();
          cid = data?.id || '';
          if (cid) setCompanyId(cid);
        }

        if (cid) {
          localStorage.setItem('active_company_id', cid);
          localStorage.setItem('kiosk_demo_company_id', cid);
          localStorage.setItem('kiosk_pin', '1234');
          localStorage.setItem('kiosk_device_id', 'demo-device-001');

          // Buscar el empleado de pruebas y preparar el override en el boot
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar, dni_nie')
            .eq('email', 'empleado.demo@fycheo-demo.com')
            .maybeSingle();

          if (profile) {
            localStorage.setItem('demo_employee_override', JSON.stringify({
              id: profile.id,
              email: profile.email,
              user_metadata: { full_name: profile.full_name || 'Pedro Jiménez Ruiz', avatar_url: profile.avatar || '' }
            }));
            if (profile.dni_nie) {
              setKioskDni(profile.dni_nie);
              localStorage.setItem('kiosk_demo_dni', profile.dni_nie);
            }
          }
        }

        setReady(true);
        trackSection(isFullscreen ? fsSection : 'manager');
      } catch (e) {
        console.error('Demo boot error:', e);
      } finally {
        setBooting(false);
      }
    };
    boot();
  }, []);

  const iframeUrl = ready ? section.getUrl(companyId) : '';

  const handleSectionClick = async (id: SectionId) => {
    // Verificar y actualizar en caliente el ID de la empresa del admin conectado para evitar UUIDs huérfanos tras re-seeding
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase.from('companies').select('id').eq('owner_id', session.user.id).limit(1).maybeSingle();
        if (data?.id && data.id !== companyId) {
          setCompanyId(data.id);
          localStorage.setItem('active_company_id', data.id);
          localStorage.setItem('kiosk_demo_company_id', data.id);
        }
      }
    } catch (err) {
      console.error("Error al actualizar companyId en handleSectionClick:", err);
    }

    if (id === 'employee') {
      // Buscar directamente al empleado de pruebas de la demo por su correo
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar')
        .eq('email', 'empleado.demo@fycheo-demo.com')
        .maybeSingle();

      if (profile) {
        localStorage.setItem('demo_employee_override', JSON.stringify({
          id: profile.id,
          email: profile.email,
          user_metadata: { full_name: profile.full_name || 'Pedro Jiménez Ruiz', avatar_url: profile.avatar || '' }
        }));
      }
    } else {
      localStorage.removeItem('demo_employee_override');
    }
    setActive(id);
    setIframeKey(k => k + 1);
    trackSection(id);
  };

  useEffect(() => {
    if (active !== 'kiosk' || !ready || !companyId) return;
    supabase
      .from('profiles')
      .select('dni_nie')
      .eq('email', 'empleado.demo@fycheo-demo.com')
      .maybeSingle()
      .then(({ data: profile }) => {
        if (profile?.dni_nie) {
          setKioskDni(profile.dni_nie);
          localStorage.setItem('kiosk_demo_dni', profile.dni_nie);
        } else {
          // Fallback por si no existe por correo
          supabase
            .from('company_members')
            .select('profiles:user_id(dni_nie)')
            .eq('company_id', companyId)
            .eq('role', 'employee')
            .then(({ data }) => {
              const found = (data || []).find((m: any) => {
                const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                return p?.dni_nie;
              });
              if (found) {
                const p = Array.isArray(found.profiles) ? found.profiles[0] : found.profiles;
                setKioskDni(p.dni_nie);
                localStorage.setItem('kiosk_demo_dni', p.dni_nie);
              }
            });
        }
      });
  }, [active, ready, companyId]);

  const handleRefresh = () => setIframeKey(k => k + 1);

  const handleFullscreen = () => {
    window.open(`${window.location.origin}/?fs=1&section=${active}`, '_blank');
  };

  if (isFullscreen) {
    // Dimensiones nativas de cada dispositivo (iframe + chrome del frame)
    const FS_DIMS = {
      desktop: { nW: 1440, nH: 900, totalH: 944 },
      tablet:  { nW: 1280, nH: 800, totalH: 860 },
      phone:   { nW: 390,  nH: 760, totalH: 828 },
    };
    const { nW, nH, totalH } = FS_DIMS[section.device];
    const fsScale = fsCtnSize.w && fsCtnSize.h
      ? Math.min(fsCtnSize.w / nW, fsCtnSize.h / totalH)
      : 0;
    const fsW = fsScale ? Math.round(nW * fsScale) : 0;
    const fsH = fsScale ? Math.round(totalH * fsScale) : 0;

    return (
      <div className="h-screen bg-[#080C14] text-white flex flex-col overflow-hidden">
        <main className="flex-1 flex flex-col bg-[#080C14] relative overflow-hidden px-4 pt-2 pb-1 gap-2 min-h-0">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[80px]" />
          </div>

          {/* Barra superior */}
          <div className="relative z-10 w-full shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className={`w-2 h-2 rounded-full ${ready ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
              {ready ? section.label : 'Iniciando sesión demo...'}
            </div>
            <button onClick={handleRefresh} title="Recargar" className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 transition-colors">
              <RefreshCw size={12} className="text-slate-400" />
            </button>
          </div>

          {/* Área de medición — ocupa todo el espacio restante */}
          <div ref={fsCtnRef} className="relative z-10 flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            {fsW > 0 && (
              section.device === 'desktop' ? (
                <div
                  className="flex flex-col rounded-2xl border border-white/20 bg-[#0f1520] shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden"
                  style={{ width: fsW, height: fsH, flexShrink: 0 }}
                >
                  <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-[#1a2235] border-b border-white/8">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/70" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                      <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    </div>
                    <div className="flex-1 mx-3 flex items-center gap-2 bg-white/5 rounded-md px-3 py-1.5">
                      <div className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" />
                      <span className="text-xs text-slate-400 truncate">{iframeUrl || 'demo.fycheo.es/manager'}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ScaledIframe
                      key={`${active}-${iframeKey}`}
                      src={iframeUrl}
                      loading={booting || !ready}
                      nativeW={nW} nativeH={nH}
                      loadingColor="text-primary"
                      fitBoth
                    />
                  </div>
                </div>
              ) : section.device === 'tablet' ? (
                <div
                  className="flex flex-col rounded-[20px] border-[6px] border-[#2d4060] bg-[#0B0E14] shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_40px_rgba(19,91,236,0.08)] overflow-hidden ring-1 ring-white/8"
                  style={{ width: fsW, height: fsH, flexShrink: 0 }}
                >
                  <div className="shrink-0 flex items-center justify-between px-5 py-2 bg-[#233050]">
                    <div className="w-8 h-1.5 rounded-full bg-white/20" />
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ScaledIframe
                      key={`${active}-${iframeKey}`}
                      src={iframeUrl}
                      loading={booting || !ready}
                      nativeW={nW} nativeH={nH}
                      loadingColor="text-emerald-400"
                      fitBoth
                    />
                  </div>
                  <div className="shrink-0 grid grid-cols-3 items-center px-5 py-2 bg-[#233050]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">DNI de prueba:</span>
                      {kioskDni
                        ? <span className="font-mono font-bold text-orange-400 text-sm tracking-widest">{kioskDni}</span>
                        : <span className="text-[10px] text-slate-600 italic">cargando...</span>
                      }
                    </div>
                    <div className="flex justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-white/20" />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="flex flex-col rounded-[40px] border-[8px] border-[#2a3a55] bg-[#080C14] shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.08)] overflow-hidden ring-1 ring-white/8"
                  style={{ width: fsW, height: fsH, flexShrink: 0 }}
                >
                  <div className="shrink-0 flex items-center justify-center pt-3 pb-1 bg-[#0d1322]">
                    <div className="w-24 h-6 rounded-full bg-[#1e2d47] flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      <div className="w-10 h-1.5 rounded-full bg-[#111827]" />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ScaledIframe
                      key={`${active}-${iframeKey}`}
                      src={iframeUrl}
                      loading={booting || !ready}
                      nativeW={nW} nativeH={nH}
                      loadingColor="text-violet-400"
                      fitBoth
                    />
                  </div>
                  <div className="shrink-0 flex items-center justify-center py-3 bg-[#0d1322]">
                    <div className="w-24 h-1 rounded-full bg-white/25" />
                  </div>
                </div>
              )
            )}
          </div>

          <p className="relative z-10 shrink-0 text-center text-[10px] text-slate-700">
            Datos ficticios · Entorno aislado · Ningún dato es real
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#080C14] text-white flex overflow-hidden">

      {/* ── SIDEBAR ────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-white/5 bg-[#0C1020]">

        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/5">
          <img src="/icono-kiosko.svg" alt="Fycheo" className="w-8 h-8 rounded-xl" />
          <span className="font-bold text-lg tracking-tight">Fycheo</span>
          <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">DEMO</span>
        </div>

        {/* Company badge */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Building2 size={15} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">Distribuciones Martínez S.A.</p>
              <p className="text-[10px] text-slate-500">Empresa ficticia · Plan Pro</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-white/5">
          {[
            { icon: Users,       label: '24 empleados', color: 'text-blue-400' },
            { icon: Clock,       label: '12 meses datos', color: 'text-emerald-400' },
            { icon: CalendarOff, label: '4 equipos', color: 'text-purple-400' },
            { icon: BarChart2,   label: 'Datos ficticios', color: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/3 border border-white/5 rounded-lg px-2.5 py-2">
              <s.icon size={12} className={s.color} />
              <span className="text-[10px] text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Secciones */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-3">Apps disponibles</p>
          {SECTIONS.map(s => {
            const isActive = active === s.id;
            return (
              <div key={s.id}>
                <button
                  onClick={() => handleSectionClick(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group ${
                    isActive
                      ? 'bg-white/8 border border-white/10'
                      : 'hover:bg-white/4 border border-transparent'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${isActive ? s.accentBg : 'bg-white/5 border-white/8'}`}>
                    <s.icon size={17} className={isActive ? s.color : 'text-slate-400'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>{s.label}</p>
                    <p className="text-[11px] text-slate-500 truncate">{s.sub}</p>
                  </div>
                  <ChevronRight size={14} className={`shrink-0 transition-transform duration-200 ${isActive ? 'text-white/40 rotate-90' : 'text-slate-700 group-hover:text-slate-500'}`} />
                </button>

                {/* Features desplegables bajo el botón activo */}
                {isActive && (
                  <div className="mx-2 mb-1 mt-0.5 bg-white/3 border border-white/6 rounded-xl px-3 py-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    {s.features.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <span className={`shrink-0 text-xs leading-none ${s.color}`}>•</span>
                        <span className="text-[11px] text-slate-400">{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="px-4 pb-5 pt-2 border-t border-white/5">
          <div className="rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/10 border border-primary/20 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-white leading-tight">¿Te ha convencido?</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Empieza gratis, sin tarjeta.</p>
            </div>
            <button
              onClick={() => window.open('http://localhost:3002/register', '_blank')}
              className="w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
            >
              Probar Fycheo gratis →
            </button>
            <button
              onClick={() => window.open('http://localhost:3002/contacto', '_blank')}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
            >
              Solicitar contacto
            </button>
            <button
              onClick={() => window.open('http://localhost:3002/precios', '_blank')}
              className="w-full text-slate-500 hover:text-slate-300 text-[11px] transition-colors"
            >
              Ver planes y precios
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN: MOCKUP + IFRAME ──────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center bg-[#080C14] relative overflow-hidden p-6 gap-4">

        {/* Glow de fondo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[80px]" />
        </div>

        {/* Barra superior del mockup */}
        <div className="relative z-10 w-full max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className={`w-2 h-2 rounded-full ${ready ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
            {ready ? section.label : 'Iniciando sesión demo...'}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleRefresh} title="Recargar" className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 transition-colors">
              <RefreshCw size={12} className="text-slate-400" />
            </button>
            <button onClick={handleFullscreen} title="Abrir en pantalla completa" className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 transition-colors">
              <Maximize2 size={12} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Mockup frame */}
        <div className="relative z-10 w-full max-w-5xl">
          {section.device === 'desktop' ? (
            <div className="rounded-2xl border border-white/20 bg-[#0f1520] shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#1a2235] border-b border-white/8">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 mx-3 flex items-center gap-2 bg-white/5 rounded-md px-3 py-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0" />
                  <span className="text-xs text-slate-400 truncate">
                    {iframeUrl || 'demo.fycheo.es/manager'}
                  </span>
                </div>
              </div>
              <ScaledIframe
                key={`${active}-${iframeKey}`}
                src={iframeUrl}
                loading={booting || !ready}
                nativeW={1440} nativeH={900}
                loadingColor="text-primary"
              />
            </div>
          ) : section.device === 'tablet' ? (
            <div className="rounded-[20px] border-[6px] border-[#2d4060] bg-[#0B0E14] shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_40px_rgba(19,91,236,0.08)] overflow-hidden ring-1 ring-white/8">
              <div className="flex items-center justify-between px-5 py-2 bg-[#233050]">
                <div className="w-8 h-1.5 rounded-full bg-white/20" />
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
              </div>
              <ScaledIframe
                key={`${active}-${iframeKey}`}
                src={iframeUrl}
                loading={booting || !ready}
                nativeW={1280} nativeH={800}
                loadingColor="text-emerald-400"
              />
              <div className="grid grid-cols-3 items-center px-5 py-2 bg-[#233050]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">DNI de prueba:</span>
                  {kioskDni
                    ? <span className="font-mono font-bold text-orange-400 text-sm tracking-widest">{kioskDni}</span>
                    : <span className="text-[10px] text-slate-600 italic">cargando...</span>
                  }
                </div>
                <div className="flex justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-white/20" />
                </div>
              </div>
            </div>
          ) : (
            /* ── Phone mockup ── */
            <div className="flex justify-center">
              <div className="relative" style={{ width: 320 }}>
                {/* Teléfono frame */}
                <div className="rounded-[40px] border-[8px] border-[#2a3a55] bg-[#080C14] shadow-[0_0_80px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.08)] overflow-hidden ring-1 ring-white/8">
                  {/* Notch */}
                  <div className="flex items-center justify-center pt-3 pb-1 bg-[#0d1322]">
                    <div className="w-24 h-6 rounded-full bg-[#1e2d47] flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      <div className="w-10 h-1.5 rounded-full bg-[#111827]" />
                    </div>
                  </div>
                  {/* Screen */}
                  <ScaledIframe
                    key={`${active}-${iframeKey}`}
                    src={iframeUrl}
                    loading={booting || !ready}
                    nativeW={390} nativeH={760}
                    loadingColor="text-violet-400"
                  />
                  {/* Home bar */}
                  <div className="flex items-center justify-center py-3 bg-[#0d1322]">
                    <div className="w-24 h-1 rounded-full bg-white/25" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="relative z-10 text-[10px] text-slate-700">
          Datos ficticios · Entorno aislado · Ningún dato es real
        </p>
      </main>

      {/* ── Modal de contacto ────────────────────────────────────── */}
    </div>
  );
}
