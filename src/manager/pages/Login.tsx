import { useState } from 'react';
import { supabase } from '../services/supabase';
import logo from '../assets/logo.png';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    new URLSearchParams(window.location.search).get('error') === 'unauthorized'
      ? 'Acceso denegado. Este portal está reservado exclusivamente para administradores, recursos humanos y managers.'
      : null
  );
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      if (!session) throw new Error("No se pudo iniciar sesión.");

      // 1. Verificar si es propietario de alguna empresa
      const { data: owned, error: ownerError } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', session.user.id)
        .limit(1);

      if (ownerError) throw ownerError;

      // 2. Verificar si es miembro con rol administrativo en alguna empresa
      const { data: members, error: memberError } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', session.user.id)
        .in('role', ['admin', 'hr', 'manager'])
        .limit(1);

      if (memberError) throw memberError;

      const isOwner = owned && owned.length > 0;
      const isAdminMember = members && members.length > 0;

      if (!isOwner && !isAdminMember) {
        await supabase.auth.signOut();
        throw new Error("Acceso denegado. Este portal está reservado exclusivamente para administradores, recursos humanos y managers.");
      }

      navigate('/');

    } catch (err: any) {
      console.error(err);
      if (err.message === "Invalid login credentials") {
        setError("Correo o contraseña incorrectos.");
      } else {
        setError(err.message || 'Error al iniciar sesión.');
      }

      if (err.message?.includes("vinculada")) {
          await supabase.auth.signOut();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const resetUrl = isLocal
      ? 'http://localhost:3002/restablecer-contrasena'
      : 'https://fycheo.es/restablecer-contrasena';

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetUrl,
      });

      if (resetError) throw resetError;

      setRecoverySuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al enviar el correo de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setRecoverySuccess(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 font-sans">
      <div className="bg-[#18181b] p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/10 relative overflow-hidden">

        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10">
            <div className="flex flex-col items-center mb-8">
                <img src={logo} alt="Fycheo" className="h-16 object-contain mb-4" onError={(e) => e.currentTarget.style.display='none'} />
                <h1 className="text-2xl font-bold text-white tracking-tight">Fycheo Manager</h1>
                <p className="text-slate-400 text-sm mt-2">
                  {isForgotPassword ? 'Recuperar contraseña' : 'Gestión de Organización'}
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-3">
                    <span className="block w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
                    <p className="flex-1 text-sm leading-relaxed">{error}</p>
                </div>
            )}

            {isForgotPassword ? (
              recoverySuccess ? (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-9 h-9 text-green-500" />
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">Correo enviado</p>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.
                    </p>
                  </div>
                  <button
                    onClick={handleBackToLogin}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Volver a Iniciar Sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <p className="text-slate-400 text-sm leading-relaxed -mt-2 mb-1">
                    Introduce tu correo y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Correo Profesional</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="nombre@empresa.com"
                        className="w-full pl-11 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span className={`w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin ${loading ? 'block' : 'hidden'}`}></span>
                    <span className={loading ? 'hidden' : 'block'}>Enviar enlace de recuperación</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm transition-colors py-1"
                  >
                    <ArrowLeft size={15} />
                    Volver a Iniciar Sesión
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Correo Profesional</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                            <Mail size={18} />
                        </div>
                        <input
                            type="email"
                            required
                            placeholder="nombre@empresa.com"
                            className="w-full pl-11 pr-4 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Contraseña</label>
                      <button
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setError(null); }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                            <Lock size={18} />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            className="w-full pl-11 pr-12 py-3 bg-black/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors cursor-pointer"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-2"
                >
                    <span className={`w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin ${loading ? 'block' : 'hidden'}`}></span>
                    <span className={`flex items-center gap-2 ${loading ? 'hidden' : 'flex'}`}>
                        <span>Iniciar Sesión</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </span>
                </button>
              </form>
            )}
        </div>
      </div>
    </div>
  );
}
