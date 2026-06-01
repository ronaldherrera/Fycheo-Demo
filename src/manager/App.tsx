import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import EmployeeDetail from './pages/EmployeeDetail';
import Shifts from './pages/Shifts';
import Login from './pages/Login';
import { CompaniesHub } from './pages/CompaniesHub';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Account from './pages/Account';
import Leaves from './pages/Leaves';
import Export from './pages/Export';
import AuditLogs from './pages/AuditLogs';
import BulkNominas from './pages/BulkNominas';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';

import React from 'react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = React.useState(true);
  const [hasAccess, setHasAccess] = React.useState(false);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsValidating(false);
      return;
    }

    const verifyAccess = async () => {
      try {
        // 1. Verificar si es propietario de alguna empresa
        const { data: owned } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1);

        // 2. Verificar si es miembro con rol administrativo en alguna empresa
        const { data: member } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', user.id)
          .in('role', ['admin', 'hr', 'manager'])
          .limit(1);

        const ok = (owned && owned.length > 0) || (member && member.length > 0);
        setHasAccess(ok);
        if (!ok) {
          await signOut();
        }
      } catch (e) {
        console.error(e);
        await signOut();
      } finally {
        setIsValidating(false);
      }
    };

    verifyAccess();
  }, [user, loading, signOut]);

  if (loading || isValidating) {
    return <div className="h-screen flex items-center justify-center bg-[#18181b] text-primary">Cargando Fycheo...</div>;
  }

  if (!user || !hasAccess) {
    return <Navigate to="/login?error=unauthorized" state={{ from: location }} replace />;
  }

  // Verificar si hay empresa seleccionada
  const activeCompanyId = localStorage.getItem('active_company_id');
  const isHubPage = location.pathname === '/hub';
  const isLoginPage = location.pathname === '/login';

  // Si no hay empresa seleccionada y no estoy en el Hub, ir al Hub
  if (!activeCompanyId && !isHubPage && !isLoginPage) {
    return <Navigate to="/hub" replace />;
  }

  // Si hay empresa seleccionada y estoy en el Hub, ir al Dashboard (salvo que quiera cambiar)
  if (activeCompanyId && isHubPage && location.state?.fromLogin) {
      return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/onboarding" element={
            <ProtectedRoute>
                <Onboarding />
            </ProtectedRoute>
          } />

          <Route path="/hub" element={
            <ProtectedRoute>
                <CompaniesHub />
            </ProtectedRoute>
          } />
          
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="equipos" element={<Teams />} />
            <Route path="equipos/trabajador/:employeeId" element={<EmployeeDetail />} />
            <Route path="turnos" element={<Shifts />} />
            <Route path="ausencias" element={<Leaves />} />
            <Route path="exportacion" element={<Export />} />
            <Route path="auditoria" element={<AuditLogs />} />
            <Route path="nominas" element={<BulkNominas />} />
            <Route path="configuracion" element={<Settings />} />
            <Route path="account" element={<Account />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
