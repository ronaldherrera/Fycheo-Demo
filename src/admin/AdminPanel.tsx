import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Shield, Users, Eye, Activity, Plus, Trash2, X,
  Loader2, Monitor, Smartphone, Tablet, RefreshCw,
  LayoutDashboard, Clock,
} from 'lucide-react';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN as string;
const SESSION_KEY = 'fycheo_admin_auth';

type Tab = 'invitados' | 'visitas' | 'actividad';

interface AccessEntry { email: string; name: string; created_at?: string }
interface Visit       { id: string; email: string; visited_at: string; device_type: string }
interface Event       { id: string; email: string; section: string; created_at: string }

const SECTION_STYLE: Record<string, string> = {
  manager:  'text-blue-400 bg-blue-400/10 border-blue-400/20',
  kiosk:    'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  employee: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
};
const SECTION_LABEL: Record<string, string> = {
  manager: 'Manager', kiosk: 'Kiosko', employee: 'Empleado',
};
const DEVICE_ICON: Record<string, React.ElementType> = {
  desktop: Monitor, mobile: Smartphone, tablet: Tablet,
};

function fmt(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function AdminPanel() {
  const [authed, setAuthed]     = useState(() => sessionStorage.getItem(SESSION_KEY) === 'ok');
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState(false);

  const [tab, setTab]           = useState<Tab>('invitados');
  const [loading, setLoading]   = useState(false);
  const [accesses, setAccesses] = useState<AccessEntry[]>([]);
  const [visits, setVisits]     = useState<Visit[]>([]);
  const [events, setEvents]     = useState<Event[]>([]);

  const [addOpen, setAddOpen]   = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName]   = useState('');
  const [saving, setSaving]     = useState(false);

  const checkPin = () => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem(SESSION_KEY, 'ok');
      setAuthed(true);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 1800);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'invitados') {
        const { data } = await supabase
          .from('demo_access')
          .select('email, name, created_at')
          .order('created_at', { ascending: false });
        setAccesses(data || []);
      } else if (tab === 'visitas') {
        const { data } = await supabase
          .from('demo_visits')
          .select('*')
          .order('visited_at', { ascending: false })
          .limit(150);
        setVisits(data || []);
      } else {
        const { data } = await supabase
          .from('demo_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300);
        setEvents(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  const addAccess = async () => {
    if (!newEmail.trim()) return;
    setSaving(true);
    await supabase.from('demo_access').insert({
      email: newEmail.trim().toLowerCase(),
      name:  newName.trim() || newEmail.split('@')[0],
    });
    setSaving(false);
    setAddOpen(false);
    setNewEmail('');
    setNewName('');
    load();
  };

  const removeAccess = async (email: string) => {
    if (!confirm(`¿Eliminar acceso de ${email}?`)) return;
    await supabase.from('demo_access').delete().eq('email', email);
    load();
  };

  // ── PIN gate ────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080C14] flex items-center justify-center p-8">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
              <Shield size={24} className="text-primary" />
            </div>
            <h1 className="text-lg font-bold text-white">Panel Admin</h1>
            <p className="text-xs text-slate-500 mt-1">Fycheo Demo</p>
          </div>
          <div className={`bg-[#0C1020] border rounded-2xl p-6 transition-colors ${pinError ? 'border-red-500/40' : 'border-white/8'}`}>
            <label className="block text-xs font-medium text-slate-400 mb-2">PIN de acceso</label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkPin()}
              placeholder="••••••••"
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors text-sm mb-1"
            />
            {pinError && <p className="text-red-400 text-xs mt-2 mb-1">PIN incorrecto</p>}
            <button
              onClick={checkPin}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mt-4"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stats rápidas ────────────────────────────────────────────────
  const uniqueVisitors = new Set(visits.map(v => v.email)).size;
  const uniqueSections = new Set(events.map(e => e.section)).size;

  // ── Panel principal ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080C14] text-white flex flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-white/5 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield size={14} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Admin · Fycheo Demo</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Panel privado de gestión</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Recargar"
          >
            <RefreshCw size={12} className="text-slate-400" />
          </button>
          <button
            onClick={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors px-2"
          >
            <X size={12} /> Salir
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="shrink-0 grid grid-cols-3 gap-3 px-5 py-4 border-b border-white/5">
        {[
          { icon: Users,        label: 'Invitados',   value: accesses.length || '—',    color: 'text-blue-400' },
          { icon: Eye,          label: 'Visitas',      value: visits.length   || '—',    color: 'text-emerald-400' },
          { icon: LayoutDashboard, label: 'Interacciones', value: events.length || '—', color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/3 border border-white/6 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
            <s.icon size={14} className={s.color} />
            <div>
              <p className="text-base font-bold text-white leading-none">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-white/5 px-5">
        <div className="flex gap-1">
          {([
            { id: 'invitados' as Tab, label: 'Invitados',  icon: Users    },
            { id: 'visitas'   as Tab, label: 'Visitas',    icon: Eye      },
            { id: 'actividad' as Tab, label: 'Actividad',  icon: Activity },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-primary" />
          </div>
        ) : tab === 'invitados' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">{accesses.length} email{accesses.length !== 1 ? 's' : ''} con acceso</p>
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                <Plus size={13} /> Añadir
              </button>
            </div>
            <div className="space-y-2">
              {accesses.length === 0 && (
                <p className="text-center text-sm text-slate-600 py-10">Sin invitados aún</p>
              )}
              {accesses.map(a => (
                <div key={a.email} className="flex items-center justify-between bg-white/3 border border-white/6 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{a.name || '—'}</p>
                    <p className="text-xs text-slate-500 truncate">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {a.created_at && (
                      <span className="text-[10px] text-slate-600 hidden sm:block">
                        {fmt(a.created_at).date}
                      </span>
                    )}
                    <button
                      onClick={() => removeAccess(a.email)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'visitas' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">
                {visits.length} visita{visits.length !== 1 ? 's' : ''} · {uniqueVisitors} visitante{uniqueVisitors !== 1 ? 's' : ''} único{uniqueVisitors !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="space-y-2">
              {visits.length === 0 && (
                <p className="text-center text-sm text-slate-600 py-10">Sin visitas registradas</p>
              )}
              {visits.map(v => {
                const Icon = DEVICE_ICON[v.device_type] || Monitor;
                const { date, time } = fmt(v.visited_at);
                return (
                  <div key={v.id} className="flex items-center justify-between bg-white/3 border border-white/6 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{v.email}</p>
                        <p className="text-xs text-slate-500 capitalize">{v.device_type || 'desconocido'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-slate-400">{date}</p>
                      <p className="text-[10px] text-slate-600">{time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-500">
                {events.length} interacción{events.length !== 1 ? 'es' : ''} · {uniqueSections} sección{uniqueSections !== 1 ? 'es' : ''} visitada{uniqueSections !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Resumen por sección */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {(['manager', 'kiosk', 'employee'] as const).map(sec => {
                const count = events.filter(e => e.section === sec).length;
                return (
                  <div key={sec} className={`border rounded-xl px-3 py-2.5 text-center ${SECTION_STYLE[sec]}`}>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-[10px] opacity-70">{SECTION_LABEL[sec]}</p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              {events.length === 0 && (
                <p className="text-center text-sm text-slate-600 py-10">Sin actividad registrada</p>
              )}
              {events.map(e => {
                const { date, time } = fmt(e.created_at);
                return (
                  <div key={e.id} className="flex items-center justify-between bg-white/3 border border-white/6 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${SECTION_STYLE[e.section] || 'text-slate-400 bg-white/5 border-white/10'}`}>
                        {SECTION_LABEL[e.section] || e.section}
                      </span>
                      <p className="text-sm text-slate-300 truncate">{e.email}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-xs text-slate-400">{date}</p>
                      <p className="text-[10px] text-slate-600 flex items-center justify-end gap-1">
                        <Clock size={9} />{time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal añadir invitado */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0C1020] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-white mb-5">Añadir invitado</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Nombre del invitado"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAccess()}
                  placeholder="email@empresa.com"
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setAddOpen(false); setNewEmail(''); setNewName(''); }}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={addAccess}
                disabled={saving || !newEmail.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
