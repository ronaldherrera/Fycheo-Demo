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
}

export const documentService = {
  async getMyDocuments(userId: string, companyId: string): Promise<EmployeeDocument[]> {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', userId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getDownloadUrl(filePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('employee_documents')
      .createSignedUrl(filePath, 60 * 60);

    if (error) throw error;
    return data.signedUrl;
  }
};
