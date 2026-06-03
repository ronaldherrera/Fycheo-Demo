import { adjustDataToCurrentDate, deAdjustISOString } from '../../lib/date-adjuster';
import { supabase } from './supabase';
import type { Employee } from '../types';

export const employeeService = {
  async getEmployees(companyId: string) {
    if (!companyId) return [];
    
    // Obtener miembros de la empresa
    const { data, error } = await supabase
      .from('company_members')
      .select(`
        user_id,
        role,
        team_id,
        accepted,
        profiles:user_id (*)
      `)
      .eq('company_id', companyId);
      
    if (error) throw error;
    
    // Aplanar respuesta para que parezca un Employee
    return data.map((item: any) => ({
        ...item.profiles, // Datos del perfil (nombre, email...)
        role: item.role,  // Rol ESPECÍFICO en esta empresa
        team_id: item.team_id, // Equipo en esta empresa
        company_id: companyId,
        accepted: item.accepted
    })) as Employee[];
  },

  async searchUserByEmail(email: string) {
    // Buscar en la tabla profiles por email
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar')
      .eq('email', email.trim())
      .maybeSingle();

    if (error) {
        console.error("Error searching user:", error);
        throw new Error("Error al buscar el usuario.");
    }

    return data; // Retorna null si no lo encuentra o los datos si lo encuentra
  },

  async linkUserToCompany(userId: string, companyId: string, role: string, teamId?: string) {
    // Primero, verificar si ya está en la empresa
    const { data: existing } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .maybeSingle();

    if (existing) {
        throw new Error("Este usuario ya pertenece a la organización.");
    }

    // Añadir a company_members como invitación pendiente (accepted: false)
    const { error } = await supabase
      .from('company_members')
      .insert({
        user_id: userId,
        company_id: companyId,
        role: role,
        team_id: teamId || null,
        accepted: false
      });

    if (error) throw error;
    return true;
  },

  async unlinkUserFromCompany(userId: string, companyId: string) {
    const { error } = await supabase
      .from('company_members')
      .delete()
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) throw error;
    return true;
  },
  
  async updateEmployee(userId: string, companyId: string, updates: Partial<Employee>) {
    // Campos que van a company_members
    const memberUpdates: any = {};
    if (updates.role !== undefined) memberUpdates.role = updates.role;
    if (updates.team_id !== undefined) memberUpdates.team_id = updates.team_id;

    if (Object.keys(memberUpdates).length > 0) {
         const { error } = await supabase
            .from('company_members')
            .update(memberUpdates)
            .eq('user_id', userId)
            .eq('company_id', companyId);
         if (error) throw error;
    }

    // Si hay otros campos de perfil (nombre, etc), actualizar profiles
    // Filtrar campos que no son de profile
    const { role, team_id, company_id, ...profileUpdates } = updates;
    if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', userId);
        if (error) throw error;
    }

    return { ...updates, id: userId } as any; 
  },

  async getEmployeeById(userId: string, companyId: string): Promise<Employee | null> {
    if (!companyId || !userId) return null;
    
    const { data, error } = await supabase
      .from('company_members')
      .select(`
        user_id,
        role,
        team_id,
        profiles:user_id (*)
      `)
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) return null;

    const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

    return {
      id: data.user_id,
      name: profile?.full_name || profile?.name || profile?.email?.split('@')[0] || 'Usuario sin nombre',
      full_name: profile?.full_name || profile?.name,
      email: profile?.email || '',
      avatar: profile?.avatar,
      phone: profile?.phone,
      role: data.role,
      team_id: data.team_id,
      company_id: companyId,
      dni_nie: profile?.dni_nie,
      ss_number: profile?.ss_number
    } as Employee;
  },

  async getTimeEntries(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('occurred_at', deAdjustISOString(startDate))
      .lte('occurred_at', deAdjustISOString(endDate))
      .order('occurred_at', { ascending: true });

    if (error) throw error;
    return adjustDataToCurrentDate(data || []);
  },

  async getTimeEntriesForUsers(userIds: string[], startDate: string, endDate: string) {
    if (!userIds || userIds.length === 0) return [];

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .in('user_id', userIds)
      .gte('occurred_at', deAdjustISOString(startDate))
      .lte('occurred_at', deAdjustISOString(endDate))
      .order('occurred_at', { ascending: true });

    if (error) throw error;
    return adjustDataToCurrentDate(data || []);
  },

  async createTimeEntry(payload: any) {
    const { data, error } = await supabase
      .from('time_entries')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTimeEntry(entryId: string, updates: any) {
    const { data, error } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTimeEntry(entryId: string, cascadeId?: string) {
    const { error: err1 } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId);

    if (err1) throw err1;

    if (cascadeId) {
      const { error: err2 } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', cascadeId);
      if (err2) throw err2;
    }

    return true;
  },

  async updateEmployeeProfileName(userId: string, name: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: name,
        name: name
      })
      .eq('id', userId);

    if (error) throw error;
    return true;
  },

  async getInvitations(_companyId: string) {
    return [];
  },

  async importEmployeesBulk(employeesData: any[], companyId: string) {
    if (!employeesData || employeesData.length === 0) return;

    // Llamamos a la Edge Function
    const { data, error } = await supabase.functions.invoke('invite-employees', {
      body: { employees: employeesData, companyId: companyId }
    });

    if (error) {
      console.error('Error importing employees via Edge Function:', error);
      throw new Error(error.message || 'Error al importar empleados e invitarlos.');
    }

    return true;
  }
};

