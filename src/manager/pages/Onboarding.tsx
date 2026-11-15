import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building2, CheckCircle2, ArrowRight } from 'lucide-react';

const DEMO_COMPANY_NAME = 'Distribuciones Martínez S.A.';

/**
 * En producción esta pantalla crea la primera empresa del usuario.
 * En la demo no se pueden crear empresas: la política RLS lo bloquea y la
 * empresa ficticia ya existe. Por eso aquí solo se informa y se vuelve al panel.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { activeCompany } = useAuth();
  const companyName = activeCompany?.name || DEMO_COMPANY_NAME;

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
                    En producción, aquí se configura la organización. En la demo ya está todo listo para gestionar empleados, turnos y fichajes.
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

        {/* Mensaje */}
        <div className="p-8 md:w-3/5 flex flex-col justify-center">
            <h3 className="text-xl font-bold text-white mb-1">La empresa ya está creada</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                En la demo trabajas con <span className="text-white font-medium">{companyName}</span>, una empresa ficticia con sus equipos, empleados y un año de historial. Crear empresas nuevas no está disponible en la demo.
            </p>

            <button
                type="button"
                onClick={() => navigate('/manager')}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
                Ir al panel <ArrowRight size={16} />
            </button>
        </div>
      </div>
    </div>
  );
}
