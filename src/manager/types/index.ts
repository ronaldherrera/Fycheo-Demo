export type EmployeeRole = 'admin' | 'hr' | 'manager' | 'employee';

export interface Employee {
  id: string;
  name: string; // @deprecated usar full_name
  full_name?: string;
  email: string;
  avatar?: string;
  
  // Jerarquía y Equipo
  role: EmployeeRole;
  company_id?: string;
  team_id?: string; // Una persona pertenece a un solo equipo
  accepted?: boolean; // Aceptación de vinculación a la empresa
  
  // Datos adicionales
  phone?: string;
  dept?: string;
  dni_nie?: string;
  ss_number?: string;
  created_at?: string;
  plan_selected?: string; // Plan de suscripción
}

export interface Company {
  id: string;
  name: string;
  plan: string;
  logo_url?: string;
  role?: string; // Rol del usuario en esta empresa
}

export interface Shift {
  id: string;
  employee_id: string;
  company_id: string;
  date: string; // Formato YYYY-MM-DD
  start_time: string; // Formato HH:mm
  end_time: string; // Formato HH:mm
  notes?: string;
  status: 'scheduled' | 'completed' | 'absent' | 'pending_deletion';
  color?: string;
  overtime?: number; // Horas extras añadidas
  is_published?: boolean;
  updated_by?: string;
}

export interface Absence {
  id: string;
  employee_id: string;
  company_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD, null para bajas médicas abiertas
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  document_url?: string;
}

export interface Notification {
  id: string;
  employee_id: string;
  company_id: string;
  message: string;
  read: boolean;
  created_at: string;
  created_by?: string;
}

export interface Team {
  id: string;
  name: string;
  company_id: string;
  description?: string;
  created_at?: string;
}

export interface ActivityLog {
  id: string;
  company_id: string;
  manager_id: string;
  action_type: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
  manager?: {
    full_name?: string;
    email?: string;
    avatar?: string;
  };
}
