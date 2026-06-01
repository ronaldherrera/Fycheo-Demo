import { supabase } from './supabase';

export interface Holiday {
  id: string;
  company_id: string;
  name: string;
  date: string;
  type: 'closed' | 'special_hours' | 'open_normal';
  start_time?: string;
  end_time?: string;
  created_at?: string;
}

export interface LeavePolicy {
  id: string;
  name: string;
  color: string;
  hex: string;
  minAmount: number;
  maxAmount: number;
  limitUnit: 'times' | 'days';
  limitPeriod: 'week' | 'month' | 'year';
  maxTimes?: number;
  isPaid?: boolean;
  consecutiveDays?: boolean;
  requiresMakeUp?: boolean;
}

export interface CompanySettings {
  schedule: Record<string, { active: boolean; start: string; end: string }>;
  general: {
    tolerance: string;
    timezone: string;
  };
  permissions?: Record<string, string[]>;
  team_permissions?: Record<string, Record<string, string[]>>;
  shift_types?: any[];
  leave_policies?: LeavePolicy[];
}

export const settingsService = {
  // Obtener configuraciones de la empresa (horarios y general)
  async getCompanySettings(companyId: string): Promise<CompanySettings | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', companyId)
      .single();

    if (error) throw error;
    return data?.settings as CompanySettings | null;
  },

  // Guardar configuraciones de la empresa
  async updateCompanySettings(companyId: string, settings: CompanySettings): Promise<void> {
    const { error } = await supabase
      .from('companies')
      .update({ settings })
      .eq('id', companyId);

    if (error) throw error;
  },
  // Obtener todos los festivos de una empresa
  async getHolidays(companyId: string): Promise<Holiday[]> {
    const { data, error } = await supabase
      .from('company_holidays')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Añadir un nuevo festivo/horario especial
  async addHoliday(holiday: Omit<Holiday, 'id' | 'created_at'>): Promise<Holiday> {
    const { data, error } = await supabase
      .from('company_holidays')
      .insert([holiday])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar un festivo existente
  async updateHoliday(id: string, updates: Partial<Omit<Holiday, 'id' | 'company_id' | 'created_at'>>): Promise<Holiday> {
    const { data, error } = await supabase
      .from('company_holidays')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar un festivo
  async deleteHoliday(id: string): Promise<void> {
    const { error } = await supabase
      .from('company_holidays')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
