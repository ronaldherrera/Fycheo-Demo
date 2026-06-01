import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building2, CheckCircle2 } from 'lucide-react';

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Crear Empresa
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert([{ name: companyName, plan: 'free' }])
        .select()
        .single();

      if (companyError) throw companyError;

      // 2. Asociar Admin a la Empresa y asignar rol Admin
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
            company_id: company.id,
            role: 'admin'
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 3. Refrescar contexto para redirigir al Dashboard
      await refreshProfile();
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al crear la empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-surface-dark rounded-2xl shadow-2xl border border-white/5 overflow-hidden flex flex-col md:flex-row">
        
        {/* Lado Informativo */}
        <div className="bg-primary p-8 text-white flex flex-col justify-between md:w-2/5 inverted-colors">
            <div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                    <Building2 size={24} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-4">¡Bienvenido a Fycheo!</h2>
                <p className="text-blue-100 leading-relaxed">
                    Para comenzar, necesitas configurar tu organización. Esto te permitirá gestionar empleados, turnos y fichajes.
                </p>
            </div>
            <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-sm text-blue-100">
                    <CheckCircle2 size={16} /> <span>Gestión de Empleados</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-blue-100">
                    <CheckCircle2 size={16} /> <span>Control de Fichajes</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-blue-100">
                    <CheckCircle2 size={16} /> <span>Múltiples Sedes</span>
                </div>
            </div>
        </div>

        {/* Formulario */}
        <div className="p-8 md:w-3/5 flex flex-col justify-center">
            <h3 className="text-xl font-bold text-white mb-1">Crea tu Empresa</h3>
            <p className="text-slate-400 text-sm mb-6">Dale un nombre a tu espacio de trabajo principal.</p>

            {error && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-500/20">
                    {error}
                </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">Nombre de la Empresa</label>
                    <input
                        type="text"
                        required
                        placeholder="Ej. Acme Inc."
                        className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all bg-background-dark text-white placeholder:text-slate-600 focus:bg-background-dark"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 mt-4"
                >
                    {loading ? 'Configurando...' : 'Empezar ahora'}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}
