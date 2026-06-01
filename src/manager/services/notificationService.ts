import { supabase } from './supabase';

export const notificationService = {
  /**
   * Crea una notificación para uno o más empleados.
   */
  async createNotification(employeeIds: string[], companyId: string, message: string, createdBy: string): Promise<void> {
    if (!employeeIds || employeeIds.length === 0 || !companyId) return;

    // Solo coger IDs únicos para no enviar notificaciones duplicadas al mismo empleado por la misma acción
    const uniqueIds = Array.from(new Set(employeeIds));

    const notificationsToInsert = uniqueIds.map(empId => ({
      employee_id: empId,
      company_id: companyId,
      message,
      created_by: createdBy
    }));

    try {
      const { error } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (error) {
        console.error('Error creando notificaciones:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error creando notificaciones:', error);
      throw error;
    }
  }
};
