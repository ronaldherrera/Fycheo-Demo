import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import type { Company } from '../types';

export const CompaniesHub = () => {
  const navigate = useNavigate();
  const { selectCompany } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Obtener empresas donde soy owner
      const { data: ownedCompanies, error: ownerError } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', user.id);
      
      if (ownerError) throw ownerError;

      // 2. Obtener empresas donde soy miembro (join)
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select('company_id, role, companies:company_id(*)')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // Combinar listas filtrando roles administrativos
      const myOwned = (ownedCompanies || []).map(c => ({ ...c, role: 'owner' }));
      const myMember = (memberData || [])
        .filter((m: any) => ['admin', 'hr', 'manager'].includes(m.role))
        .map((m: any) => ({ ...m.companies, role: m.role }));
      
      // Filtrar duplicados
      const all = [...myOwned, ...myMember].filter((v,i,a)=>a.findIndex(v2=>(v2.id===v.id))===i);

      setCompanies(all);
    } catch (err) {
      console.error("Error loading companies", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = async (company: Company) => {
    await selectCompany(company.id);
    navigate('/manager');
  };

  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-white">
      
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

      <div className="max-w-5xl w-full relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-3 tracking-tight">
                Tus Organizaciones
            </h1>
            <p className="text-slate-400 text-lg">Selecciona un espacio de trabajo para gestionar</p>
        </div>

        {loading ? (
             <div className="flex justify-center py-20">
                 <Loader2 className="w-8 h-8 text-primary animate-spin" />
             </div>
        ) : (
            <>
                {companies.length === 0 ? (
                    <div className="text-center py-12 bg-surface-dark border border-white/5 rounded-2xl">
                        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-white mb-2">No tienes organizaciones</h3>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Debes crear una organización desde la plataforma web para poder gestionarla aquí.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-wrap justify-center gap-6">
                        {/* Lista de Empresas */}
                        {companies.map(company => (
                            <div 
                                key={company.id} 
                                onClick={() => handleSelectCompany(company)}
                                className="bg-surface-dark p-6 rounded-2xl shadow-lg border border-white/5 hover:border-primary/50 hover:shadow-glow-lg transition-all w-full max-w-sm h-64 flex flex-col justify-between group relative overflow-hidden cursor-pointer text-left"
                            >

                                
                                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-4 ring-1 ring-white/10 overflow-hidden shrink-0">
                                    {company.logo_url ? (
                                        <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 className="w-8 h-8" />
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col justify-center items-start w-full">
                                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{company.name}</h3>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={cn(
                                            "text-xs font-semibold px-2.5 py-1 rounded-md border",
                                            company.role === 'owner' 
                                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20" 
                                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                        )}>
                                            {company.role === 'owner' ? 'Propietario' : 'Miembro'}
                                        </span>
                                        <span className="text-xs font-semibold px-2.5 py-1 bg-white/5 text-slate-400 border border-white/10 rounded-md">
                                            Plan {company.plan}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="text-sm text-slate-500 flex items-center justify-end gap-2 group-hover:text-primary transition-colors mt-auto w-full">
                                   <span>Acceder al panel</span>
                                   <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};
