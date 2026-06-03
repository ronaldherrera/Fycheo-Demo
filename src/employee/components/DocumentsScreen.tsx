import { useState, useEffect, useContext } from 'react';
import { useNotifications } from '../contexts/NotificationsContext';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../EmployeeApp';
import { supabase } from '../services/supabase';
import { documentService } from '../services/documentService';
import type { EmployeeDocument } from '../services/documentService';

const DOC_TYPES = [
  { key: 'nomina',   label: 'Nóminas' },
  { key: 'otro',     label: 'Otros' },
  { key: 'contrato', label: 'Contrato' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  nomina:      'Nómina',
  contrato:    'Contrato',
  certificado: 'Certificado',
  otro:        'Otro',
};

const TYPE_ICONS: Record<string, string> = {
  nomina:      'payments',
  contrato:    'handshake',
  certificado: 'workspace_premium',
  otro:        'description',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatPeriod(period?: string): string | null {
  if (!period) return null;
  const [year, month] = period.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export default function DocumentsScreen() {
  const navigate = useNavigate();
  const { user } = useContext(AppContext);
  const { markDocsAsSeen } = useNotifications();

  const [companyId, setCompanyId]   = useState<string | null>(null);
  const [documents, setDocuments]   = useState<EmployeeDocument[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<string>('nomina');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);
  const [previewDoc, setPreviewDoc]   = useState<EmployeeDocument | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch company
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('accepted', true)
      .maybeSingle()
      .then(({ data }) => { if (data) setCompanyId(data.company_id); });
  }, [user?.id]);

  // Fetch documents
  useEffect(() => {
    if (!user?.id || !companyId) return;
    setLoading(true);
    documentService.getMyDocuments(user.id, companyId)
      .then(data => { setDocuments(data); markDocsAsSeen(); })
      .catch(() => { /* tabla no disponible en demo → mostrar vacío */ })
      .finally(() => setLoading(false));
  }, [user?.id, companyId]);

  const handleOpen = async (doc: EmployeeDocument) => {
    setDownloading(doc.id);
    try {
      const url = await documentService.getDownloadUrl(doc.file_url);
      window.open(url, '_blank');
    } catch {
      alert('No se pudo abrir el documento.');
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (doc: EmployeeDocument) => {
    setLoadingPreview(true);
    setPreviewDoc(doc);
    try {
      const url = await documentService.getDownloadUrl(doc.file_url);
      setPreviewUrl(url);
    } catch {
      alert('No se pudo cargar el documento.');
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => { setPreviewDoc(null); setPreviewUrl(null); };

  const filtered = documents.filter(d => d.document_type === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1520] flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-20 bg-white dark:bg-[#151b26]" style={{ height: 'env(safe-area-inset-top)' }} />
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-[#151b26] border-b border-slate-200 dark:border-slate-800 shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate('/profile')}
            className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-white flex-1">Mis Documentos</h1>
          <span className="text-xs text-slate-400 font-medium">{documents.length} doc{documents.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Switch segmentado */}
        <div className="max-w-md mx-auto px-4 pb-3">
          <div className="flex bg-slate-100 dark:bg-slate-950/60 rounded-xl p-1 gap-1 border border-slate-200 dark:border-slate-800/80">
            {DOC_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === t.key
                    ? 'bg-white dark:bg-[#2a364f] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === t.key
                    ? 'bg-primary/20 text-blue-500 dark:bg-primary/30 dark:text-blue-300'
                    : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500'
                }`}>
                  {documents.filter(d => d.document_type === t.key).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 pb-24 space-y-3">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-[40px] animate-pulse">hourglass_top</span>
            <p className="text-sm">Cargando documentos...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-400">
            <span className="material-symbols-outlined text-[40px]">error</span>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-[48px]">folder_open</span>
            <p className="text-sm font-medium">Sin documentos</p>
            <p className="text-xs text-center text-slate-500">
              {activeTab === 'all'
                ? 'Aún no tienes documentos disponibles.'
                : `No tienes ${DOC_TYPES.find(t => t.key === activeTab)?.label.toLowerCase()} disponibles.`}
            </p>
          </div>
        )}

        {!loading && !error && filtered.map(doc => (
          <div
            key={doc.id}
            className="bg-white dark:bg-[#1a2235] rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-4 shadow-sm"
          >
            {/* Icon */}
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px] text-primary">
                {TYPE_ICONS[doc.document_type] || 'description'}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                  {TYPE_LABELS[doc.document_type]}
                </span>
                {formatPeriod(doc.period) && (
                  <span className="text-[11px] text-slate-500">{formatPeriod(doc.period)}</span>
                )}
                <span className="text-[11px] text-slate-400">{formatBytes(doc.file_size)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handlePreview(doc)}
                disabled={loadingPreview && previewDoc?.id === doc.id}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 active:scale-95 transition-all disabled:opacity-50"
              >
                {loadingPreview && previewDoc?.id === doc.id ? (
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                )}
              </button>
              <button
                onClick={() => handleOpen(doc)}
                disabled={downloading === doc.id}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary active:scale-95 transition-all disabled:opacity-50"
              >
                {downloading === doc.id ? (
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">download</span>
                )}
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Visor PDF */}
      <div className={`fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm transition-all duration-300 ${previewDoc && previewUrl ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#151b26] border-b border-white/10 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">description</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{previewDoc?.title}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Visor seguro de documentos</p>
          </div>
          <button
            onClick={() => previewDoc && handleOpen(previewDoc)}
            className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Descargar
          </button>
          <button
            onClick={closePreview}
            className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {/* Iframe */}
        {previewUrl && (
          <iframe
            src={`${previewUrl}#toolbar=0&navpanes=0`}
            className="flex-1 w-full border-0 bg-slate-900"
            title="Visor PDF"
          />
        )}
      </div>
    </div>
  );
}
