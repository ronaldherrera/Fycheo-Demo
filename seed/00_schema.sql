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
  description TEXT,
  date        DATE,
  entry_time  TEXT,
  minutes     INTEGER,
  is_manual   BOOLEAN DEFAULT false,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
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
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id      UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  type         TEXT NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'notice')),
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description  TEXT,
  due_date     DATE,
  priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  done_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMPLOYEE DOCUMENTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('nomina', 'contrato', 'certificado', 'otro')),
  title         TEXT NOT NULL,
  period        TEXT,
  file_url      TEXT NOT NULL,
  file_size     BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ─── CHAT EFÍMERO (ephemeral_messages) ────────────────────────
CREATE TABLE IF NOT EXISTS public.ephemeral_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT no_self_message CHECK (sender_id <> receiver_id)
);

-- ─── ÍNDICES (rendimiento) ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_entries_user_occurred ON public.time_entries(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_company ON public.time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_shifts_company_date ON public.shifts(company_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON public.shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_company ON public.absences(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_employee_documents_company ON public.employee_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_ephemeral_receiver ON public.ephemeral_messages (receiver_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ephemeral_sender ON public.ephemeral_messages (sender_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ephemeral_conversation ON public.ephemeral_messages (company_id, sender_id, receiver_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ephemeral_expires ON public.ephemeral_messages (expires_at) WHERE read_at IS NULL;

-- ─── VISTA PRESENCIA DE COMPAÑEROS ────────────────────────────
CREATE OR REPLACE VIEW public.coworker_presence AS
SELECT
  cm.company_id,
  cm.user_id,
  p.full_name,
  p.avatar AS avatar_url,
  COALESCE(
    (
      SELECT te.entry_type
      FROM public.time_entries te
      WHERE te.user_id = cm.user_id
      ORDER BY COALESCE(te.occurred_at, te.created_at) DESC
      LIMIT 1
    ),
    'clock-out'
  ) AS last_entry_type,
  (
    SELECT COALESCE(te.occurred_at, te.created_at)
    FROM public.time_entries te
    WHERE te.user_id = cm.user_id
    ORDER BY COALESCE(te.occurred_at, te.created_at) DESC
    LIMIT 1
  ) AS last_entry_at
FROM public.company_members cm
JOIN public.profiles p ON p.id = cm.user_id
WHERE cm.accepted = true;

-- ─── REALTIME (para notificaciones en vivo) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'time_entries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'absences') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.absences;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ephemeral_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ephemeral_messages;
  END IF;
END $$;

-- ─── STORAGE (para documentos de ausencias y nóminas) ─────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('Documents', 'Documents', true),
  ('employee_documents', 'employee_documents', false)
ON CONFLICT (id) DO NOTHING;

-- ─── FIN ─────────────────────────────────────────────────────
-- Ahora ejecuta en orden: 01, 02, 03, 04, 05


