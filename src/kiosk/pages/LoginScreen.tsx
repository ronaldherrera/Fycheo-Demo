import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2 } from 'lucide-react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedError = sessionStorage.getItem('loginError');
    if (savedError) {
      setError(savedError);
      sessionStorage.removeItem('loginError');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Verificar si es propietario de alguna empresa
        const { data: ownedCompanies } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', data.user.id)
          .limit(1);

        // Verificar si tiene rol de admin, owner o manager en alguna empresa
        const { data: memberRoles } = await supabase
          .from('company_members')
          .select('role')
          .eq('user_id', data.user.id)
          .in('role', ['admin', 'manager', 'owner'])
          .limit(1);

        const hasAdminAccess = (ownedCompanies && ownedCompanies.length > 0) || (memberRoles && memberRoles.length > 0);

        if (!hasAdminAccess) {
          sessionStorage.setItem('loginError', 'No tienes permisos. Para configurar el kiosko, ponte en contacto con tu administrador.');
          await supabase.auth.signOut();
          return;
        }
      }
      
    } catch (err: any) {
      if (err.message === 'Solo los administradores pueden iniciar sesión en el Kiosko') {
        setError(err.message);
      } else {
        setError(err.message === 'Invalid login credentials' 
          ? 'Credenciales incorrectas' 
          : 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl shadow-xl border border-slate-700 p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Fycheo Kiosko</h1>
          <p className="text-slate-400">Inicia sesión como Manager para configurar el kiosko</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-300">Email Profesional</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary text-white outline-none transition-all placeholder-slate-600"
                placeholder="ejemplo@empresa.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-300">Contraseña</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary text-white outline-none transition-all placeholder-slate-600"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/30 mt-8"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Acceder al Kiosko'}
          </button>
        </form>
      </div>
    </div>
  );
}
