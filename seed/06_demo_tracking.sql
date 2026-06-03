-- ================================================================
-- FYCHEO DEMO — Tracking de accesos y actividad
-- Ejecutar en el proyecto Supabase de la demo
-- ================================================================

-- Añadir created_at a demo_access si no existe
alter table demo_access
  add column if not exists created_at timestamptz not null default now();

-- ── Visitas ──────────────────────────────────────────────────────
-- Registra cada vez que alguien entra a la demo (nuevos y recurrentes)
create table if not exists demo_visits (
  id           uuid        primary key default gen_random_uuid(),
  email        text        not null,
  visited_at   timestamptz not null default now(),
  device_type  text,        -- 'desktop' | 'mobile' | 'tablet'
  user_agent   text
);

alter table demo_visits enable row level security;

drop policy if exists "anon insert demo_visits"  on demo_visits;
drop policy if exists "anon select demo_visits"  on demo_visits;
create policy "anon insert demo_visits" on demo_visits for insert to anon with check (true);
create policy "anon select demo_visits" on demo_visits for select to anon using (true);

-- ── Eventos de sección ───────────────────────────────────────────
-- Registra qué sección (manager / kiosk / employee) ve cada usuario
create table if not exists demo_events (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  section     text        not null,  -- 'manager' | 'kiosk' | 'employee'
  created_at  timestamptz not null default now()
);

alter table demo_events enable row level security;

drop policy if exists "anon insert demo_events" on demo_events;
drop policy if exists "anon select demo_events" on demo_events;
create policy "anon insert demo_events" on demo_events for insert to anon with check (true);
create policy "anon select demo_events" on demo_events for select to anon using (true);
