/**
 * ChatPanel.tsx
 *
 * Panel de chat efímero entre compañeros de la misma organización.
 * - Muestra lista de compañeros con estado de presencia (trabajando/descanso/fuera)
 * - Chat 1 a 1 con mensajes que se borran al ser leídos (TTL 24h)
 * - Realtime vía Supabase channels
 */

import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Clock, Check, CheckCheck } from 'lucide-react';
import { supabase } from '../services/supabase';
import { deAdjustISOString, adjustDataToCurrentDate } from '../../lib/date-adjuster';
import { AppContext } from '../EmployeeApp';
import { DEFAULT_AVATAR } from '../constants';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type PresenceStatus = 'working' | 'break' | 'others' | 'out';

interface Coworker {
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
  delivered_at: string | null;
  read_at: string | null;
  expires_at: string;
}

interface ChatPanelProps {
  companyId: string;
  onUnreadChange?: (count: number) => void;
  onClose?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const entryTypeToPresence = (entryType: string | null): PresenceStatus => {
  switch ((entryType ?? '').toLowerCase()) {
    case 'clock-in':
    case 'break-end':
    case 'others-in':
      return 'working';
    case 'break-start':
      return 'break';
    case 'others-out':
      return 'others';
    default:
      return 'out';
  }
};

const presenceMeta = (p: PresenceStatus) => {
  switch (p) {
    case 'working':  return { label: 'Trabajando', color: '#22c55e', dot: 'bg-green-400' };
    case 'break':    return { label: 'Descanso',   color: '#f59e0b', dot: 'bg-amber-400' };
    case 'others':   return { label: 'Permiso',    color: '#ec4899', dot: 'bg-pink-400' };
    default:         return { label: 'Fuera',       color: '#64748b', dot: 'bg-slate-400' };
  }
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
};

const formatMsgTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const formatSeparatorDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = nowDate.getTime() - dDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  }
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getPriorityAvatar = (avatar: string | null | undefined, avatarUrl: string | null | undefined): string | null => {
  const isInvalid = (url: string | null | undefined): boolean => {
    if (!url) return true;
    const u = url.toLowerCase().trim();
    return (
      u === '' || 
      u.includes('default') || 
      u.includes('placeholder') || 
      u.includes('avatar-placeholder') ||
      u.includes('avatar_placeholder')
    );
  };
  if (!isInvalid(avatarUrl)) return avatarUrl!;
  if (!isInvalid(avatar)) return avatar!;
  return null;
};

// ─── Avatar (compartido entre ChatPanel y CoworkerCard) ─────────────────────

const Avatar = ({ avatar, avatarUrl, src: propSrc, name, size = 36, offline = false }: { avatar?: string | null; avatarUrl?: string | null; src?: string | null; name: string | null; size?: number; offline?: boolean }) => {
  const initial = (name ?? '?')[0].toUpperCase();
  const hue = 240 + ((name?.charCodeAt(0) ?? 0) % 40);
  const src = propSrc || getPriorityAvatar(avatar, avatarUrl);
  if (src) return (
    <img src={src} alt={name ?? ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, opacity: offline ? 0.6 : 1 }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
  );
  
  const bg = offline
    ? `linear-gradient(135deg, hsl(${hue},30%,20%), hsl(${hue},25%,16%))`
    : `linear-gradient(135deg, hsl(${hue},65%,55%), hsl(${hue + 25},75%,40%))`;
  const color = offline ? '#334155' : '#fff';

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 800, color: color, letterSpacing: '-0.01em',
    }}>{initial}</div>
  );
};


// ─── Componente ───────────────────────────────────────────────────────────────

const ChatPanel: React.FC<ChatPanelProps> = ({ companyId, onUnreadChange, onClose }) => {
  const { user } = useContext(AppContext);

  // Estado de la lista de compañeros
  const [coworkers, setCoworkers] = useState<Coworker[]>([]);
  const [loadingCoworkers, setLoadingCoworkers] = useState(true);

  // Estado de la conversación activa
  const [activeChat, setActiveChat] = useState<Coworker | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  // ── Cargar compañeros con presencia ────────────────────────────────────────
  const loadCoworkers = useCallback(async () => {
    if (!user?.id || !companyId) return;
    setLoadingCoworkers(true);
    try {
      // 1. Obtener miembros de la empresa (excepto yo)
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('user_id, profiles:user_id(full_name, avatar)')
        .eq('company_id', companyId)
        .eq('accepted', true)
        .neq('user_id', user.id);

      if (membersError) throw membersError;
      if (!members || members.length === 0) {
        setCoworkers([]);
        return;
      }

      // 2. Para cada miembro, obtener su último fichaje (presencia)
      const coworkerList: Coworker[] = await Promise.all(
        members.map(async (m: any) => {
          const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;

          // Solo entradas hasta "ahora" en tiempo demo para determinar presencia real
          const { data: rawLastEntry } = await supabase
            .from('time_entries')
            .select('entry_type, occurred_at, created_at')
            .eq('user_id', m.user_id)
            .lte('occurred_at', deAdjustISOString(new Date().toISOString()))
            .order('occurred_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastEntry = rawLastEntry ? adjustDataToCurrentDate(rawLastEntry) : null;
          const presence = entryTypeToPresence(lastEntry?.entry_type ?? null);
          const lastAt = lastEntry?.occurred_at ?? lastEntry?.created_at ?? null;

          // 3. Contar mensajes no leídos de este compañero hacia mí
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
            presence,
            last_entry_at: lastAt,
            unreadCount: count ?? 0,
          };
        })
      );

      // Ordenar: trabajando primero, luego descanso, luego fuera
      const order: Record<PresenceStatus, number> = { working: 0, break: 1, others: 2, out: 3 };
      coworkerList.sort((a, b) => order[a.presence] - order[b.presence]);

      setCoworkers(coworkerList);

      // Notificar total no leídos al padre
      const totalUnread = coworkerList.reduce((acc, c) => acc + c.unreadCount, 0);
      onUnreadChange?.(totalUnread);
    } catch (e) {
      console.error('Error cargando compañeros:', e);
    } finally {
      setLoadingCoworkers(false);
    }
  }, [user?.id, companyId, onUnreadChange]);

  // ── Cargar mensajes de una conversación ───────────────────────────────────
  const loadMessages = useCallback(async (coworker: Coworker) => {
    if (!user?.id) return;
    setLoadingMessages(true);
    try {
      // Obtener mensajes entre yo y el compañero (en ambas direcciones)
      const { data, error } = await supabase
        .from('ephemeral_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${coworker.user_id}),` +
          `and(sender_id.eq.${coworker.user_id},receiver_id.eq.${user.id})`
        )
        .gt('expires_at', new Date().toISOString())
        .order('sent_at', { ascending: true });

      if (error) throw error;
      setMessages(data ?? []);

      // Marcar como leídos (y borrar) los mensajes del compañero hacia mí
      await markAndDeleteRead(coworker.user_id);
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, [user?.id]);

  // ── Marcar como leído y borrar ─────────────────────────────────────────────
  const markAndDeleteRead = useCallback(async (senderId: string) => {
    if (!user?.id) return;
    try {
      // Borrar directamente los mensajes del compañero hacia mí no leídos
      await supabase
        .from('ephemeral_messages')
        .delete()
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .is('read_at', null);

      // Actualizar la lista local de no leídos
      setCoworkers(prev =>
        prev.map(c => c.user_id === senderId ? { ...c, unreadCount: 0 } : c)
      );
      setMessages(prev => prev.filter(m => !(m.sender_id === senderId && m.receiver_id === user.id)));
      onUnreadChange?.(0); // Se recalculará en próximo load
    } catch (e) {
      console.error('Error al borrar mensajes leídos:', e);
    }
  }, [user?.id, onUnreadChange]);

  // ── Estado de mensaje al estilo WhatsApp ─────────────────────────────────
  const renderMessageStatus = (msg: ChatMessage) => {
    if (msg.id.startsWith('temp-')) {
      return <Clock size={11} className="text-slate-500 inline-block align-middle" />;
    }
    if (msg.read_at) {
      return <CheckCheck size={11} className="text-sky-400 inline-block align-middle" />;
    }
    if (msg.delivered_at) {
      return <CheckCheck size={11} className="text-slate-400 inline-block align-middle" />;
    }
    return <Check size={11} className="text-slate-400 inline-block align-middle" />;
  };

  // ── Enviar mensaje ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!activeChat || !messageInput.trim() || !user?.id || sending) return;
    const content = messageInput.trim();
    if (content.length > 500) return;

    setSending(true);
    setMessageInput('');

    // Mensaje temporal → muestra reloj mientras se envía
    const tempId = `temp-${Math.random().toString(36).substring(2, 9)}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      sender_id: user.id,
      receiver_id: activeChat.user_id,
      content,
      sent_at: new Date().toISOString(),
      delivered_at: null,
      read_at: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

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
      if (data) {
        // Reemplaza el temporal por el mensaje real → reloj pasa a check
        setMessages(prev => prev.map(m => m.id === tempId ? data : m));
      }
    } catch (e) {
      console.error('Error enviando mensaje:', e);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  };

  // ── Auto-scroll al final ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Suscripción Realtime: mensajes entrantes ───────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`chat:user:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ephemeral_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          setActiveChat(current => {
            if (current?.user_id === newMsg.sender_id) {
              setMessages(prev => [...prev, newMsg]);
              // Marca como leído (el sender verá el doble check azul) y luego borra localmente
              supabase
                .from('ephemeral_messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', newMsg.id)
                .then(() => {
                  setMessages(prev => prev.filter(m => m.id !== newMsg.id));
                });
            } else {
              supabase
                .from('ephemeral_messages')
                .update({ delivered_at: new Date().toISOString() })
                .eq('id', newMsg.id);
              setCoworkers(prev => {
                const updated = prev.map(c =>
                  c.user_id === newMsg.sender_id
                    ? { ...c, unreadCount: c.unreadCount + 1 }
                    : c
                );
                const total = updated.reduce((acc, c) => acc + c.unreadCount, 0);
                onUnreadChange?.(total);
                return updated;
              });
            }
            return current;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ephemeral_messages',
          filter: `sender_id=eq.${user.id}`,
        },
        (payload) => {
          // El destinatario ha leído el mensaje → mostrar doble check azul
          const updatedMsg = payload.new as ChatMessage;
          setMessages(prev =>
            prev.map(m => m.id === updatedMsg.id ? { ...m, delivered_at: updatedMsg.delivered_at, read_at: updatedMsg.read_at } : m)
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, onUnreadChange]);

  // ── Notificar total no leídos cuando cambian los compañeros ────────────────
  useEffect(() => {
    const total = coworkers.reduce((acc, c) => acc + c.unreadCount, 0);
    onUnreadChange?.(total);
  }, [coworkers, onUnreadChange]);

  // ── Carga inicial y cuando cambia la empresa ───────────────────────────────
  useEffect(() => {
    loadCoworkers();
    // Recargar presencia cada 60 segundos
    const interval = setInterval(loadCoworkers, 60_000);
    return () => clearInterval(interval);
  }, [loadCoworkers]);

  // ── Suscripción Realtime: presencia de compañeros ──────────────────────────
  useEffect(() => {
    if (!user?.id || !companyId) return;

    const channel = supabase
      .channel('realtime_coworkers_presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          loadCoworkers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, companyId, loadCoworkers]);

  // ── Al seleccionar compañero ───────────────────────────────────────────────
  const handleSelectCoworker = async (coworker: Coworker) => {
    setActiveChat(coworker);
    await loadMessages(coworker);
  };

  // ── Volver a la lista ──────────────────────────────────────────────────────
  const handleBack = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setActiveChat(null);
    setMessages([]);
    loadCoworkers(); // Refrescar badges
  };

  // ── Agrupar mensajes consecutivos del mismo sender ─────────────────────────
  const groupMessages = (msgs: ChatMessage[]) => {
    const groups: { senderId: string; msgs: ChatMessage[] }[] = [];
    for (const msg of msgs) {
      const last = groups[groups.length - 1];
      if (last && last.senderId === msg.sender_id) last.msgs.push(msg);
      else groups.push({ senderId: msg.sender_id, msgs: [msg] });
    }
    return groups;
  };

  // ── Agrupar mensajes por día y por emisor consecutivo ───────────────────────
  interface DateGroup {
    dateStr: string;
    sentAt: string;
    groups: {
      senderId: string;
      msgs: ChatMessage[];
    }[];
  }

  const groupMessagesByDayAndSender = (msgs: ChatMessage[]) => {
    const dayGroups: DateGroup[] = [];
    for (const msg of msgs) {
      const dateStr = new Date(msg.sent_at).toDateString();
      let dayGroup = dayGroups.find(dg => dg.dateStr === dateStr);
      if (!dayGroup) {
        dayGroup = {
          dateStr,
          sentAt: msg.sent_at,
          groups: []
        };
        dayGroups.push(dayGroup);
      }
      const lastSenderGroup = dayGroup.groups[dayGroup.groups.length - 1];
      if (lastSenderGroup && lastSenderGroup.senderId === msg.sender_id) {
        lastSenderGroup.msgs.push(msg);
      } else {
        dayGroup.groups.push({
          senderId: msg.sender_id,
          msgs: [msg]
        });
      }
    }
    return dayGroups;
  };

  // ─── RENDER: Conversación ──────────────────────────────────────────────────
  if (activeChat) {
    const pm = presenceMeta(activeChat.presence);
    const dayGroups = groupMessagesByDayAndSender(messages);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#060e1c' }}>

        {/* ── Cabecera ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px',
          background: 'rgba(6,14,28,0.97)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
        }}>
          <button onClick={handleBack} style={{
            width: 34, height: 34, borderRadius: 11, flexShrink: 0,
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)',
            cursor: 'pointer', color: '#818cf8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 19 }}>chevron_left</span>
          </button>

          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar src={activeChat.avatar_url} name={activeChat.full_name} size={38} />
            <span style={{
              position: 'absolute', bottom: 1, right: 1,
              width: 10, height: 10, borderRadius: '50%',
              background: pm.color, border: '2px solid #060e1c',
            }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeChat.full_name ?? 'Compañero'}
            </div>
            <div style={{ fontSize: 11, color: pm.color, marginTop: 1 }}>{pm.label}</div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '3px 9px',
            background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 20, flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#6366f1' }}>auto_delete</span>
            <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>Efímero</span>
          </div>
        </div>

        {/* ── Zona de mensajes ── */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '14px 13px 6px',
          display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0,
        }}>
          {loadingMessages ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 50 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#1e3a5f', animation: 'cpSpin 1s linear infinite' }}>progress_activity</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.7 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#1e3a5f' }}>chat_bubble</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#475569' }}>Sin mensajes todavía</div>
                <div style={{ fontSize: 11, color: '#1e3a5f', marginTop: 3 }}>Los mensajes desaparecen al leerlos</div>
              </div>
            </div>
          ) : (
            dayGroups.map((dayGroup) => {
              return (
                <div key={dayGroup.dateStr} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  {/* Separador de fecha Sticky */}
                  <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '6px 0 12px',
                    padding: '4px 0',
                    width: '100%',
                    pointerEvents: 'none',
                  }}>
                    <span style={{
                      background: 'rgba(15,23,42,0.92)',
                      color: '#94a3b8',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 8,
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                      pointerEvents: 'auto',
                    }}>
                      {formatSeparatorDate(dayGroup.sentAt)}
                    </span>
                  </div>

                  {/* Mensajes de este día */}
                  {dayGroup.groups.map((group, gi) => {
                    const isMine = group.senderId === user?.id;
                    return (
                      <div key={gi} style={{
                        display: 'flex', flexDirection: 'column',
                        width: '100%',
                        alignItems: isMine ? 'flex-end' : 'flex-start',
                        gap: 2, marginBottom: 8,
                      }}>
                        {group.msgs.map((msg, mi) => {
                          const isFirst = mi === 0;
                          const isLast  = mi === group.msgs.length - 1;
                          const rr = (tl: number, tr: number, br: number, bl: number) =>
                            `${tl}px ${tr}px ${br}px ${bl}px`;
                          const radius = isMine
                            ? rr(isFirst ? 18 : 6, 18, isLast ? 5 : 18, 18)
                            : rr(18, isFirst ? 18 : 6, 18, isLast ? 5 : 18);

                          return (
                            <div key={msg.id} style={{
                              display: 'flex', alignItems: 'flex-end', gap: 7,
                              width: '100%',
                              flexDirection: isMine ? 'row-reverse' : 'row',
                              animation: 'cpSlide 0.18s ease',
                              marginBottom: 2,
                            }}>
                              {/* Avatar / Spacer */}
                              {!isMine && isLast && (
                                <div style={{ flexShrink: 0, marginBottom: 2 }}>
                                  <Avatar src={activeChat.avatar_url} name={activeChat.full_name} size={26} />
                                </div>
                              )}
                              {!isMine && !isLast && (
                                <div style={{ width: 26, flexShrink: 0 }} />
                              )}

                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                maxWidth: '72%',
                                width: 'fit-content',
                              }}>
                                <div style={{
                                  padding: '9px 13px',
                                  borderRadius: radius,
                                  background: isMine
                                    ? '#6366f1'
                                    : 'rgba(18,28,50,0.95)',
                                  border: isMine ? 'none' : '1px solid rgba(99,102,241,0.1)',
                                  color: '#f1f5f9', fontSize: 14.5, fontWeight: 500, fontFamily: '"Manrope", sans-serif', lineHeight: 1.5, wordBreak: 'break-word',
                                }}>
                                  {msg.content}
                                </div>
                                {isLast && (
                                  <span style={{
                                    fontSize: 9, color: '#64748b', marginTop: 3,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    justifyContent: isMine ? 'flex-end' : 'flex-start',
                                    paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0,
                                  }}>
                                    {isMine && renderMessageStatus(msg)}
                                    <span>{formatMsgTime(msg.sent_at)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <div style={{ padding: '8px 12px 18px', background: 'rgba(6,14,28,0.97)', borderTop: '1px solid rgba(99,102,241,0.08)' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'rgba(18,28,50,0.9)', border: '1px solid rgba(99,102,241,0.14)',
            borderRadius: 18, padding: '5px 5px 5px 14px',
          }}>
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Mensaje efímero..."
              maxLength={500} rows={1}
              style={{
                flex: 1, resize: 'none', outline: 'none', background: 'transparent', border: 'none',
                color: '#f1f5f9', fontSize: 13.5, padding: '7px 0', lineHeight: 1.5, fontFamily: 'inherit',
              }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 88) + 'px';
              }}
            />
            {messageInput.length > 420 && (
              <span style={{ fontSize: 9, color: messageInput.length > 480 ? '#f87171' : '#334155', alignSelf: 'center', flexShrink: 0 }}>
                {messageInput.length}/500
              </span>
            )}
            <button onClick={sendMessage} disabled={!messageInput.trim() || sending} style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: messageInput.trim() ? '#6366f1' : 'rgba(30,45,70,0.5)',
              border: 'none', cursor: messageInput.trim() ? 'pointer' : 'default',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 19 }}>
                {sending ? 'progress_activity' : 'send'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER: Lista de compañeros ──────────────────────────────────────────
  const activeCoworkers = coworkers.filter(c => c.presence !== 'out');
  const offlineCoworkers = coworkers.filter(c => c.presence === 'out');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#060e1c' }}>

      {/* ── Cabecera ── */}
      <div style={{
        padding: '14px 15px 11px',
        background: 'rgba(6,14,28,0.97)',
        borderBottom: '1px solid rgba(99,102,241,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <div>
            <div style={{ fontWeight: 800, color: '#f1f5f9', fontSize: 16, letterSpacing: '-0.02em' }}>Compañeros</div>
            <div style={{ fontSize: 11, marginTop: 2 }}>
              {activeCoworkers.length > 0
                ? <span style={{ color: '#22c55e' }}>{activeCoworkers.length} en turno ahora</span>
                : <span style={{ color: '#334155' }}>Nadie en turno ahora</span>}
              {offlineCoworkers.length > 0 && (
                <span style={{ color: '#1e3a5f' }}> · {offlineCoworkers.length} fuera</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={loadCoworkers} style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.14)',
              cursor: 'pointer', color: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            </button>
            {onClose && (
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                cursor: 'pointer', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.09)',
          borderRadius: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#4338ca' }}>auto_delete</span>
          <span style={{ fontSize: 10, color: '#334155' }}>Los mensajes desaparecen al leerlos · máx. 24h</span>
        </div>
      </div>

      {/* ── Lista ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingCoworkers ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 50 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#1e3a5f', animation: 'cpSpin 1s linear infinite' }}>progress_activity</span>
          </div>
        ) : coworkers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 24px', gap: 12 }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%',
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#1e3a5f' }}>group</span>
            </div>
            <span style={{ fontSize: 13, color: '#334155', textAlign: 'center', lineHeight: 1.6 }}>
              No hay compañeros en tu organización todavía.
            </span>
          </div>
        ) : (
          <>
            {/* ── Story circles para activos ── */}
            {activeCoworkers.length > 0 && (
              <div style={{ padding: '14px 14px 6px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  En turno · {activeCoworkers.length}
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                  {activeCoworkers.map(c => {
                    const pm = presenceMeta(c.presence);
                    const initial = (c.full_name ?? '?')[0].toUpperCase();
                    return (
                      <button key={c.user_id} onClick={() => handleSelectCoworker(c)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 4px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0,
                      }}>
                        <div style={{ position: 'relative' }}>
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{
                              width: 52, height: 52, borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366f1, #4338ca)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 19, fontWeight: 800, color: '#fff',
                            }}>{initial}</div>
                          )}
                          {/* Punto de estado ("punti") en la esquina inferior derecha */}
                          <span style={{
                            position: 'absolute', bottom: 1, right: 1,
                            width: 11, height: 11, borderRadius: '50%',
                            background: pm.color, border: '2px solid #060e1c',
                          }} />
                          {c.unreadCount > 0 && (
                            <div style={{
                              position: 'absolute', top: -2, right: -2,
                              background: '#ef4444', color: '#fff',
                              minWidth: 17, height: 17, borderRadius: 9,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, fontWeight: 800, border: '2px solid #060e1c', padding: '0 3px',
                            }}>{c.unreadCount > 9 ? '9+' : c.unreadCount}</div>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: '#64748b', maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.full_name?.split(' ')[0] ?? '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Lista de fuera de turno ── */}
            {offlineCoworkers.length > 0 && (
              <>
                <div style={{ padding: '12px 15px 6px', fontSize: 10, fontWeight: 700, color: '#1e3a5f', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Fuera de turno · {offlineCoworkers.length}
                </div>
                <div style={{ padding: '0 10px 10px' }}>
                  {offlineCoworkers.map(c => (
                    <CoworkerCard key={c.user_id} coworker={c} onClick={() => handleSelectCoworker(c)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Sub-componente: Card compañero fuera de turno ───────────────────────────

const CoworkerCard: React.FC<{ coworker: Coworker; onClick: () => void }> = ({ coworker, onClick }) => {
  const pm   = presenceMeta(coworker.presence);
  const init = (coworker.full_name ?? '?')[0].toUpperCase();
  const hue  = 240 + ((coworker.full_name?.charCodeAt(0) ?? 0) % 40);

  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', margin: '3px 0',
      background: 'rgba(12,22,42,0.6)', border: '1px solid rgba(99,102,241,0.06)',
      borderRadius: 14, cursor: 'pointer', textAlign: 'left',
      transition: 'all 0.15s', opacity: 0.65,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'; e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(12,22,42,0.6)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.06)'; e.currentTarget.style.opacity = '0.65'; }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {coworker.avatar_url ? (
          <img src={coworker.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, hsl(${hue},30%,20%), hsl(${hue},25%,16%))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#334155',
          }}>{init}</div>
        )}
        <span style={{
          position: 'absolute', bottom: 1, right: 1, width: 9, height: 9,
          borderRadius: '50%', background: pm.color, border: '1.5px solid #060e1c',
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: '#64748b', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {coworker.full_name ?? 'Sin nombre'}
        </div>
        <div style={{ fontSize: 10, color: '#1e3a5f', marginTop: 1 }}>
          {coworker.last_entry_at ? `Última actividad · ${formatTime(coworker.last_entry_at)}` : 'Sin actividad hoy'}
        </div>
      </div>

      {coworker.unreadCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #6366f1, #4338ca)',
          color: '#fff', borderRadius: 9, minWidth: 20, height: 20, padding: '0 5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, flexShrink: 0,
        }}>{coworker.unreadCount > 9 ? '9+' : coworker.unreadCount}</div>
      )}
    </button>
  );
};

// ─── CSS keyframes ────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('chat-panel-styles')) {
  const s = document.createElement('style');
  s.id = 'chat-panel-styles';
  s.textContent = `
    @keyframes cpSlide  { from { opacity:0; transform:translateY(7px) scale(0.97) } to { opacity:1; transform:none } }
    @keyframes cpPulse  { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:0.45; transform:scale(1.4) } }
    @keyframes cpSpin   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  `;
  document.head.appendChild(s);
}

export default ChatPanel;
