-- =============================================================
-- FYCHEO DEMO — SCHEMA COMPLETO
-- Ejecuta este script PRIMERO en el SQL Editor de Supabase
-- =============================================================

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT,
  name          TEXT,
  email         TEXT,
  avatar        TEXT,
  phone         TEXT,
  dni_nie       TEXT,
  ss_number     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: crea perfil automáticamente al registrar usuario en Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── COMPANIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  owner_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan            TEXT DEFAULT 'free',
  logo_url        TEXT,
  settings        JSONB DEFAULT '{}'::jsonb,
  kiosk_device_id TEXT,
  kiosk_pin       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TEAMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COMPANY MEMBERS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_members (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'employee',
  team_id     UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  accepted    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

-- ─── SHIFTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  notes       TEXT,
  status      TEXT DEFAULT 'scheduled',
  color       TEXT,
  overtime    NUMERIC,
  is_published BOOLEAN DEFAULT FALSE,
  updated_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TIME ENTRIES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.time_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_type  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT DEFAULT 'approved',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ABSENCES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.absences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE,
  type          TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  reason        TEXT,
  document_url  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COMPANY HOLIDAYS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  date        DATE NOT NULL,
  type        TEXT DEFAULT 'closed',
  start_time  TEXT,
  end_time    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ACTIVITY LOGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  manager_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TASKS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'pending',
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ÍNDICES (rendimiento) ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_entries_user_occurred ON public.time_entries(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_company ON public.time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_shifts_company_date ON public.shifts(company_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON public.shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_company ON public.absences(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs(company_id, created_at);

-- ─── REALTIME (para notificaciones en vivo) ──────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.absences;

-- ─── STORAGE (para documentos de ausencias) ──────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('Documents', 'Documents', true)
ON CONFLICT (id) DO NOTHING;

-- ─── FIN ─────────────────────────────────────────────────────
-- Ahora ejecuta en orden: 01, 02, 03, 04, 05
