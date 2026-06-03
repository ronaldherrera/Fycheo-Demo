import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppContext } from '../EmployeeApp';
import { supabase } from '../services/supabase';

interface NotificationsContextType {
  unseenDocs: number;
  unseenSolicitudes: number;
  total: number;
  markDocsAsSeen: () => Promise<void>;
  markSolicitudesAsSeen: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  unseenDocs: 0,
  unseenSolicitudes: 0,
  total: 0,
  markDocsAsSeen: async () => {},
  markSolicitudesAsSeen: async () => {},
});

export const useNotifications = () => useContext(NotificationsContext);

export const NotificationsProvider = ({ children }: { children: any }) => {
  const { user } = useContext(AppContext);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [unseenDocs, setUnseenDocs] = useState(0);
  const [unseenSolicitudes, setUnseenSolicitudes] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('accepted', true)
      .maybeSingle()
      .then(({ data }) => { if (data) setCompanyId(data.company_id); });
  }, [user?.id]);

  const checkDocs = useCallback(async () => {
    if (!user?.id || !companyId) return;
    const seenIds: string[] = JSON.parse(
      localStorage.getItem(`fycheo_seen_docs_${user.id}`) || '[]'
    );
    const { data } = await supabase
      .from('employee_documents')
      .select('id')
      .eq('employee_id', user.id)
      .eq('company_id', companyId);
    const unseen = (data || []).filter(d => !seenIds.includes(d.id)).length;
    setUnseenDocs(unseen);
  }, [user?.id, companyId]);

  const checkSolicitudes = useCallback(async () => {
    if (!user?.id || !companyId) return;
    const seenStates: Record<string, string> = JSON.parse(
      localStorage.getItem(`fycheo_seen_sol_states_${user.id}`) || '{}'
    );
    const { data } = await supabase
      .from('absences')
      .select('id, status')
      .eq('employee_id', user.id)
      .eq('company_id', companyId);
    const unseen = (data || []).filter(a => {
      if (a.status === 'pending') return false;
      return seenStates[a.id] !== a.status;
    }).length;
    setUnseenSolicitudes(unseen);
  }, [user?.id, companyId]);

  useEffect(() => {
    if (!companyId || !user?.id) return;
    checkDocs();
    checkSolicitudes();

    const ch1 = supabase.channel('notif_docs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_documents' }, checkDocs)
      .subscribe();
    const ch2 = supabase.channel('notif_sols')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, checkSolicitudes)
      .subscribe();

    // Polling de fallback cada 30s por si Realtime no está habilitado
    const poll = setInterval(() => { checkDocs(); checkSolicitudes(); }, 30_000);

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      clearInterval(poll);
    };
  }, [companyId, user?.id, checkDocs, checkSolicitudes]);

  const markDocsAsSeen = useCallback(async () => {
    if (!user?.id || !companyId) return;
    const { data } = await supabase
      .from('employee_documents')
      .select('id')
      .eq('employee_id', user.id)
      .eq('company_id', companyId);
    localStorage.setItem(
      `fycheo_seen_docs_${user.id}`,
      JSON.stringify((data || []).map(d => d.id))
    );
    setUnseenDocs(0);
  }, [user?.id, companyId]);

  const markSolicitudesAsSeen = useCallback(async () => {
    if (!user?.id || !companyId) return;
    const { data } = await supabase
      .from('absences')
      .select('id, status')
      .eq('employee_id', user.id)
      .eq('company_id', companyId);
    const states: Record<string, string> = {};
    (data || []).forEach(a => { states[a.id] = a.status; });
    localStorage.setItem(`fycheo_seen_sol_states_${user.id}`, JSON.stringify(states));
    setUnseenSolicitudes(0);
  }, [user?.id, companyId]);

  return (
    <NotificationsContext.Provider value={{
      unseenDocs, unseenSolicitudes,
      total: unseenDocs + unseenSolicitudes,
      markDocsAsSeen, markSolicitudesAsSeen,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};
