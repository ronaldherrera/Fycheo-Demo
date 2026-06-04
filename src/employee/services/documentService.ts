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

// URLs de PDFs de muestra para la demo (uno por tipo de documento)
const DEMO_PDF_URLS: Record<string, string> = {
  nomina:      'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf',
  contrato:    'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF2.pdf',
  certificado: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF6.pdf',
  otro:        'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF11.pdf',
};
const DEMO_PDF_DEFAULT = 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf';

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

  async getDownloadUrl(filePath: string, docType?: string): Promise<string> {
    // Si ya es una URL completa, devolverla directamente
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    // En la demo los paths son ficticios (uuid/uuid/tipo/archivo.pdf).
    // Intentamos obtener URL firmada; si falla, devolvemos PDF de muestra.
    try {
      const { data, error } = await supabase.storage
        .from('employee_documents')
        .createSignedUrl(filePath, 60 * 60);

      if (error) throw error;
      return data.signedUrl;
    } catch {
      // Archivo no existe en storage → devolver PDF de demo según tipo
      const type = docType ?? filePath.split('/')[2] ?? 'otro';
      return DEMO_PDF_URLS[type] ?? DEMO_PDF_DEFAULT;
    }
  }
};
