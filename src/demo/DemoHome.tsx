import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, ArrowRight, Building2, Users, Clock, CalendarOff, BarChart2, Monitor, Smartphone } from 'lucide-react';

const DEMO_ACCOUNTS = {
  admin: {
    email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'demo.admin@fycheo-demo.com',
    password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'FycheoDemo2024!',
  },
  kiosk: {
    email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'demo.admin@fycheo-demo.com',
    password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'FycheoDemo2024!',
  },
};

const DEMO_COMPANY_ID = import.meta.env.VITE_DEMO_COMPANY_ID || '';

export default function DemoHome() {
  const [loading, setLoading] = useState<'manager' | 'kiosk' | null>(null);
  const [error, setError] = useState('');

  const fetchCompanyId = async (userId: string) => {
    const { data } = await supabase.from('companies').select('id').eq('owner_id', userId).limit(1).maybeSingle();
    return data?.id || null;
  };

  const handleEnter = async (type: 'manager' | 'kiosk') => {
    setLoading(type);
    setError('');
    try {
      await supabase.auth.signOut();
      const account = type === 'manager' ? DEMO_ACCOUNTS.admin : DEMO_ACCOUNTS.kiosk;
      const { data, error: loginError } = await supabase.auth.signInWithPassword(account);
      if (loginError) throw loginError;
      if (!data.user) throw new Error('No se pudo autenticar');

      const companyId = DEMO_COMPANY_ID || await fetchCompanyId(data.user.id);

      if (type === 'manager') {
        if (companyId) localStorage.setItem('active_company_id', companyId);
        window.open('/manager', '_blank');
      } else {
        if (companyId) {
          localStorage.setItem('kiosk_demo_company_id', companyId);
          localStorage.setItem('kiosk_pin', '1234');
          localStorage.setItem('kiosk_device_id', 'demo-device-001');
        }
        window.open('/kiosk', '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar la demo');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16 border-b border-white/5 bg-[#080C14]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-sm">F</div>
          <span className="font-bold text-lg tracking-tight">Fycheo</span>
          <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full ml-1">DEMO</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">
            <Building2 size={12} />
            Distribuciones Martínez S.A.
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-28 pb-12 px-6 text-center relative">
        {/* Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-5">Entorno interactivo</p>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
            Prueba Fycheo<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              sin compromiso
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed mb-10">
            Explora el sistema completo de control horario con datos reales de una empresa con un año de historial. Ningún dato es real.
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-6 flex-wrap text-sm text-slate-400">
            {[
              { icon: Users,      label: '24 empleados ficticios' },
              { icon: Clock,      label: '12 meses de historial' },
              { icon: CalendarOff,label: 'Ausencias y bajas reales' },
              { icon: BarChart2,  label: 'Dashboard en vivo' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <s.icon size={14} className="text-primary/70" />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CARDS ── */}
      <section className="pb-32 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Manager card */}
          <div className="group relative bg-gradient-to-br from-[#0f1729] to-[#111827] border border-white/8 rounded-3xl overflow-hidden hover:border-primary/30 transition-all duration-500 hover:shadow-[0_0_60px_-15px_rgba(19,91,236,0.3)]">

            {/* Browser mockup */}
            <div className="mx-5 mt-5 rounded-xl overflow-hidden border border-white/10 bg-[#0B0E14] shadow-xl">
              {/* Browser bar */}
              <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#151B2B] border-b border-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <div className="flex-1 mx-3 bg-white/5 rounded-md px-3 py-1 text-[10px] text-slate-500">
                  demo.fycheo.es/manager
                </div>
              </div>
              {/* Preview */}
              <div className="h-44 bg-[#0B0E14] flex overflow-hidden">
                {/* Sidebar mini */}
                <div className="w-12 bg-[#151B2B] border-r border-white/5 flex flex-col items-center py-3 gap-3">
                  <div className="w-6 h-6 rounded-md bg-primary/20" />
                  {[...Array(5)].map((_, i) => <div key={i} className="w-5 h-1.5 rounded bg-white/10" />)}
                </div>
                {/* Content mini */}
                <div className="flex-1 p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {['bg-blue-500/20','bg-emerald-500/20','bg-purple-500/20'].map((c,i) => (
                      <div key={i} className={`h-10 rounded-lg ${c} border border-white/5`} />
                    ))}
                  </div>
                  <div className="h-16 rounded-lg bg-white/5 border border-white/5" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-8 rounded-lg bg-white/5 border border-white/5" />
                    <div className="h-8 rounded-lg bg-white/5 border border-white/5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Monitor size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg leading-tight">Panel Manager</h2>
                  <p className="text-xs text-slate-500">Escritorio · Dashboard completo</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                Dashboard en tiempo real, gestión de empleados, planificación de turnos, control de ausencias y exportación de reportes.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Escaleta diaria','Equipos','Turnos','Ausencias','Exportación PDF'].map(f => (
                  <span key={f} className="text-[11px] bg-white/5 border border-white/8 text-slate-400 px-2.5 py-1 rounded-lg">{f}</span>
                ))}
              </div>
              <button
                onClick={() => handleEnter('manager')}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-light disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {loading === 'manager'
                  ? <><Loader2 size={16} className="animate-spin" /> Abriendo...</>
                  : <>Abrir Panel Manager <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                }
              </button>
            </div>
          </div>

          {/* Kiosk card */}
          <div className="group relative bg-gradient-to-br from-[#0a1a13] to-[#0f1a14] border border-white/8 rounded-3xl overflow-hidden hover:border-emerald-500/30 transition-all duration-500 hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.2)]">

            {/* Tablet mockup */}
            <div className="mx-5 mt-5 rounded-xl overflow-hidden border border-white/10 bg-[#0B1210] shadow-xl">
              <div className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0f1f18] border-b border-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <div className="flex-1 mx-3 bg-white/5 rounded-md px-3 py-1 text-[10px] text-slate-500">
                  demo.fycheo.es/kiosk
                </div>
              </div>
              <div className="h-44 bg-[#0B1210] flex overflow-hidden">
                {/* Kiosk left panel */}
                <div className="w-28 bg-[#0f1f18] border-r border-white/5 flex flex-col items-center justify-center gap-2 p-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
                  <div className="w-16 h-1.5 rounded bg-white/10" />
                  <div className="w-12 h-1 rounded bg-white/5" />
                  <div className="mt-2 text-[8px] text-emerald-400 font-mono">11:32</div>
                </div>
                {/* DNI input area */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-3">
                  <div className="w-full h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-[9px] text-slate-500 tracking-widest">DNI / NIE</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 w-full">
                    {[1,2,3,4,5,6,7,8,9,'',0,''].map((n, i) => (
                      <div key={i} className="h-6 rounded-md bg-white/8 border border-white/5 flex items-center justify-center text-[8px] text-slate-400">
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Smartphone size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg leading-tight">Kiosko de Fichaje</h2>
                  <p className="text-xs text-slate-500">Tablet · Terminal compartido</p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                Terminal táctil para que los empleados registren entradas, salidas y descansos identificándose con su DNI.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Entrada / Salida','Descanso','Historial mensual','Solicitar ausencia'].map(f => (
                  <span key={f} className="text-[11px] bg-white/5 border border-white/8 text-slate-400 px-2.5 py-1 rounded-lg">{f}</span>
                ))}
              </div>
              <button
                onClick={() => handleEnter('kiosk')}
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {loading === 'kiosk'
                  ? <><Loader2 size={16} className="animate-spin" /> Abriendo...</>
                  : <>Abrir Kiosko <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                }
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-center text-red-400 text-sm mt-6">{error}</p>
        )}

        <p className="text-center text-xs text-slate-700 mt-12">
          Datos ficticios · Entorno aislado · No representa datos reales de ninguna empresa
        </p>
      </section>
    </div>
  );
}
