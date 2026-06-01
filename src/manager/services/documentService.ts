import { supabase } from './supabase';

export interface EmployeeDocument {
  id: string;
  company_id: string;
  employee_id: string;
  document_type: 'nomina' | 'contrato' | 'certificado' | 'otro';
  title: string;
  period?: string;
  file_url: string;
  file_size: number;
  created_at: string;
  created_by?: string;
}

export const documentService = {
  /**
   * Obtener los documentos de un empleado
   */
  async getEmployeeDocuments(employeeId: string, companyId: string): Promise<EmployeeDocument[]> {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Subir un documento para un empleado
   */
  async uploadDocument(
    file: File,
    companyId: string,
    employeeId: string,
    documentType: 'nomina' | 'contrato' | 'certificado' | 'otro',
    title: string,
    period?: string
  ): Promise<EmployeeDocument> {
    
    // 1. Subir a Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${companyId}/${employeeId}/${documentType}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('employee_documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Registrar en la base de datos
    const { data, error: dbError } = await supabase
      .from('employee_documents')
      .insert({
        company_id: companyId,
        employee_id: employeeId,
        document_type: documentType,
        title,
        period: period || null,
        file_url: filePath,
        file_size: file.size
      })
      .select()
      .single();

    if (dbError) {
      // Intentar limpiar el archivo si falló la inserción
      await supabase.storage.from('employee_documents').remove([filePath]);
      throw dbError;
    }

    return data;
  },

  /**
   * Eliminar un documento
   */
  async deleteDocument(documentId: string, filePath: string): Promise<void> {
    // 1. Borrar de base de datos
    const { error: dbError } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', documentId);

    if (dbError) throw dbError;

    // 2. Borrar de Storage
    const { error: storageError } = await supabase.storage
      .from('employee_documents')
      .remove([filePath]);

    if (storageError) {
      console.error('Error eliminando archivo de storage:', storageError);
      // No lanzamos el error para no bloquear la UI si el registro ya se borró
    }
  },

  /**
   * Obtener URL firmada para descargar un documento
   */
  async getDownloadUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('employee_documents')
      .createSignedUrl(filePath, 60 * 60); // Válido por 1 hora

    if (error) throw error;
    return data.signedUrl;
  }
};
