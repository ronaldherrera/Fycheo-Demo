import React, { useContext, useMemo, useState } from "react";
import { AppContext } from '../EmployeeApp';
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { Logo } from "./Logo";

const LoginScreen: React.FC = () => {
  const { setIsLoggedIn } = useContext(AppContext); // lo mantenemos por compatibilidad con tu App actual
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const canSubmit = useMemo(() => {
    if (isRecovering) {
      return email.trim().length > 3 && !loading;
    }
    return email.trim().length > 3 && password.length >= 6 && !loading;
  }, [email, password, loading, isRecovering]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    if (isRecovering) {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      const resetUrl = isLocal
        ? "http://localhost:3002/restablecer-contrasena?origin=app"
        : "https://fycheo.es/restablecer-contrasena?origin=app";

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: resetUrl,
      });
      setLoading(false);
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Si el correo existe, recibirás un enlace." });
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    // ✅ Login real logrado
    // Mantengo esto para que tu app actual reaccione (porque aún usas isLoggedIn en AppContext)
    setIsLoggedIn(true);

    setMessage({ type: "success", text: "Sesión iniciada ✅" });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-[480px] h-full flex flex-col relative">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="mb-8 transform hover:scale-105 transition-transform duration-300 flex justify-center">
             <img src="https://fycheo.es/brand/logotipo_bg-light.svg" alt="Fycheo" className="h-12 w-auto object-contain dark:hidden" />
             <img src="https://fycheo.es/brand/logotipo_bg-dark.svg" alt="Fycheo" className="h-12 w-auto object-contain hidden dark:block" />
          </div>
          
          <h1 className="text-2xl font-bold tracking-tight text-center text-slate-900 dark:text-white/90">
            {isRecovering ? "Recuperar contraseña" : "Bienvenido"}
          </h1>
          <p className="text-slate-500 dark:text-[#92a4c9] mt-2 text-center text-sm font-medium">
            {isRecovering 
              ? "Ingresa tu correo para recibir un enlace de recuperación" 
              : "Controla tu tiempo, maximiza tu día"}
          </p>
        </div>

        <form className="flex flex-col gap-5 w-full mt-4" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">
              Correo electrónico
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">
                  mail
                </span>
              </div>
              <input
                className="block w-full h-14 pl-12 pr-4 rounded-xl border-0 bg-white dark:bg-surface-dark ring-1 ring-inset ring-slate-200 dark:ring-[#324467] focus:ring-2 focus:ring-inset focus:ring-primary dark:focus:ring-primary sm:text-base sm:leading-6 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#92a4c9] shadow-sm transition-all outline-none"
                placeholder="usuario@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          {!isRecovering && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">
                Contraseña
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">
                    lock
                  </span>
                </div>

                <input
                  className="block w-full h-14 pl-12 pr-12 rounded-xl border-0 bg-white dark:bg-surface-dark ring-1 ring-inset ring-slate-200 dark:ring-[#324467] focus:ring-2 focus:ring-inset focus:ring-primary dark:focus:ring-primary sm:text-base sm:leading-6 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#92a4c9] shadow-sm transition-all outline-none"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              className="text-sm font-semibold text-primary hover:text-blue-400 transition-colors"
              onClick={() => {
                setIsRecovering(!isRecovering);
                setMessage(null);
              }}
            >
              {isRecovering ? "¿Ya tienes cuenta? Inicia sesión" : "¿Olvidaste tu contraseña?"}
            </button>
          </div>

          {message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-semibold ring-1 ${
                message.type === "error"
                  ? "bg-red-500/10 text-red-200 ring-red-500/30"
                  : "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-14 bg-primary hover:bg-blue-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-glow shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <span>{loading ? "Procesando..." : (isRecovering ? "Enviar enlace" : "Iniciar Sesión")}</span>
            </button>
          </div>
        </form>
        
        {!isRecovering && (
          <>
            <div className="relative py-8 flex items-center gap-4">
              <div className="h-px bg-slate-200 dark:bg-[#324467] flex-1"></div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">O accede con</span>
              <div className="h-px bg-slate-200 dark:bg-[#324467] flex-1"></div>
            </div>

            <div>
              <button
                type="button"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-surface-dark ring-1 ring-inset ring-slate-200 dark:ring-[#324467] hover:bg-slate-50 dark:hover:bg-[#202b40] transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={async () => {
                  setLoading(true);
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: window.location.origin + "/dashboard",
                    },
                  });
                  if (error) {
                     setLoading(false);
                     setMessage({ type: "error", text: error.message });
                  }
                }}
              >
                <div className="w-5 h-5 rounded-full border-4 border-l-blue-500 border-t-red-500 border-r-yellow-400 border-b-green-500 group-hover:rotate-90 transition-transform duration-500"></div>
                <span className="text-sm font-semibold text-slate-700 dark:text-white">Google</span>
              </button>
            </div>
          </>
        )}

        <div className="mt-auto pt-8 pb-4 text-center">
          <p className="text-slate-500 dark:text-[#92a4c9] text-sm font-medium">
            ¿No tienes una cuenta?
            <button
              type="button"
              onClick={() => navigate("/signin")}
              className="font-bold text-primary hover:text-blue-400 ml-1 transition-colors"
            >
              Crear cuenta nueva
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
