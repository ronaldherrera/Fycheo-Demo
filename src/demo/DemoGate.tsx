import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, ArrowRight, Loader2, ShieldCheck, Lock } from 'lucide-react';

const STORAGE_KEY = 'fycheo_demo_access';

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

async function trackVisit(email: string) {
  await supabase.from('demo_visits').insert({
    email,
    device_type: detectDevice(),
    user_agent:  navigator.userAgent.slice(0, 250),
  });
}

interface Props {
  children: React.ReactNode;
}

export default function DemoGate({ children }: Props) {
  const [status, setStatus] = useState<'checking' | 'gate' | 'loading' | 'granted' | 'denied'>('checking');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // Verificar que el email guardado sigue siendo válido
      supabase
        .from('demo_access')
        .select('email')
        .eq('email', saved)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            trackVisit(saved);
            setStatus('granted');
          } else {
            setStatus('gate');
          }
        });
    } else {
      setStatus('gate');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setError('');

    const { data } = await supabase
      .from('demo_access')
      .select('email, name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (data) {
      const cleanEmail = email.trim().toLowerCase();
      localStorage.setItem(STORAGE_KEY, cleanEmail);
      trackVisit(cleanEmail);
      setStatus('granted');
    } else {
      setError('Este email no tiene acceso a la demo. Contacta con el equipo de Fycheo.');
      setStatus('gate');
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'granted') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-6 relative overflow-hidden">

      {/* Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">

        {/* Logo / Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
            <Lock size={28} className="text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Acceso a la Demo</h1>
          <p className="text-slate-400 text-sm">
            Introduce tu email para acceder a la demo de Fycheo.
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-dark border border-white/5 rounded-3xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="tu@empresa.com"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !email}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {status === 'loading' ? (
                <><Loader2 size={16} className="animate-spin" /> Verificando...</>
              ) : (
                <>Acceder a la Demo <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 flex items-start gap-3">
            <ShieldCheck size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">
              El acceso está restringido. Si no tienes acceso, contacta con{' '}
              <a href="mailto:hola@fycheo.es" className="text-primary hover:underline">
                hola@fycheo.es
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          fycheo.es · Demo privada
        </p>
      </div>
    </div>
  );
}
