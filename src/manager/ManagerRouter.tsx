import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import EmployeeDetail from './pages/EmployeeDetail';
import Shifts from './pages/Shifts';
import { CompaniesHub } from './pages/CompaniesHub';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Account from './pages/Account';
import Leaves from './pages/Leaves';
import Export from './pages/Export';
import AuditLogs from './pages/AuditLogs';
import BulkNominas from './pages/BulkNominas';
import Employees from './pages/Employees';
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
        const { data: owned } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1);

        const { data: member } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', user.id)
          .in('role', ['admin', 'hr', 'manager'])
          .limit(1);

        const ok = (owned && owned.length > 0) || (member && member.length > 0);
        setHasAccess(ok);
        if (!ok) await signOut();
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
    return <div className="h-screen flex items-center justify-center bg-[#18181b] text-primary">Cargando Demo...</div>;
  }

  if (!user || !hasAccess) {
    // En demo: redirigir a la pantalla de inicio en lugar del login
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const activeCompanyId = localStorage.getItem('active_company_id');
  const isHubPage = location.pathname === '/manager/hub';

  if (!activeCompanyId && !isHubPage) {
    return <Navigate to="/manager/hub" replace />;
  }

  if (activeCompanyId && isHubPage && location.state?.fromLogin) {
    return <Navigate to="/manager" replace />;
  }

  return children;
}

function ManagerRouter() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="hub" element={
          <ProtectedRoute>
            <CompaniesHub />
          </ProtectedRoute>
        } />

        <Route path="onboarding" element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        } />

        <Route path="" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="equipos" element={<Teams />} />
          <Route path="equipos/trabajador/:employeeId" element={<EmployeeDetail />} />
          <Route path="empleados" element={<Employees />} />
          <Route path="turnos" element={<Shifts />} />
          <Route path="ausencias" element={<Leaves />} />
          <Route path="exportacion" element={<Export />} />
          <Route path="auditoria" element={<AuditLogs />} />
          <Route path="nominas" element={<BulkNominas />} />
          <Route path="configuracion" element={<Settings />} />
          <Route path="account" element={<Account />} />
        </Route>

        <Route path="*" element={<Navigate to="/manager" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default ManagerRouter;
