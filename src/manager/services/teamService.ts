import { supabase } from './supabase';
import type { Team } from '../types';

export const teamService = {
  async getTeams(companyId: string) {
    if (!companyId) return [];
    
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    return data as Team[];
  },

  async createTeam(team: Omit<Team, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('teams')
      .insert([team])
      .select()
      .single();
      
    if (error) throw error;
    return data as Team;
  },

  async updateTeam(teamId: string, updates: Partial<Team>) {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select()
      .single();
      
    if (error) throw error;
    return data as Team;
  },

  async deleteTeam(teamId: string) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);
      
    if (error) throw error;
    return true;
  }
};
