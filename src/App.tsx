import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DemoShell from './demo/DemoShell';
import DemoGate from './demo/DemoGate';
import ManagerRouter from './manager/ManagerRouter';
import KioskRouter from './kiosk/KioskRouter';
import EmployeeApp from './employee/EmployeeApp';

function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';

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
