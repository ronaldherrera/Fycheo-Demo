import { adjustDateString } from '../../lib/date-adjuster';
import { supabase } from './supabase';
import type { Shift } from '../types';

export const shiftService = {
  /**
   * Obtiene todos los turnos asignados a una empresa.
   */
  async getShifts(companyId: string): Promise<Shift[]> {
    if (!companyId) return [];

    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('company_id', companyId);

    if (error) {
      console.error('Error obteniendo turnos:', error);
      throw error;
    }

    return (data || []).map(s => ({ ...s, date: adjustDateString(s.date) })) as Shift[];
  },

  /**
   * Sincroniza la lista local de turnos con la base de datos (conciliación).
   * Inserta/actualiza los turnos activos y elimina los turnos borrados.
   */
  async saveShifts(companyId: string, currentShifts: Shift[]): Promise<void> {
    if (!companyId) return;

    try {
      // 1. Obtener los IDs existentes en la BD para identificar cuáles fueron eliminados
      const { data: dbShifts, error: fetchError } = await supabase
        .from('shifts')
        .select('id')
        .eq('company_id', companyId);

      if (fetchError) throw fetchError;

      const dbIds = new Set(dbShifts?.map(s => s.id) || []);
      const currentIds = new Set(currentShifts.map(s => s.id));

      // 2. Identificar eliminaciones
      const idsToDelete = Array.from(dbIds).filter(id => !currentIds.has(id));

      // 3. Preparar upserts
      const shiftsToUpsert = currentShifts.map(s => ({
        id: s.id,
        employee_id: s.employee_id,
        company_id: companyId,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        notes: s.notes || null,
        status: s.status,
        color: s.color || null,
        overtime: s.overtime || null,
        is_published: s.is_published || false,
        updated_by: s.updated_by || null
      }));

      const promises: any[] = [];

      // 4. Añadir eliminación si procede
      if (idsToDelete.length > 0) {
        promises.push(
          supabase
            .from('shifts')
            .delete()
            .in('id', idsToDelete)
        );
      }

      // 5. Añadir upsert si procede
      if (shiftsToUpsert.length > 0) {
        promises.push(
          supabase
            .from('shifts')
            .upsert(shiftsToUpsert)
        );
      }

      // 6. Ejecutar operaciones
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        for (const res of results) {
          if (res.error) throw res.error;
        }
      }
    } catch (error) {
      console.error('Error sincronizando turnos:', error);
      throw error;
    }
  },

  /**
   * Marca una lista de turnos como publicados en la base de datos, 
   * y elimina definitivamente los que estaban pendientes de eliminación.
   */
  async publishShifts(shiftIds: string[], deletedShiftIds: string[], managerName: string): Promise<void> {
    if ((!shiftIds || shiftIds.length === 0) && (!deletedShiftIds || deletedShiftIds.length === 0)) return;

    try {
      const promises = [];

      if (shiftIds.length > 0) {
        promises.push(
          supabase
            .from('shifts')
            .update({ 
              is_published: true,
              updated_by: managerName
            })
            .in('id', shiftIds)
        );
      }

      if (deletedShiftIds.length > 0) {
        promises.push(
          supabase
            .from('shifts')
            .delete()
            .in('id', deletedShiftIds)
        );
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        for (const res of results) {
          if (res.error) throw res.error;
        }
      }
    } catch (error) {
      console.error('Error publicando/eliminando turnos:', error);
      throw error;
    }
  }
};
