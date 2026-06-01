import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import KioskModeScreen from './pages/KioskModeScreen';

function KioskRouter() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      // El DemoHome habrá guardado el company ID del kiosko en localStorage
      const stored = localStorage.getItem('kiosk_demo_company_id');
      if (stored) {
        setCompanyId(stored);
      } else {
        // Intentar obtener la primera empresa del usuario
        const { data } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', session.user.id)
          .limit(1)
          .maybeSingle();
        if (data?.id) {
          localStorage.setItem('kiosk_demo_company_id', data.id);
          setCompanyId(data.id);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!companyId) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path=":companyId" element={<KioskModeScreen />} />
      <Route path="" element={<Navigate to={companyId} replace />} />
      <Route path="*" element={<Navigate to={companyId} replace />} />
    </Routes>
  );
}

export default KioskRouter;
