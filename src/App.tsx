import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DemoHome from './demo/DemoHome';
import DemoGate from './demo/DemoGate';
import ManagerRouter from './manager/ManagerRouter';
import KioskRouter from './kiosk/KioskRouter';

function App() {
  return (
    <DemoGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DemoHome />} />
          <Route path="/manager/*" element={<ManagerRouter />} />
          <Route path="/kiosk/*" element={<KioskRouter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </DemoGate>
  );
}

export default App;
