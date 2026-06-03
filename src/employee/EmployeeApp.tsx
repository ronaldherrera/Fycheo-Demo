
import React, { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import SigninScreen from "./components/SigninScreen";
import LoginScreen from './components/LoginScreen';
import DashboardScreen from './components/DashboardScreen';
import ProfileScreen from './components/ProfileScreen';
import HistoryScreen from './components/HistoryScreen';
import DocumentsScreen from './components/DocumentsScreen';
import SolicitudesScreen from './components/SolicitudesScreen';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { supabase } from "./services/supabase";

export const AppContext = React.createContext<{
  user: any;
  setUser: (u: any) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (b: boolean) => void;
}>({
  user: null,
  setUser: () => {},
  isLoggedIn: false,
  setIsLoggedIn: () => {}
});

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);

  const applyDemoOverride = (baseUser: any) => {
    try {
      const raw = localStorage.getItem('demo_employee_override');
      if (raw) {
        const override = JSON.parse(raw);
        console.log('[Demo] Applying employee override:', override.id, override.email);
        return { ...baseUser, ...override };
      }
    } catch {}
    console.log('[Demo] No override, using auth user:', baseUser?.id);
    return baseUser;
  };

  useEffect(() => {
    // 1. Revisar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(applyDemoOverride(session.user));
        setIsLoggedIn(true);
      }
      setLoadingSession(false);
    });

    // 2. Escuchar cambios (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(applyDemoOverride(session.user));
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <span className="animate-pulse font-bold">Cargando sesión...</span>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, setUser, isLoggedIn, setIsLoggedIn }}>
      <NotificationsProvider>
      <MemoryRouter>
        <Routes>
          <Route path="/signin" element={<SigninScreen />} />
          <Route path="/" element={isLoggedIn ? <Navigate to="/dashboard" /> : <LoginScreen />} />
          <Route path="/dashboard" element={isLoggedIn ? <DashboardScreen /> : <Navigate to="/" />} />
          <Route path="/profile" element={isLoggedIn ? <ProfileScreen /> : <Navigate to="/" />} />
          <Route path="/history" element={isLoggedIn ? <HistoryScreen /> : <Navigate to="/" />} />
          <Route path="/documents" element={isLoggedIn ? <DocumentsScreen /> : <Navigate to="/" />} />
          <Route path="/solicitudes" element={isLoggedIn ? <SolicitudesScreen /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </MemoryRouter>
      </NotificationsProvider>
    </AppContext.Provider>
  );
};

export default App;
