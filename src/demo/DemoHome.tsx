import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Monitor, Smartphone, ArrowRight, Loader2, Building2, Users, Clock, Calendar } from 'lucide-react';

const DEMO_COMPANY_NAME = 'Distribuciones Martínez S.A.';

// Credenciales de las cuentas demo (deben existir en el proyecto Supabase demo)
const DEMO_ACCOUNTS = {
  admin: {
    email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'demo.admin@fycheo-demo.com',
    password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'FycheoDemo2024!',
  },
  manager: {
    email: import.meta.env.VITE_DEMO_MANAGER_EMAIL || 'demo.manager@fycheo-demo.com',
    password: import.meta.env.VITE_DEMO_MANAGER_PASSWORD || 'FycheoDemo2024!',
  },
  kiosk: {
    email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'demo.admin@fycheo-demo.com',
    password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'FycheoDemo2024!',
  },
};

const DEMO_COMPANY_ID = import.meta.env.VITE_DEMO_COMPANY_ID || '';

interface AppCard {
  id: 'manager' | 'kiosk';
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  role: string;
  features: string[];
  color: string;
  gradient: string;
  account: keyof typeof DEMO_ACCOUNTS;
}

const APP_CARDS: AppCard[] = [
  {
    id: 'manager',
    icon: LayoutDashboard,
    title: 'Panel de Manager',
    subtitle: 'Vista de administración',
    description: 'Dashboard completo con escaleta diaria, gestión de empleados, turnos, ausencias y exportación de reportes.',
    role: 'Administrador',
    features: ['Dashboard en tiempo real', 'Gestión de turnos y horarios', 'Control de ausencias y bajas', 'Exportación de reportes'],
    color: 'text-blue-400',
    gradient: 'from-blue-600/20 to-indigo-600/20',
    account: 'admin',
  },
  {
    id: 'kiosk',
    icon: Monitor,
    title: 'Kiosko de Fichaje',
    subtitle: 'Terminal de empleados',
    description: 'Terminal táctil para que los empleados registren entradas, salidas, descansos y soliciten permisos.',
    role: 'Terminal compartido',
    features: ['Fichaje por DNI', 'Entrada / Salida / Descanso', 'Solicitud de ausencias', 'Historial mensual'],
    color: 'text-emerald-400',
    gradient: 'from-emerald-600/20 to-teal-600/20',
    account: 'kiosk',
  },
];

export default function DemoHome() {
  const navigate = useNavigate();
  const [loadingCard, setLoadingCard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnter = async (card: AppCard) => {
    setLoadingCard(card.id);
    setError(null);

    try {
      // Cerrar sesión previa si la hay
      await supabase.auth.signOut();

      // Login con la cuenta demo correspondiente
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: DEMO_ACCOUNTS[card.account].email,
        password: DEMO_ACCOUNTS[card.account].password,
      });

      if (loginError) throw loginError;
      if (!data.user) throw new Error('No se pudo autenticar');

      if (card.id === 'manager') {
        // Configurar empresa activa
        const companyId = DEMO_COMPANY_ID || await fetchDemoCompanyId(data.user.id);
        if (companyId) {
          localStorage.setItem('active_company_id', companyId);
        }
        navigate('/manager');
      } else if (card.id === 'kiosk') {
        const companyId = DEMO_COMPANY_ID || await fetchDemoCompanyId(data.user.id);
        if (companyId) {
          localStorage.setItem('kiosk_demo_company_id', companyId);
          localStorage.setItem('kiosk_pin', '1234');
          localStorage.setItem('kiosk_device_id', 'demo-device-001');
        }
        navigate('/kiosk');
      }
    } catch (err: any) {
      console.error('Error entering demo:', err);
      setError(err.message || 'Error al iniciar la demo. Revisa las credenciales en .env');
    } finally {
      setLoadingCard(null);
    }
  };

  const fetchDemoCompanyId = async (userId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  };

  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {/* Demo Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-4 py-1.5 rounded-full flex items-center gap-2 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Entorno de Demostración — {DEMO_COMPANY_NAME}
      </div>

      <div className="max-w-5xl w-full relative z-10">

        {/* Header */}
        <div className="text-center mb-12 animate-fadeInUp">
          <div className="inline-flex items-center gap-2.5 bg-surface-dark border border-white/5 rounded-2xl px-5 py-2.5 mb-6">
            <Building2 size={16} className="text-primary" />
            <span className="text-sm font-medium text-slate-300">{DEMO_COMPANY_NAME}</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Fycheo Demo
            </span>
          </h1>
          <p className="text-slate-400 text-lg max-w-lg mx-auto">
            Explora todas las funcionalidades de Fycheo con datos reales de una empresa ficticia con un año de historial.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-xl mx-auto">
          {[
            { icon: Users, label: '24 empleados', color: 'text-blue-400' },
            { icon: Clock, label: '12 meses de datos', color: 'text-emerald-400' },
            { icon: Calendar, label: '4 equipos activos', color: 'text-purple-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-surface-dark border border-white/5 rounded-2xl p-4 text-center">
              <stat.icon size={20} className={`${stat.color} mx-auto mb-2`} />
              <span className="text-xs text-slate-400">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* App Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {APP_CARDS.map((card) => (
            <div
              key={card.id}
              className={`bg-surface-dark border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-all duration-300 group cursor-pointer relative overflow-hidden`}
              onClick={() => !loadingCard && handleEnter(card)}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon size={28} className={card.color} />
                </div>

                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{card.title}</h2>
                  <span className="text-[10px] font-medium bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-full">
                    {card.role}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">{card.description}</p>

                <ul className="space-y-2 mb-8">
                  {card.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${card.color.replace('text-', 'bg-')}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    loadingCard === card.id
                      ? 'bg-white/5 text-slate-400 cursor-wait'
                      : `bg-primary hover:bg-primary-light text-white shadow-glow`
                  }`}
                  disabled={!!loadingCard}
                >
                  {loadingCard === card.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Acceder como {card.subtitle}
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Employee app card (smaller) */}
        <div className="bg-surface-dark border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-white/10 transition-all">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Smartphone size={20} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">App de Empleado (PWA)</h3>
            <p className="text-xs text-slate-500">La app móvil para empleados usa las mismas credenciales de Supabase. Accede desde el móvil con la URL del kiosko.</p>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-4 rounded-xl text-center">
            {error}
          </div>
        )}

        <p className="text-center text-xs text-slate-600 mt-8">
          Datos ficticios · Solo para demostración · No representa datos reales
        </p>
      </div>
    </div>
  );
}
