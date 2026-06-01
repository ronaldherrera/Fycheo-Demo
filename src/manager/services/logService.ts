import { supabase } from './supabase';
import type { ActivityLog } from '../types';

export const logService = {
  async getLogs(companyId: string, limit = 50) {
    if (!companyId) return [];
    
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    if (!data || data.length === 0) return [];

    // Cargar los perfiles manualmente para evitar errores de Foreign Key en Supabase
    const managerIds = [...new Set(data.map((log: any) => log.manager_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar')
      .in('id', managerIds);

    const profileMap = (profiles || []).reduce((acc: any, profile: any) => {
      acc[profile.id] = profile;
      return acc;
    }, {});

    return data.map((log: any) => ({
      ...log,
      manager: profileMap[log.manager_id] || null
    })) as ActivityLog[];
  },

  async logAction(
    companyId: string, 
    managerId: string, 
    actionType: string, 
    description: string, 
    metadata: Record<string, any> = {}
  ) {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          company_id: companyId,
          manager_id: managerId,
          action_type: actionType,
          description,
          metadata
        });
        
      if (error) {
        console.error('Failed to write activity log:', error);
      }
    } catch (e) {
      console.error('Error in logAction:', e);
    }
  }
};
