import { adjustDataToCurrentDate, deAdjustISOString } from '../../lib/date-adjuster';
import { supabase } from './supabase';
import type { Employee } from '../types';

/** Fila de la importación CSV (ver ImportEmployeesModal). */
export interface ImportedEmployee {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  dni_nie?: string;
  ss_number?: string;
  team_id?: string | null;
}

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
        weekly_hours,
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
        accepted: item.accepted,
        weekly_hours: item.weekly_hours ?? 40,
    })) as Employee[];
  },

  /**
   * Alta de un empleado desde el modal "Añadir a la Organización" (Teams).
   *
   * Antes buscaba en `profiles` a cualquier usuario de la plataforma por su email y
   * lo vinculaba con un insert en company_members; en producción eso permitiría
   * meter a un usuario real en la empresa demo. Ahora pasa por `demo_add_employee`,
   * que crea el usuario de Auth, su perfil y su fila en company_members
   * (accepted = true) dentro de la empresa del administrador autenticado.
   * Devuelve el id del perfil creado.
   */
  async addEmployee(input: { fullName: string; email: string; teamId?: string | null; role?: string }) {
    const { data, error } = await supabase.rpc('demo_add_employee', {
      p_full_name: input.fullName,
      p_email: input.email,
      p_team_id: input.teamId || null,
      p_role: input.role || 'employee',
    });

    if (error) {
      console.error('Error creando al empleado:', error);
      throw new Error(error.message || 'Error al añadir al empleado.');
    }

    return data as string;
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
    if (updates.weekly_hours !== undefined) memberUpdates.weekly_hours = updates.weekly_hours;

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
    const { role, team_id, company_id, weekly_hours, ...profileUpdates } = updates;
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
        weekly_hours,
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
      ss_number: profile?.ss_number,
      weekly_hours: data.weekly_hours ?? 40,
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

  /**
   * Alta de empleados en bloque (importación CSV).
   *
   * En producción esto lo hace la Edge Function `invite-employees`, que envía
   * correos reales y para la empresa demo responde 403. La demo usa en su lugar
   * la función de base de datos `demo_add_employee`, que crea el usuario de Auth,
   * su perfil y su fila en company_members (accepted = true) sin enviar nada.
   * La empresa la deduce del administrador autenticado, por eso aquí no se pasa.
   *
   * Resuelve a true si todos se han creado; si alguno falla, lanza un Error con
   * el resumen (es lo que espera ImportEmployeesModal: resolver o lanzar).
   */
  async importEmployeesBulk(employeesData: ImportedEmployee[], _companyId: string) {
    if (!employeesData || employeesData.length === 0) return;

    const failures: string[] = [];

    // En serie: cada llamada crea un usuario de Auth y no conviene lanzarlas a la vez
    for (const emp of employeesData) {
      const { error } = await supabase.rpc('demo_add_employee', {
        p_full_name: emp.name,
        p_email: emp.email,
        p_phone: emp.phone || null,
        p_dni_nie: emp.dni_nie || null,
        p_ss_number: emp.ss_number || null,
        p_team_id: emp.team_id || null,
        p_role: emp.role || 'employee',
      });

      if (error) {
        console.error(`Error creando al empleado ${emp.email}:`, error);
        failures.push(`${emp.email}: ${error.message}`);
      }
    }

    if (failures.length > 0) {
      const created = employeesData.length - failures.length;
      throw new Error(
        `Se han creado ${created} de ${employeesData.length} empleados. Errores: ${failures.join(' · ')}`
      );
    }

    return true;
  }
};

