import { useState, useEffect, useContext, useRef } from 'react';
import { useNotifications } from '../contexts/NotificationsContext';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../EmployeeApp';
import { supabase } from '../services/supabase';

const TYPE_LABELS: Record<string, string> = {
  medical:       'Baja Médica',
  vacation:      'Vacaciones',
  manual_paid:   'Permiso Retribuido',
  manual_unpaid: 'Permiso No Retribuido',
};

const TYPE_ICONS: Record<string, string> = {
  medical:       'medical_services',
  vacation:      'beach_access',
  manual_paid:   'work_off',
  manual_unpaid: 'event_busy',
};

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-500/10 text-amber-500 border border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  pending:  'Pendiente',
  approved: 'Aprobada',
  rejected: 'Denegada',
};

const FILTERS = [
  { key: 'pending',  label: 'Pendientes' },
  { key: 'approved', label: 'Aprobadas'  },
  { key: 'rejected', label: 'Denegadas'  },
] as const;

const REQUEST_TYPES = [
  { key: 'vacation',      label: 'Vacaciones',             icon: 'beach_access'  },
  { key: 'manual_paid',   label: 'Permiso Retribuido',      icon: 'work_off'      },
  { key: 'manual_unpaid', label: 'Permiso No Retribuido',   icon: 'event_busy'    },
] as const;

const today = () => new Date().toISOString().split('T')[0];

export default function SolicitudesScreen() {
  const navigate = useNavigate();
  const { user } = useContext(AppContext);
  const { markSolicitudesAsSeen } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyId,   setCompanyId]   = useState<string | null>(null);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Modal state
  const [showModal,   setShowModal]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [formType,    setFormType]    = useState<string>('vacation');
  const [formStart,   setFormStart]   = useState(today());
  const [formEnd,     setFormEnd]     = useState(today());
  const [formReason,  setFormReason]  = useState('');
  const [formFile,       setFormFile]       = useState<File | null>(null);
  const [formError,      setFormError]      = useState<string | null>(null);

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

  const loadSolicitudes = async () => {
    if (!user?.id || !companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('absences')
      .select('*')
      .eq('employee_id', user.id)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setSolicitudes(data || []);
    markSolicitudesAsSeen();
    setLoading(false);
  };

  useEffect(() => { loadSolicitudes(); }, [user?.id, companyId]);

  const openModal = () => {
    setFormType('vacation');
    setFormStart(today());
    setFormEnd(today());
    setFormReason('');
    setFormFile(null);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!user?.id || !companyId) return;
    if (formEnd < formStart) { setFormError('La fecha de fin no puede ser anterior a la de inicio.'); return; }
    setSubmitting(true);
    setFormError(null);

    let documentUrl: string | null = null;
    if (formFile) {
      const ext = formFile.name.split('.').pop();
      const path = `${companyId}/${user.id}/absences/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('absence_documents')
        .upload(path, formFile);
      if (uploadError) {
        setFormError('Error al subir el documento. Inténtalo de nuevo.');
        setSubmitting(false);
        return;
      }
      documentUrl = path;
    }

    const { error } = await supabase.from('absences').insert({
      employee_id:  user.id,
      company_id:   companyId,
      type:         formType,
      start_date:   formStart,
      end_date:     formEnd,
      status:       'pending',
      reason:       formReason.trim() || null,
      document_url: documentUrl,
    });
    setSubmitting(false);
    if (error) { setFormError('Error al enviar la solicitud. Inténtalo de nuevo.'); return; }
    setShowModal(false);
    setFilter('pending');
    loadSolicitudes();
  };

  const filtered = filter === 'approved'
    ? solicitudes.filter(s => s.status === 'approved')
    : solicitudes.filter(s => s.status === filter);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1520] flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-20 bg-white dark:bg-[#151b26]" style={{ height: 'env(safe-area-inset-top)' }} />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-[#151b26] border-b border-slate-200 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate('/profile')}
            className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
          <h1 className="text-base font-bold text-slate-900 dark:text-white flex-1">
            Mis Solicitudes
          </h1>
          <span className="text-xs text-slate-400 font-medium">{solicitudes.length} total</span>
        </div>

        {/* Botón + switch */}
        <div className="max-w-md mx-auto px-4 pb-3 space-y-2">
          <button
            onClick={openModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-sm shadow-primary/30 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Solicitar permiso
          </button>

          <div className="flex bg-slate-100 dark:bg-slate-950/60 rounded-xl p-1 gap-1 border border-slate-200 dark:border-slate-800/80">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  filter === f.key
                    ? 'bg-white dark:bg-[#2a364f] text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filter === f.key
                    ? 'bg-primary/20 text-blue-500 dark:bg-primary/30 dark:text-blue-300'
                    : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500'
                }`}>
                  {solicitudes.filter(s => s.status === f.key).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Lista */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 pb-10 space-y-3">
        {loading && (
          <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-[40px] animate-pulse">hourglass_top</span>
            <p className="text-sm">Cargando solicitudes...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
            <span className="material-symbols-outlined text-[48px]">inbox</span>
            <p className="text-sm font-medium">Sin solicitudes {STATUS_LABELS[filter].toLowerCase()}s</p>
          </div>
        )}

        {!loading && filtered.map((s: any) => (
          <div key={s.id} className="bg-white dark:bg-[#1a2235] rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px] text-primary">
                  {TYPE_ICONS[s.type] || 'event_note'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {TYPE_LABELS[s.type] || s.type}
                  </p>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[s.status]}`}>
                    {STATUS_LABELS[s.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {s.start_date}{s.end_date && s.end_date !== s.start_date ? ` → ${s.end_date}` : ''}
                </p>
                {s.reason && (
                  <p className="text-xs text-slate-400 mt-1.5 italic">"{s.reason}"</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* Modal solicitar permiso */}
      <div className={`fixed inset-0 z-50 flex items-end justify-center transition-all duration-300 ${showModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && setShowModal(false)} />

        {/* Sheet */}
        <div className={`relative w-full max-w-md bg-white dark:bg-[#151b26] rounded-t-2xl shadow-2xl transition-transform duration-300 ${showModal ? 'translate-y-0' : 'translate-y-full'}`}>
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>

          {/* Cabecera */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Nueva Solicitud</h2>
            <button
              onClick={() => !submitting && setShowModal(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Formulario */}
          <div className="px-5 py-4 space-y-4">

            {/* Tipo */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo de permiso</label>
              <div className="space-y-2">
                {REQUEST_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setFormType(t.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                      formType === t.key
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[20px] ${formType === t.key ? 'text-primary' : 'text-slate-400'}`}>
                      {t.icon}
                    </span>
                    <span className={`text-sm font-medium ${formType === t.key ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>
                      {t.label}
                    </span>
                    {formType === t.key && (
                      <span className="ml-auto material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Desde</label>
                <input
                  type="date"
                  value={formStart}
                  onChange={e => { setFormStart(e.target.value); if (formEnd < e.target.value) setFormEnd(e.target.value); }}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  style={{ colorScheme: 'dark' }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-[#1a2235] text-white text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Hasta</label>
                <input
                  type="date"
                  value={formEnd}
                  min={formStart}
                  onChange={e => setFormEnd(e.target.value)}
                  onClick={e => (e.target as HTMLInputElement).showPicker?.()}
                  style={{ colorScheme: 'dark' }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-[#1a2235] text-white text-sm focus:outline-none focus:border-primary transition-colors cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Motivo <span className="normal-case font-normal">(opcional)</span></label>
              <textarea
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                placeholder="Describe brevemente el motivo..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none placeholder:text-slate-400"
              />
            </div>

            {/* Documento adjunto */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Documento <span className="normal-case font-normal">(opcional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => setFormFile(e.target.files?.[0] ?? null)}
              />
              {formFile ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary/40 bg-primary/5 dark:bg-primary/10">
                  <span className="material-symbols-outlined text-[20px] text-primary shrink-0">description</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{formFile.name}</span>
                  <button
                    onClick={() => { setFormFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-slate-400 hover:text-red-400 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                  Adjuntar archivo
                </button>
              )}
            </div>

            {formError && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{formError}</p>
            )}

            {/* Botón enviar */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-sm shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Enviando...</>
              ) : (
                <><span className="material-symbols-outlined text-[18px]">send</span> Enviar solicitud</>
              )}
            </button>
          </div>

          {/* Safe area bottom */}
          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
