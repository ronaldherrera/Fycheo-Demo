import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Company, Employee } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Employee | null;
  activeCompany: Company | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectCompany: (companyId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  activeCompany: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  selectCompany: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          loadActiveCompany(session.user.id)
        ]).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        loadActiveCompany(session.user.id);
      } else {
        setProfile(null);
        setActiveCompany(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadActiveCompany = async (userId: string) => {
      const companyId = localStorage.getItem('active_company_id');
      if (companyId) {
          try {
              const { data, error } = await supabase
                  .from('companies')
                  .select(`
                    *,
                    company_members!inner(role)
                  `)
                  .eq('id', companyId)
                  .eq('company_members.user_id', userId)
                  .single();
              
              if (!error && data) {
                  const memberData = Array.isArray(data.company_members) ? data.company_members[0] : data.company_members;
                  const role = memberData?.role;
                  
                  const isOwner = data.owner_id === userId;
                  const isAdmin = ['admin', 'hr', 'manager'].includes(role);

                  if (isOwner || isAdmin) {
                      setActiveCompany({ ...data, role } as Company);
                  } else {
                      localStorage.removeItem('active_company_id');
                      setActiveCompany(null);
                  }
              } else {
                  localStorage.removeItem('active_company_id');
                  setActiveCompany(null);
              }
          } catch (e) {
              console.error("Error loading active company", e);
          }
      }
  };

  const fetchProfile = async (userId: string) => {
    // ... (sin cambios, manteniendo fetchProfile existente)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    }
  };

  const selectCompany = async (companyId: string | null) => {
      if (companyId) {
          localStorage.setItem('active_company_id', companyId);
          if (user) await loadActiveCompany(user.id);
      } else {
          localStorage.removeItem('active_company_id');
          setActiveCompany(null);
      }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
    setActiveCompany(null);
    localStorage.removeItem('active_company_id');
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, activeCompany, loading, signOut, refreshProfile, selectCompany }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
