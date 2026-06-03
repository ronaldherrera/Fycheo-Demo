import { adjustDataToCurrentDate, adjustDateString } from '../../lib/date-adjuster';
import { supabase } from './supabase';
import type { Absence } from '../types';

const adjustAbsenceDates = (absences: any[]): any[] =>
  absences.map(a => ({
    ...a,
    start_date: a.start_date ? adjustDateString(a.start_date) : a.start_date,
    end_date: a.end_date ? adjustDateString(a.end_date) : a.end_date,
  }));

export const absenceService = {
  /**
   * Obtiene todas las ausencias aprobadas para una empresa.
   */
  async getAbsences(companyId: string): Promise<Absence[]> {
    if (!companyId) return [];

    const { data, error } = await supabase
      .from('absences')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'approved');

    if (error) {
      console.error('Error obteniendo ausencias:', error);
      throw error;
    }

    return adjustAbsenceDates(adjustDataToCurrentDate(data || [])) as Absence[];
  },

  /**
   * Obtiene todas las ausencias (pendientes, aprobadas, rechazadas) para una empresa.
   */
  async getAllAbsences(companyId: string): Promise<Absence[]> {
    if (!companyId) return [];

    const { data, error } = await supabase
      .from('absences')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo todas las ausencias:', error);
      throw error;
    }

    return adjustAbsenceDates(adjustDataToCurrentDate(data || [])) as Absence[];
  },

  /**
   * Actualiza el estado de una ausencia (approved, rejected, pending).
   */
  async updateAbsenceStatus(id: string, status: 'approved' | 'rejected' | 'pending'): Promise<void> {
    const { error } = await supabase
      .from('absences')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando estado de ausencia:', error);
      throw error;
    }
  },

  /**
   * Crea una nueva ausencia o permiso especial.
   */
  async createAbsence(absence: Partial<Absence>): Promise<Absence> {
    const { data, error } = await supabase
      .from('absences')
      .insert([absence])
      .select()
      .single();

    if (error) {
      console.error('Error creando ausencia/permiso:', error);
      throw error;
    }

    return data as Absence;
  },

  /**
   * Elimina una ausencia.
   */
  async deleteAbsence(id: string): Promise<void> {
    const { error } = await supabase
      .from('absences')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando ausencia/permiso:', error);
      throw error;
    }
  },

  /**
   * Actualiza la fecha de fin de una ausencia (dar de alta).
   */
  async updateAbsenceEndDate(id: string, endDate: string): Promise<void> {
    const { error } = await supabase
      .from('absences')
      .update({ end_date: endDate })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando fecha de fin:', error);
      throw error;
    }
  },

  /**
   * Sube un documento adjunto a Supabase Storage
   */
  async uploadDocument(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `absences/${fileName}`;

    const { error } = await supabase.storage
      .from('Documents')
      .upload(filePath, file);

    if (error) {
      console.error('Error subiendo documento:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('Documents')
      .getPublicUrl(filePath);

    return publicUrl;
  }
};
