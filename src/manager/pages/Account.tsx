import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, CreditCard, Building2, Check } from 'lucide-react';

const plans = [
    {
        name: 'Básico',
        id: 'basic',
        price: '9€',
        period: '/mes',
        features: ['Hasta 5 empleados', 'Fichaje web y móvil', 'Geolocalización básica', 'Reportes mensuales'],
        recommended: false
    },
    {
        name: 'Pro',
        id: 'pro',
        price: '29€',
        period: '/mes',
        features: ['Hasta 25 empleados', 'Fichaje con código QR', 'Gestión de vacaciones', 'Soporte prioritario'],
        recommended: true
    },
    {
        name: 'Ultimate',
        id: 'ultimate',
        price: '39€',
        period: '/mes',
        features: ['Hasta 50 empleados', 'Todo lo del plan Pro', 'Gestión documental', 'Consultoría inicial'],
        recommended: false
    },
    {
        name: 'Enterprise',
        id: 'enterprise',
        price: 'Contactar',
        period: '',
        features: ['Empleados ilimitados', 'API de integración', 'SSO', 'Gestor de cuenta dedicado'],
        recommended: false
    }
];

const Account = () => {
    const { user, profile, activeCompany } = useAuth();
    const [currentPlan, setCurrentPlan] = useState(activeCompany?.plan || profile?.plan_selected || 'free');

    const handlePlanChange = (planId: string) => {
        // Aquí iría la lógica real de cambio de plan (Stripe, etc.)
        alert(`Has seleccionado contratar el plan: ${planId}`);
        setCurrentPlan(planId);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Mi Cuenta</h1>

            {/* Perfil Básico */}
            <div className="bg-surface-dark p-6 rounded-xl shadow-sm border border-white/5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-primary" />
                    Información de Perfil
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Correo Electrónico</label>
                        <div className="text-white font-medium">{user?.email}</div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Rol</label>
                        <div className="text-white font-medium capitalize">{profile?.role || 'Gestor'}</div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
                        <div className="text-white font-medium">{profile?.full_name || profile?.name || '—'}</div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Empresa</label>
                        <div className="text-white font-medium flex items-center gap-2">
                             <Building2 className="h-4 w-4 text-slate-500" />
                            {activeCompany?.name || 'Sin empresa asignada'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Planes y Suscripción */}
            <div className="bg-surface-dark p-6 rounded-xl shadow-sm border border-white/5">
                 <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Suscripción y Planes
                </h2>
                
                <div className="mb-8">
                     <p className="text-slate-400">
                        Actualmente estás en el plan: <span className="font-bold text-primary uppercase">{currentPlan === 'free' ? 'Gratuito / Sin Plan' : currentPlan}</span>
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                        <div 
                            key={plan.id} 
                            className={`relative rounded-xl border p-6 flex flex-col transition-all duration-200 ${
                                currentPlan === plan.id 
                                    ? 'border-primary bg-primary/10 ring-1 ring-primary' 
                                    : 'border-white/5 bg-white/5 hover:border-primary/50 hover:shadow-glow-sm'
                            }`}
                        >
                            {plan.recommended && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm shadow-primary/50">
                                    Recomendado
                                </div>
                            )}
                            
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                                    <span className="text-slate-400 text-sm">{plan.period}</span>
                                </div>
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-400">
                                        <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handlePlanChange(plan.id)}
                                disabled={currentPlan === plan.id}
                                className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                                    currentPlan === plan.id
                                        ? 'bg-white/10 text-slate-400 cursor-default'
                                        : 'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow-glow-sm'
                                }`}
                            >
                                {currentPlan === plan.id ? 'Plan Actual' : (plan.price === 'Contactar' ? 'Contactar' : 'Contratar')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Seguridad (Placeholder) */}
             <div className="bg-surface-dark p-6 rounded-xl shadow-sm border border-white/5 opacity-70">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-slate-500" />
                    Seguridad (Próximamente)
                </h2>
                <p className="text-sm text-slate-400">Aquí podrás cambiar tu contraseña y configurar la autenticación en dos factores.</p>
            </div>
        </div>
    );
};

export default Account;
