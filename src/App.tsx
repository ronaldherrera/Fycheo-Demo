import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DemoHome from './demo/DemoHome';
import ManagerRouter from './manager/ManagerRouter';
import KioskRouter from './kiosk/KioskRouter';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Demo Home — selector de app/rol */}
        <Route path="/" element={<DemoHome />} />

        {/* Manager — panel de administración */}
        <Route path="/manager/*" element={<ManagerRouter />} />

        {/* Kiosk — terminal de fichaje */}
        <Route path="/kiosk/*" element={<KioskRouter />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
