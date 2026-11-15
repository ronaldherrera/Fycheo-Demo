/**
 * Seguimiento de uso de la demo.
 *
 * Una «visita» es una sesión de uso de un invitado: sobrevive a recargas y a
 * abrir varias ventanas (el id se comparte por localStorage) y caduca a las
 * 12 horas. Se crea con `demo_track_visit`, se mantiene viva con
 * `demo_heartbeat` y se le cuelgan eventos con `demo_track_event`.
 *
 * Las tres RPC se llaman siempre con la clave anon, con un cliente propio sin
 * sesión: así no dependen de que el administrador demo esté o no conectado.
 * Nada de este módulo lanza ni bloquea la interfaz: si algo falla, la demo
 * sigue funcionando sin seguimiento.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const VISIT_KEY = 'fycheo_demo_visit';
const VISIT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const HEARTBEAT_MS = 60_000;
const EVENT_NAME_MAX = 40;

interface StoredVisit {
  id: string;
  email: string;
  startedAt: string;
}

export type TrackDetail = Record<string, unknown>;

// ── Cliente anon dedicado ────────────────────────────────────────────────────
let client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  client = url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'fycheo-demo-tracking',
        },
      })
    : null;
  return client;
}

// ── Utilidades ───────────────────────────────────────────────────────────────
export function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function readVisit(): StoredVisit | null {
  try {
    const raw = localStorage.getItem(VISIT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredVisit>;
    if (typeof v.id === 'string' && typeof v.email === 'string' && typeof v.startedAt === 'string') {
      return v as StoredVisit;
    }
    return null;
  } catch {
    return null;
  }
}

function writeVisit(visit: StoredVisit): void {
  try {
    localStorage.setItem(VISIT_KEY, JSON.stringify(visit));
  } catch {
    /* sin localStorage no hay visita compartida; la demo sigue igual */
  }
}

function isFreshVisitFor(visit: StoredVisit | null, email: string): visit is StoredVisit {
  if (!visit || visit.email !== email) return false;
  const age = Date.now() - Date.parse(visit.startedAt);
  return Number.isFinite(age) && age >= 0 && age < VISIT_MAX_AGE_MS;
}

function warn(action: string, error: unknown): void {
  console.warn(`[demo tracking] ${action}:`, error);
}

// ── Visita ───────────────────────────────────────────────────────────────────
// Mientras se está creando la visita, los eventos esperan a tener su id.
let pendingVisit: Promise<void> | null = null;
let pendingVisitEmail = '';

async function createOrReuseVisit(email: string): Promise<void> {
  if (isFreshVisitFor(readVisit(), email)) return;

  const supabase = getClient();
  if (!supabase) return;

  try {
    const { data, error } = await supabase.rpc('demo_track_visit', {
      p_email: email,
      p_device_type: detectDevice(),
      p_user_agent: navigator.userAgent.slice(0, 250),
      p_referrer: document.referrer || null,
      p_landing_path: location.pathname + location.search,
    });
    if (error) {
      warn('no se ha podido registrar la visita', error);
      return;
    }
    if (typeof data !== 'string' || !data) return;
    writeVisit({ id: data, email, startedAt: new Date().toISOString() });
  } catch (e) {
    warn('no se ha podido registrar la visita', e);
  }
}

/**
 * Registra la visita del invitado (o reutiliza la que ya tenga abierta en este
 * navegador si es del mismo email y tiene menos de 12 horas). Nunca rechaza.
 */
export function startVisit(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (pendingVisit && pendingVisitEmail === cleanEmail) return pendingVisit;

  pendingVisitEmail = cleanEmail;
  const promise = createOrReuseVisit(cleanEmail).finally(() => {
    if (pendingVisit === promise) pendingVisit = null;
  });
  pendingVisit = promise;
  return promise;
}

// ── Eventos ──────────────────────────────────────────────────────────────────
async function sendEvent(event: string, detail?: TrackDetail): Promise<void> {
  try {
    if (pendingVisit) await pendingVisit;
    const visit = readVisit();
    const supabase = getClient();
    if (!visit || !supabase) return;

    const { error } = await supabase.rpc('demo_track_event', {
      p_visit_id: visit.id,
      p_event: event.slice(0, EVENT_NAME_MAX),
      p_detail: detail ?? {},
    });
    if (error) warn(`evento "${event}" no registrado`, error);
  } catch (e) {
    warn(`evento "${event}" no registrado`, e);
  }
}

/**
 * Registra un evento de la visita actual. Síncrono para quien llama: no hay
 * nada que esperar ni que capturar; sin visita o con error, no hace nada.
 */
export function track(event: string, detail?: TrackDetail): void {
  void sendEvent(event, detail);
}

// ── Heartbeat ────────────────────────────────────────────────────────────────
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function sendHeartbeat(): Promise<void> {
  try {
    const visit = readVisit();
    const supabase = getClient();
    if (!visit || !supabase) return;
    const { error } = await supabase.rpc('demo_heartbeat', { p_visit_id: visit.id });
    if (error) warn('heartbeat no registrado', error);
  } catch (e) {
    warn('heartbeat no registrado', e);
  }
}

function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Cada 60 s, si la pestaña está visible, avisa de que el visitante sigue
 * dentro. Es un singleton por ventana: llamarlo varias veces no duplica el
 * intervalo. Dentro de un iframe no hace nada (la ventana que lo contiene ya
 * late por él). Devuelve la función para pararlo.
 */
export function startHeartbeat(): () => void {
  if (isEmbedded()) return () => {};
  if (heartbeatTimer === null) {
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void sendHeartbeat();
    }, HEARTBEAT_MS);
  }
  return stopHeartbeat;
}
