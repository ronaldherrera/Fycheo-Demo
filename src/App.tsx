import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DemoShell from './demo/DemoShell';
import DemoGate from './demo/DemoGate';
import ManagerRouter from './manager/ManagerRouter';
import KioskRouter from './kiosk/KioskRouter';
import EmployeeApp from './employee/EmployeeApp';
import AdminPanel from './admin/AdminPanel';
import { Monitor } from 'lucide-react';

const ADMIN_PATH = '/fyadmin';

const DESKTOP_BREAKPOINT = 1024;

function MobileBlock() {
  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />
      <div className="relative z-10 text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
          <Monitor size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Abre desde un ordenador</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          La demo de Fycheo está diseñada para pantallas de escritorio. Accede desde tu ordenador para disfrutar de la experiencia completa.
        </p>
        <p className="mt-6 text-xs text-slate-600">fycheo.es · Demo privada</p>
      </div>
    </div>
  );
}

function App() {
  const inIframe = window.self !== window.top;
  const [isMobile, setIsMobile] = useState(() => !inIframe && window.innerWidth < DESKTOP_BREAKPOINT);

  useEffect(() => {
    if (inIframe) return;
    const mq = window.matchMedia(`(max-width: ${DESKTOP_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [inIframe]);

  const path = typeof window !== 'undefined' ? window.location.pathname : '/';

  if (path === ADMIN_PATH) return <AdminPanel />;

  if (isMobile) return <MobileBlock />;

  // EmployeeApp tiene su propio MemoryRouter — renderizarlo fuera del BrowserRouter
  if (path.startsWith('/employee')) {
    return <EmployeeApp />;
  }

  const content = (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DemoShell />} />
        <Route path="/manager/*" element={<ManagerRouter />} />
        <Route path="/kiosk/*" element={<KioskRouter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );

  // Manager y Kiosk no necesitan DemoGate (ya están autenticados vía DemoShell)
  const skipGate = path.startsWith('/manager') || path.startsWith('/kiosk');
  return skipGate ? content : <DemoGate>{content}</DemoGate>;
}

export default App;
