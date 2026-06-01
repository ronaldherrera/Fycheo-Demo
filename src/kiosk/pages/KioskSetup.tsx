import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Building2, LogOut, Loader2, ArrowRight } from 'lucide-react';

export default function KioskSetup() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [kioskPin, setKioskPin] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 1. Empresas donde soy owner directo
      const { data: ownedCompanies, error: ownerError } = await supabase
        .from('companies')
        .select('id, name, logo_url, kiosk_device_id, kiosk_pin')
        .eq('owner_id', userData.user.id);

      if (ownerError) throw ownerError;

      // 2. Empresas donde soy miembro como manager u owner
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select(`
          role,
          companies (
            id,
            name,
            logo_url,
            kiosk_device_id,
            kiosk_pin
          )
        `)
        .eq('user_id', userData.user.id)
        .in('role', ['owner', 'manager']);

      if (memberError) throw memberError;
      
      const memberCompanies = memberData?.map((d: any) => d.companies).filter(Boolean) || [];
      const myOwned = ownedCompanies || [];
      
      // Combinar y quitar duplicados por ID
      const allCompanies = [...myOwned, ...memberCompanies].filter((v,i,a) => a.findIndex(v2 => v2.id === v.id) === i);

      setCompanies(allCompanies);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-800 rounded-3xl shadow-xl border border-slate-700 p-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Configurar Kiosko</h1>
            <p className="text-slate-400">Selecciona la empresa para la que quieres activar este kiosko</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors font-medium bg-slate-900 hover:bg-red-500/10 px-4 py-2 rounded-xl border border-slate-700 hover:border-red-500/30"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>

        {companies.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-700 border-dashed">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-300">No hay empresas disponibles</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2">
              Tu usuario no es Manager o Propietario de ninguna empresa. No puedes configurar un kiosko.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className="flex items-center gap-4 p-6 rounded-2xl border-2 border-slate-700 hover:border-primary hover:bg-primary/10 transition-all group text-left bg-slate-900/50"
              >
                <div className="w-14 h-14 bg-slate-800 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-slate-700">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt={company.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-7 h-7 text-slate-500" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">{company.name}</h3>
                  <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                    Activar Kiosko <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Seguridad */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-700 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <LogOut className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-2">Confirmar Vinculación</h2>
            <p className="text-slate-400 text-center mb-6 text-sm">
              Estás a punto de vincular este dispositivo como Kiosko oficial para <strong className="text-white">{selectedCompany.name}</strong>.
              <br /><br />
              {selectedCompany.kiosk_device_id ? (
                <span className="text-amber-400 font-semibold block mb-2">
                  ⚠️ Atención: Esta organización ya tiene un kiosko vinculado. Si continúas, la tablet anterior dejará de funcionar automáticamente.
                </span>
              ) : null}
              El kiosko quedará bloqueado en esta pantalla. Establece un <strong>PIN de 4 dígitos</strong> que usarás para poder desbloquearlo y salir del modo Kiosko en el futuro.
            </p>

            <div className="mb-6">
              <input
                type="password"
                maxLength={4}
                placeholder="PIN de 4 dígitos"
                value={kioskPin}
                onChange={(e) => setKioskPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-[1em] text-2xl py-4 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none placeholder:tracking-normal"
              />
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setSelectedCompany(null);
                  setKioskPin('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (kioskPin.length === 4) {
                    try {
                      // Generar ID único para este kiosko
                      const newDeviceId = crypto.randomUUID();
                      
                      // Guardar en la base de datos
                      const { error } = await supabase
                        .from('companies')
                        .update({ 
                          kiosk_device_id: newDeviceId,
                          kiosk_pin: kioskPin 
                        })
                        .eq('id', selectedCompany.id);

                      if (error) throw error;

                      // Guardar localmente
                      localStorage.setItem('kiosk_pin', kioskPin);
                      localStorage.setItem('kiosk_device_id', newDeviceId);
                      navigate(`/kiosk/${selectedCompany.id}`);
                    } catch (err) {
                      console.error("Error al vincular el kiosko:", err);
                      alert("Hubo un error al vincular el kiosko en la base de datos. Asegúrate de haber ejecutado el SQL para añadir las columnas kiosk_device_id y kiosk_pin.");
                    }
                  }
                }}
                disabled={kioskPin.length !== 4}
                className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-primary/30 disabled:text-white/50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20"
              >
                Vincular y Bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
