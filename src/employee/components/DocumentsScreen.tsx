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
  const [demoToast, setDemoToast] = useState(false);

  // Detecta si la URL del documento es una ruta ficticia de demo (no existe en storage)
  const isFakeUrl = (url: string) => !url.startsWith('http://') && !url.startsWith('https://');

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
    // Documento ficticio de demo → mostrar toast informativo
    if (isFakeUrl(doc.file_url)) {
      setDemoToast(true);
      setTimeout(() => setDemoToast(false), 3000);
      return;
    }
    setDownloading(doc.id);
    try {
      const url = await documentService.getDownloadUrl(doc.file_url, doc.document_type);
      window.open(url, '_blank');
    } catch {
      alert('No se pudo abrir el documento.');
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (doc: EmployeeDocument) => {
    setPreviewDoc(doc);
    // Documento ficticio de demo → abrir visor de demo directamente sin petición de red
    if (isFakeUrl(doc.file_url)) {
      setPreviewUrl('demo');
      return;
    }
    setLoadingPreview(true);
    try {
      const url = await documentService.getDownloadUrl(doc.file_url, doc.document_type);
      setPreviewUrl(url);
    } catch {
      // Fallback al visor de demo si falla
      setPreviewUrl('demo');
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

      {/* Toast demo */}
      {demoToast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
          padding: '10px 20px', borderRadius: 14, fontSize: 13, fontWeight: 600,
          zIndex: 100, boxShadow: '0 8px 30px rgba(99,102,241,0.4)',
          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
          Entorno de demo · Descarga no disponible
        </div>
      )}

      {/* Visor de documento */}
      <div className={`fixed inset-0 z-50 flex flex-col transition-all duration-300 ${
        previewDoc ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`} style={{ background: 'rgba(6,10,22,0.97)', backdropFilter: 'blur(8px)' }}>

        {/* Header del visor */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#818cf8' }}>
              {TYPE_ICONS[previewDoc?.document_type ?? ''] || 'description'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{previewDoc?.title}</p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#475569' }}>Visor seguro de documentos</p>
          </div>
          {previewDoc && isFakeUrl(previewDoc.file_url) ? (
            <button
              onClick={() => { setDemoToast(true); setTimeout(() => setDemoToast(false), 3000); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Descargar
            </button>
          ) : (
            <button
              onClick={() => previewDoc && handleOpen(previewDoc)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Descargar
            </button>
          )}
          <button
            onClick={closePreview}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Contenido del visor */}
        {previewDoc && previewUrl === 'demo' ? (
          // ── Visor A4 de demo ────────────────────────────────────────────────
          <div className="flex-1 overflow-y-auto" style={{ background: '#1a1f2e', padding: '20px 12px 40px' }}>
            {/* Hoja A4 */}
            <div style={{
              maxWidth: 480, margin: '0 auto',
              background: '#fff',
              borderRadius: 3,
              boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
              padding: '32px 28px',
              fontFamily: '"Times New Roman", Times, serif',
              color: '#1a1a1a',
              minHeight: 640,
              position: 'relative',
            }}>

              {/* Marca de agua DEMO */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none', overflow: 'hidden', borderRadius: 3,
              }}>
                <span style={{
                  fontSize: 90, fontWeight: 900, color: 'rgba(99,102,241,0.06)',
                  transform: 'rotate(-35deg)', whiteSpace: 'nowrap', userSelect: 'none',
                  fontFamily: 'Arial, sans-serif', letterSpacing: 12,
                }}>DEMO</span>
              </div>

              {/* Cabecera empresa */}
              <div style={{ borderBottom: '2px solid #1e3a8a', paddingBottom: 14, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: '#1e3a8a', fontFamily: 'Arial, sans-serif', letterSpacing: '-0.3px' }}>
                    DISTRIBUCIONES MARTÍNEZ S.A.
                  </p>
                  <p style={{ fontSize: 9, color: '#64748b', marginTop: 2, fontFamily: 'Arial, sans-serif' }}>
                    Calle Mayor 45, 28001 Madrid · CIF B-12345678
                  </p>
                  <p style={{ fontSize: 9, color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
                    Tel: +34 91 000 00 00 · info@martinez-sa.com
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>
                    Madrid, {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                  <p style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'Arial, sans-serif', marginTop: 2 }}>
                    Ref: {previewDoc.document_type.toUpperCase()}-2026-{Math.floor(Math.random() * 900 + 100)}
                  </p>
                </div>
              </div>

              {/* Título del documento */}
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Arial, sans-serif' }}>
                  {previewDoc.title}
                </p>
                {previewDoc.period && (
                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 4, fontFamily: 'Arial, sans-serif' }}>
                    Período: {formatPeriod(previewDoc.period)}
                  </p>
                )}
              </div>

              {/* Datos del empleado */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '10px 14px', marginBottom: 18, fontSize: 10, fontFamily: 'Arial, sans-serif' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                  <p><strong>Empleado:</strong> Pedro Jiménez Ruiz</p>
                  <p><strong>DNI:</strong> 45.678.901-D</p>
                  <p><strong>Puesto:</strong> Repartidor</p>
                  <p><strong>Departamento:</strong> Repartidores</p>
                  <p><strong>N.º SS:</strong> 28/001/01</p>
                  <p><strong>Categoría:</strong> Grupo II</p>
                </div>
              </div>

              {/* Contenido según tipo */}
              {previewDoc.document_type === 'nomina' && (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, fontFamily: 'Arial, sans-serif', marginBottom: 14 }}>
                    <thead>
                      <tr style={{ background: '#1e3a8a', color: '#fff' }}>
                        <th style={{ padding: '5px 8px', textAlign: 'left' }}>Concepto</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right' }}>Devengos</th>
                        <th style={{ padding: '5px 8px', textAlign: 'right' }}>Deducciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Salario base', '1.600,00 €', ''],
                        ['Plus transporte', '150,00 €', ''],
                        ['Plus productividad', '120,00 €', ''],
                        ['IRPF (15%)', '', '279,00 €'],
                        ['Seg. Social (6,35%)', '', '119,02 €'],
                      ].map(([c, d, ded], i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '4px 8px' }}>{c}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#16a34a' }}>{d}</td>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: '#dc2626' }}>{ded}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                        <td style={{ padding: '5px 8px' }}>TOTAL LÍQUIDO A PERCIBIR</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right' }}>1.870,00 €</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>398,02 €</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#1e3a8a', fontFamily: 'Arial, sans-serif', borderTop: '2px solid #1e3a8a', paddingTop: 8 }}>
                    NETO: 1.471,98 €
                  </div>
                </>
              )}

              {previewDoc.document_type === 'contrato' && (
                <div style={{ fontSize: 10, lineHeight: 1.7, color: '#374151', fontFamily: 'Arial, sans-serif' }}>
                  <p style={{ marginBottom: 10 }}>En Madrid, a 2 de enero de 2026, de una parte <strong>Distribuciones Martínez S.A.</strong>, representada por D. Carlos Martínez García, y de otra parte D. <strong>Pedro Jiménez Ruiz</strong>, con DNI 45.678.901-D, acuerdan suscribir el presente <strong>CONTRATO DE TRABAJO INDEFINIDO</strong> con arreglo a las siguientes cláusulas:</p>
                  <p style={{ marginBottom: 6 }}><strong>PRIMERA.</strong> El trabajador prestará sus servicios como Repartidor, en el centro de trabajo situado en Calle Mayor 45, 28001 Madrid.</p>
                  <p style={{ marginBottom: 6 }}><strong>SEGUNDA.</strong> La jornada de trabajo será de 40 horas semanales, distribuidas de lunes a viernes.</p>
                  <p style={{ marginBottom: 6 }}><strong>TERCERA.</strong> El salario bruto anual será de 22.440,00 € brutos anuales, distribuidos en 14 pagas.</p>
                  <p><strong>CUARTA.</strong> El presente contrato se rige por el Convenio Colectivo del Sector de Transporte de Mercancías.</p>
                </div>
              )}

              {(previewDoc.document_type === 'certificado' || previewDoc.document_type === 'otro') && (
                <div style={{ fontSize: 10, lineHeight: 1.8, color: '#374151', fontFamily: 'Arial, sans-serif' }}>
                  <p style={{ marginBottom: 14 }}><strong>D. Carlos Martínez García</strong>, en calidad de Administrador de la mercantil <strong>Distribuciones Martínez S.A.</strong>, con CIF B-12345678,</p>
                  <p style={{ marginBottom: 14, textTransform: 'uppercase', fontWeight: 700, textAlign: 'center', fontSize: 11 }}>CERTIFICA</p>
                  <p style={{ marginBottom: 10 }}>Que D. <strong>Pedro Jiménez Ruiz</strong>, con DNI 45.678.901-D, presta sus servicios en esta empresa desde el 1 de junio de 2025, en el puesto de <strong>Repartidor</strong>, con carácter indefinido y a jornada completa.</p>
                  <p>Y para que conste a los efectos oportunos, expido el presente certificado en Madrid, a {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}.</p>
                </div>
              )}

              {/* Firma */}
              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'Arial, sans-serif', color: '#64748b' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 110, borderTop: '1px solid #94a3b8', paddingTop: 4, marginTop: 28 }}>
                    <p>El Empleado</p>
                    <p style={{ fontWeight: 700, color: '#374151' }}>Pedro Jiménez Ruiz</p>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 110, borderTop: '1px solid #94a3b8', paddingTop: 4, marginTop: 28 }}>
                    <p>La Empresa</p>
                    <p style={{ fontWeight: 700, color: '#374151' }}>Carlos Martínez García</p>
                  </div>
                </div>
              </div>

              {/* Pie */}
              <div style={{ marginTop: 24, paddingTop: 10, borderTop: '1px solid #f1f5f9', textAlign: 'center', fontSize: 8, color: '#94a3b8', fontFamily: 'Arial, sans-serif' }}>
                Documento generado por Fycheo · Datos ficticios de demo · Ningún dato es real
              </div>
            </div>
          </div>
        ) : previewUrl ? (
          // ── Iframe para documentos reales ──────────────────────────────────
          <iframe
            src={`${previewUrl}#toolbar=0&navpanes=0`}
            className="flex-1 w-full border-0"
            style={{ background: '#1e2942' }}
            title="Visor PDF"
          />
        ) : null}
      </div>
    </div>
  );
}
