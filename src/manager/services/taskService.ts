import { supabase } from './supabase';

export type TaskType = 'task' | 'notice';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'done';

export interface Task {
  id: string;
  company_id: string;
  created_by: string;
  assigned_to: string;
  team_id: string | null;
  type: TaskType;
  title: string;
  description: string | null;
  due_date: string | null;          // YYYY-MM-DD
  priority: TaskPriority;
  status: TaskStatus;
  done_at: string | null;
  created_at: string;
  // Joins opcionales
  creator?: { full_name?: string; email?: string };
  assignee?: { full_name?: string; email?: string; avatar_url?: string };
}

export interface CreateTaskPayload {
  company_id: string;
  assigned_to: string | 'ALL';      // 'ALL' = todos los miembros del equipo
  team_id?: string | null;
  type: TaskType;
  title: string;
  description?: string;
  due_date?: string | null;
  priority: TaskPriority;
  // Para asignación masiva
  team_member_ids?: string[];
}

export const taskService = {

  /** Crear una tarea para uno o varios empleados */
  async createTask(payload: CreateTaskPayload, createdBy: string): Promise<Task[]> {
    const recipients =
      payload.assigned_to === 'ALL'
        ? (payload.team_member_ids ?? [])
        : [payload.assigned_to];

    if (recipients.length === 0) throw new Error('No hay destinatarios');

    const rows = recipients.map(userId => ({
      company_id:  payload.company_id,
      created_by:  createdBy,
      assigned_to: userId,
      team_id:     payload.team_id ?? null,
      type:        payload.type,
      title:       payload.title,
      description: payload.description || null,
      due_date:    payload.due_date || null,
      priority:    payload.priority,
      status:      'pending' as TaskStatus,
    }));

    const { data, error } = await supabase
      .from('tasks')
      .insert(rows)
      .select();

    if (error) throw error;
    return data as Task[];
  },

  /** Obtener tareas de un equipo (Manager) */
  async getTasksByTeam(teamId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Task[];
  },

  /** Obtener tareas de la empresa (Manager - vista completa) */
  async getTasksByCompany(companyId: string, status?: TaskStatus): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Task[];
  },

  /** Obtener tareas de un empleado específico */
  async getTasksByEmployee(userId: string, companyId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Task[];
  },

  /** Obtener mis tareas pendientes (App - usuario autenticado) */
  async getMyPendingTasks(): Promise<Task[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Task[];
  },

  /** Marcar tarea como hecha (empleado desde la App) */
  async markDone(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) throw error;
  },

  /** Eliminar una tarea (Manager) */
  async deleteTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },

  /** Contar tareas pendientes de un usuario (para badge) */
  async countPending(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'pending');

    if (error) return 0;
    return count ?? 0;
  },
};
