import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";
import { Logo } from "./Logo";


const SigninScreen: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(() => {
    const okEmail = email.trim().length > 3;
    const okPass = password.length >= 8 && /\d/.test(password) && /[A-Z]/.test(password);
    const okConfirm = password === confirm;
    return okEmail && okPass && okConfirm && !loading;
  }, [email, password, confirm, loading]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    // Si hay confirmación por email activa, session puede venir null
    if (!data.session) {
      setMessage({
        type: "success",
        text: "Cuenta creada ✅ Revisa tu correo para confirmar y luego inicia sesión.",
      });
      return;
    }

    setMessage({ type: "success", text: "Cuenta creada y sesión iniciada ✅" });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-[480px]">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="mb-8 transform hover:scale-105 transition-transform duration-300 flex justify-center">
             <img src="/fycheo_negro.svg" alt="Fycheo" className="h-12 w-auto object-contain dark:hidden" />
             <img src="/fycheo_blanco.svg" alt="Fycheo" className="h-12 w-auto object-contain hidden dark:block" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-center text-slate-900 dark:text-white/90">
            Crear cuenta
          </h1>
          <p className="text-slate-500 dark:text-[#92a4c9] mt-2 text-center text-sm font-medium">
            Empieza a controlar tu tiempo
          </p>
        </div>

        <form className="flex flex-col gap-5 w-full" onSubmit={handleSignUp}>
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
                className="block w-full h-14 pl-12 pr-4 rounded-xl border-0 bg-white dark:bg-surface-dark ring-1 ring-inset ring-slate-200 dark:ring-[#324467] focus:ring-2 focus:ring-inset focus:ring-primary sm:text-base text-slate-900 dark:text-white outline-none"
                placeholder="usuario@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

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
                className="block w-full h-14 pl-12 pr-12 rounded-xl border-0 bg-white dark:bg-surface-dark ring-1 ring-inset ring-slate-200 dark:ring-[#324467] focus:ring-2 focus:ring-inset focus:ring-primary sm:text-base text-slate-900 dark:text-white outline-none"
                placeholder="mínimo 6 caracteres"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
            
            {/* Password Requirements */}
            <div className="flex flex-wrap items-center gap-3 pt-1 pl-1">
               {(() => {
                  const reqs = [
                    { label: "Mín. 8 caracteres", valid: password.length >= 8 },
                    { label: "Un número", valid: /\d/.test(password) },
                    { label: "Una mayúscula", valid: /[A-Z]/.test(password) },
                  ];
                  return reqs.map((req, idx) => (
                    <div key={idx} className={`flex items-center gap-1 text-xs font-medium transition-colors ${req.valid ? 'text-emerald-500' : 'text-slate-400'}`}>
                       <span className="material-symbols-outlined text-[14px]">
                          {req.valid ? 'check_circle' : 'radio_button_unchecked'}
                       </span>
                       {req.label}
                    </div>
                  ));
               })()}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-white ml-1">
              Confirmar contraseña
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">
                  lock_reset
                </span>
              </div>
              <input
                className="block w-full h-14 pl-12 pr-4 rounded-xl border-0 bg-white dark:bg-surface-dark ring-1 ring-inset ring-slate-200 dark:ring-[#324467] focus:ring-2 focus:ring-inset focus:ring-primary sm:text-base text-slate-900 dark:text-white outline-none"
                placeholder="repite la contraseña"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {confirm && (
              <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium transition-colors ${password === confirm ? 'text-emerald-500' : 'text-red-500'}`}>
                  <span className="material-symbols-outlined text-[14px]">
                      {password === confirm ? 'check_circle' : 'cancel'}
                  </span>
                  {password === confirm ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
              </div>
            )}
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

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-14 bg-primary hover:bg-blue-600 disabled:opacity-60 text-white font-bold rounded-xl shadow-glow shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-12 rounded-xl bg-white dark:bg-surface-dark ring-1 ring-inset ring-slate-200 dark:ring-[#324467] hover:bg-slate-50 dark:hover:bg-[#202b40] transition-colors font-semibold text-slate-700 dark:text-white"
          >
            Volver al login
          </button>
        </form>
      </div>
    </div>
  );
};

export default SigninScreen;
