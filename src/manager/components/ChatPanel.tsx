/**
 * ChatPanel.tsx – Manager
 *
 * Panel de chat efímero entre el manager y los empleados.
 * - Lista de empleados con presencia (trabajando/descanso/fuera)
 * - Chat 1:1 con mensajes efímeros (se borran al leer, TTL 24h)
 * - Realtime vía Supabase
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, Send, ChevronLeft, RefreshCw, MessageCircle, Trash2 } from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type PresenceStatus = 'working' | 'break' | 'others' | 'out';

interface Employee {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  presence: PresenceStatus;
  last_entry_at: string | null;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  sent_at: string;
  read_at: string | null;
  expires_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const entryTypeToPresence = (entryType: string | null): PresenceStatus => {
  switch ((entryType ?? '').toLowerCase()) {
    case 'clock-in': case 'break-end': case 'others-in': return 'working';
    case 'break-start': return 'break';
    case 'others-out': return 'others';
    default: return 'out';
  }
};

const presenceMeta = (p: PresenceStatus) => {
  switch (p) {
    case 'working': return { label: 'Trabajando', dot: 'bg-emerald-500', text: 'text-emerald-400' };
    case 'break':   return { label: 'Descanso',   dot: 'bg-amber-500',   text: 'text-amber-400' };
    case 'others':  return { label: 'Permiso',    dot: 'bg-pink-500',    text: 'text-pink-400' };
    default:        return { label: 'Fuera',       dot: 'bg-slate-600',   text: 'text-slate-500' };
  }
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
};

// ─── Componente ──────────────────────────────────────────────────────────────

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export default function ChatPanel({ isOpen, onClose, onUnreadChange }: ChatPanelProps) {
  const { user, activeCompany } = useAuth();
  const companyId = activeCompany?.id;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [activeChat, setActiveChat] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Cargar empleados ──────────────────────────────────────────────────────
  const loadEmployees = useCallback(async () => {
    if (!user?.id || !companyId) return;
    setLoadingEmployees(true);
    try {
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id, profiles:user_id(full_name, avatar)')
        .eq('company_id', companyId)
        .eq('accepted', true)
        .neq('user_id', user.id);

      if (!members || members.length === 0) {
        setEmployees([]);
        return;
      }

      const empList: Employee[] = await Promise.all(
        members.map(async (m: any) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;

          const { data: lastEntry } = await supabase
            .from('time_entries')
            .select('entry_type, occurred_at')
            .eq('user_id', m.user_id)
            .order('occurred_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count } = await supabase
            .from('ephemeral_messages')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', m.user_id)
            .eq('receiver_id', user.id)
            .is('read_at', null);

          return {
            user_id: m.user_id,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar ?? null,
            presence: entryTypeToPresence(lastEntry?.entry_type ?? null),
            last_entry_at: lastEntry?.occurred_at ?? null,
            unreadCount: count ?? 0,
          };
        })
      );

      const order: Record<PresenceStatus, number> = { working: 0, break: 1, others: 2, out: 3 };
      empList.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        return order[a.presence] - order[b.presence];
      });

      setEmployees(empList);
      const totalUnread = empList.reduce((acc, c) => acc + c.unreadCount, 0);
      onUnreadChange?.(totalUnread);
    } catch (e) {
      console.error('Error cargando empleados:', e);
    } finally {
      setLoadingEmployees(false);
    }
  }, [user?.id, companyId, onUnreadChange]);

  // ── Cargar mensajes ───────────────────────────────────────────────────────
  const loadMessages = useCallback(async (emp: Employee) => {
    if (!user?.id) return;
    setLoadingMessages(true);
    try {
      const { data } = await supabase
        .from('ephemeral_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${emp.user_id}),` +
          `and(sender_id.eq.${emp.user_id},receiver_id.eq.${user.id})`
        )
        .gt('expires_at', new Date().toISOString())
        .order('sent_at', { ascending: true });

      setMessages(data ?? []);
      await markAndDeleteRead(emp.user_id);
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, [user?.id]);

  // ── Marcar como leído ─────────────────────────────────────────────────────
  const markAndDeleteRead = useCallback(async (senderId: string) => {
    if (!user?.id) return;
    try {
      await supabase
        .from('ephemeral_messages')
        .delete()
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .is('read_at', null);

      setEmployees(prev =>
        prev.map(c => c.user_id === senderId ? { ...c, unreadCount: 0 } : c)
      );
      setMessages(prev => prev.filter(m => !(m.sender_id === senderId && m.receiver_id === user.id)));
    } catch (e) {
      console.error('Error al borrar mensajes leídos:', e);
    }
  }, [user?.id]);

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!activeChat || !messageInput.trim() || !user?.id || sending || !companyId) return;
    const content = messageInput.trim();
    if (content.length > 500) return;

    setSending(true);
    setMessageInput('');
    try {
      const { data, error } = await supabase
        .from('ephemeral_messages')
        .insert({
          company_id: companyId,
          sender_id: user.id,
          receiver_id: activeChat.user_id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) setMessages(prev => [...prev, data]);
    } catch (e) {
      console.error('Error enviando mensaje:', e);
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  };

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Realtime: mensajes entrantes ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`manager-chat:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ephemeral_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setActiveChat(current => {
            if (current?.user_id === newMsg.sender_id) {
              setMessages(prev => [...prev, newMsg]);
              supabase
                .from('ephemeral_messages')
                .delete()
                .eq('id', newMsg.id)
                .then(() => {
                  setMessages(prev => prev.filter(m => m.id !== newMsg.id));
                });
            } else {
              setEmployees(prev =>
                prev.map(c =>
                  c.user_id === newMsg.sender_id
                    ? { ...c, unreadCount: c.unreadCount + 1 }
                    : c
                )
              );
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // ── Notificar total no leídos ─────────────────────────────────────────────
  useEffect(() => {
    const total = employees.reduce((acc, c) => acc + c.unreadCount, 0);
    onUnreadChange?.(total);
  }, [employees, onUnreadChange]);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      loadEmployees();
    }
  }, [isOpen, loadEmployees]);

  // ── Realtime: presencia ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !companyId) return;
    const channel = supabase
      .channel('manager-chat-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'time_entries', filter: `company_id=eq.${companyId}` },
        () => { loadEmployees(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, companyId, loadEmployees]);

  const handleSelectEmployee = async (emp: Employee) => {
    setActiveChat(emp);
    await loadMessages(emp);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleBack = () => {
    setActiveChat(null);
    setMessages([]);
    loadEmployees();
  };

  if (!isOpen) return null;

  // ─── RENDER: Conversación ─────────────────────────────────────────────────
  if (activeChat) {
    const pm = presenceMeta(activeChat.presence);

    // Agrupar mensajes consecutivos
    const groups: { senderId: string; msgs: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const last = groups[groups.length - 1];
      if (last && last.senderId === msg.sender_id) last.msgs.push(msg);
      else groups.push({ senderId: msg.sender_id, msgs: [msg] });
    }

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md h-[600px] bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          
          {/* Cabecera conversación */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0d1a2e]">
            <button onClick={handleBack} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/10">
                {activeChat.avatar_url
                  ? <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <User size={16} className="text-slate-500" />
                }
              </div>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${pm.dot} border-2 border-[#0d1a2e]`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{activeChat.full_name ?? 'Empleado'}</p>
              <p className={`text-[10px] font-medium ${pm.text}`}>{pm.label}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/15 rounded-full">
              <Trash2 size={10} className="text-indigo-400" />
              <span className="text-[9px] text-indigo-400 font-semibold">Efímero</span>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full text-slate-600">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                <div className="p-4 rounded-full bg-white/5 border border-white/5">
                  <MessageCircle size={24} className="opacity-40" />
                </div>
                <p className="text-xs">Sin mensajes todavía</p>
                <p className="text-[10px] text-slate-700">Los mensajes desaparecen al leerlos</p>
              </div>
            ) : (
              groups.map((group, gi) => {
                const isMine = group.senderId === user?.id;
                return (
                  <div key={gi} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} gap-0.5 mb-3`}>
                    {group.msgs.map((msg, mi) => {
                      const isLast = mi === group.msgs.length - 1;
                      return (
                        <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                          {!isMine && isLast && (
                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                              {activeChat.avatar_url
                                ? <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" />
                                : <span className="text-[9px] font-bold text-slate-500">{(activeChat.full_name ?? '?')[0]}</span>
                              }
                            </div>
                          )}
                          {!isMine && !isLast && <div className="w-6 shrink-0" />}
                          <div className="flex flex-col max-w-[75%]">
                            <div className={`px-3 py-2 text-[13px] leading-relaxed break-words ${
                              isMine
                                ? 'bg-primary rounded-2xl rounded-br-md text-white'
                                : 'bg-white/5 border border-white/5 rounded-2xl rounded-bl-md text-slate-200'
                            }`}>
                              {msg.content}
                            </div>
                            {isLast && (
                              <span className={`text-[9px] text-slate-600 mt-1 ${isMine ? 'text-right pr-1' : 'pl-1'}`}>
                                {formatTime(msg.sent_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/5 bg-[#0d1a2e]">
            <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 pl-4 focus-within:border-primary/40 transition-colors">
              <textarea
                ref={textareaRef}
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Escribe un mensaje..."
                maxLength={500}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-white text-sm resize-none py-2 placeholder:text-slate-600 max-h-20"
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 80) + 'px';
                }}
              />
              {messageInput.length > 420 && (
                <span className={`text-[9px] self-center shrink-0 ${messageInput.length > 480 ? 'text-red-400' : 'text-slate-600'}`}>
                  {messageInput.length}/500
                </span>
              )}
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim() || sending}
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  messageInput.trim()
                    ? 'bg-primary text-white hover:bg-primary/80'
                    : 'bg-white/5 text-slate-600 cursor-default'
                }`}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Lista de empleados ───────────────────────────────────────────
  const activeEmps = employees.filter(c => c.presence !== 'out');
  const offlineEmps = employees.filter(c => c.presence === 'out');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md h-[600px] bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Cabecera */}
        <div className="px-5 pt-5 pb-3 border-b border-white/10 bg-[#0d1a2e]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageCircle size={20} className="text-primary" />
                Chat Equipo
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeEmps.length > 0
                  ? <span className="text-emerald-400">{activeEmps.length} en turno</span>
                  : <span>Nadie en turno</span>
                }
                {offlineEmps.length > 0 && <span> · {offlineEmps.length} fuera</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadEmployees} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <RefreshCw size={14} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
            <Trash2 size={10} className="text-indigo-400" />
            <span className="text-[10px] text-slate-500">Los mensajes desaparecen al leerlos · máx. 24h</span>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingEmployees ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 px-8">
              <User size={32} className="opacity-30" />
              <p className="text-sm text-center">No hay empleados en tu organización.</p>
            </div>
          ) : (
            <>
              {/* En turno */}
              {activeEmps.length > 0 && (
                <div className="px-4 pt-4">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-3">
                    En turno · {activeEmps.length}
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                    {activeEmps.map(emp => {
                      const pm = presenceMeta(emp.presence);
                      return (
                        <button key={emp.user_id} onClick={() => handleSelectEmployee(emp)}
                          className="flex flex-col items-center gap-1.5 shrink-0 group">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-white/10 group-hover:border-primary/40 transition-colors">
                              {emp.avatar_url
                                ? <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                                : <span className="text-sm font-bold text-slate-400">{(emp.full_name ?? '?')[0].toUpperCase()}</span>
                              }
                            </div>
                            <span className={`absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full ${pm.dot} border-2 border-[#0a1628]`} />
                            {emp.unreadCount > 0 && (
                              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-[#0a1628]">
                                {emp.unreadCount > 9 ? '9+' : emp.unreadCount}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 group-hover:text-slate-300 max-w-[56px] truncate transition-colors">
                            {emp.full_name?.split(' ')[0] ?? '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fuera de turno */}
              {offlineEmps.length > 0 && (
                <div className="px-4 pt-4">
                  <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Fuera de turno · {offlineEmps.length}
                  </p>
                  <div className="space-y-1">
                    {offlineEmps.map(emp => (
                      <button key={emp.user_id} onClick={() => handleSelectEmployee(emp)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left group">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-full bg-slate-800/60 flex items-center justify-center overflow-hidden border border-white/5">
                            {emp.avatar_url
                              ? <img src={emp.avatar_url} alt="" className="w-full h-full object-cover opacity-60" />
                              : <span className="text-xs font-bold text-slate-600">{(emp.full_name ?? '?')[0].toUpperCase()}</span>
                            }
                          </div>
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-slate-700 border border-[#0a1628]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-500 group-hover:text-slate-300 font-medium truncate transition-colors">
                            {emp.full_name ?? 'Sin nombre'}
                          </p>
                          <p className="text-[10px] text-slate-700">
                            {emp.last_entry_at ? `Última actividad · ${formatTime(emp.last_entry_at)}` : 'Sin actividad'}
                          </p>
                        </div>
                        {emp.unreadCount > 0 && (
                          <div className="bg-primary text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0">
                            {emp.unreadCount > 9 ? '9+' : emp.unreadCount}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
