-- ================================================================
-- FYCHEO DEMO — SCRIPT ÚNICO COMPLETO (Edición 2026)
-- Distribuciones Martínez S.A.
-- ================================================================
-- INSTRUCCIONES:
-- 1. Ve a Authentication > Users y crea estos 3 usuarios primero:
--    - demo.admin@fycheo-demo.com    / FycheoDemo2024!
--    - demo.manager@fycheo-demo.com  / FycheoDemo2024!
--    - demo.rrhh@fycheo-demo.com     / FycheoDemo2024!
--    - (Asegúrate de marcar "Auto Confirm User")
-- 2. Ejecuta este script completo en el SQL Editor (Run without RLS)
-- 3. Al finalizar verás el COMPANY_ID en los resultados
-- ================================================================

-- ── LIMPIEZA INICIAL ─────────────────────────────────────────────
DROP TABLE IF EXISTS public.employee_documents, public.tasks, public.notifications, public.activity_logs, public.company_holidays, public.absences, public.time_entries, public.shifts, public.company_members, public.teams, public.companies, public.profiles, public.ephemeral_messages CASCADE;

-- ── TABLAS ──────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  TEXT,
  name       TEXT,
  email      TEXT,
  avatar     TEXT,
  phone      TEXT,
  dni_nie    TEXT,
  ss_number  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  owner_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan            TEXT DEFAULT 'pro',
  logo_url        TEXT,
  settings        JSONB DEFAULT '{}'::jsonb,
  kiosk_device_id TEXT,
  kiosk_pin       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.company_members (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'employee',
  team_id      UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  accepted     BOOLEAN DEFAULT TRUE,
  weekly_hours NUMERIC DEFAULT 40,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE public.shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  notes        TEXT,
  status       TEXT DEFAULT 'completed',
  color        TEXT,
  overtime     NUMERIC,
  is_published BOOLEAN DEFAULT TRUE,
  updated_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.time_entries (
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

CREATE TABLE public.absences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  end_date     DATE,
  type         TEXT NOT NULL,
  status       TEXT DEFAULT 'pending',
  reason       TEXT,
  document_url TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.company_holidays (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  date       DATE NOT NULL,
  type       TEXT DEFAULT 'closed',
  start_time TEXT,
  end_time   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  manager_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tasks (
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

CREATE TABLE public.employee_documents (
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

CREATE TABLE public.ephemeral_messages (
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

-- Índices
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_company ON public.time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_shifts_company_date ON public.shifts(company_id, date);
CREATE INDEX IF NOT EXISTS idx_absences_company ON public.absences(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_company ON public.employee_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_ephemeral_receiver ON public.ephemeral_messages (receiver_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ephemeral_sender ON public.ephemeral_messages (sender_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ephemeral_conversation ON public.ephemeral_messages (company_id, sender_id, receiver_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ephemeral_expires ON public.ephemeral_messages (expires_at) WHERE read_at IS NULL;

-- Realtime
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

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('Documents', 'Documents', true),
  ('employee_documents', 'employee_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Trigger para nuevos usuarios Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, created_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── DATOS DEMO (Sección DO $$) ───────────────────────────────────

DO $$
DECLARE
  -- IDs principales
  company_uuid   UUID := gen_random_uuid();
  admin_id       UUID;
  manager_id     UUID;
  rrhh_id        UUID;
  emp_demo_id    UUID;

  -- Equipos
  team_rep  UUID := gen_random_uuid();
  team_alm  UUID := gen_random_uuid();
  team_ofic UUID := gen_random_uuid();
  team_dir  UUID := gen_random_uuid();

  -- Empleados (15 base)
  e UUID[];

  -- Variables para generación de turnos/fichajes
  emp        UUID;
  emp_email  TEXT;
  emp_name   TEXT;
  d          DATE;
  dow        INT;
  is_holiday BOOLEAN;
  is_on_leave BOOLEAN;

  -- Variables de turnos
  sh_color   TEXT;
  sh_start   TEXT;
  sh_end     TEXT;
  sh_status  TEXT;
  ci_h INT; co_h INT; br_s_h INT; br_e_h INT;
  ci_m INT; co_m INT; br_s_m INT; br_e_m INT;
  t_ci TIMESTAMPTZ; t_co TIMESTAMPTZ; t_bs TIMESTAMPTZ; t_be TIMESTAMPTZ;

  -- Control de rotación
  emp_idx INT;
  week_index INT;
  shift_index INT;

  i INT;

BEGIN
  -- Obtener IDs de usuarios Auth creados previamente
  SELECT id INTO admin_id   FROM auth.users WHERE email = 'demo.admin@fycheo-demo.com'   LIMIT 1;
  SELECT id INTO manager_id FROM auth.users WHERE email = 'demo.manager@fycheo-demo.com' LIMIT 1;
  SELECT id INTO rrhh_id    FROM auth.users WHERE email = 'demo.rrhh@fycheo-demo.com'    LIMIT 1;
  SELECT id INTO emp_demo_id FROM auth.users WHERE email = 'empleado.demo@fycheo-demo.com' LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No encontré demo.admin@fycheo-demo.com en Auth. Créalo primero en Authentication > Users.';
  END IF;

  -- Asignar array de empleados (Pedro Jiménez usa el ID de Auth si existe)
  e := ARRAY[
    COALESCE(emp_demo_id, gen_random_uuid()), -- 1: Pedro Jiménez (empleado.demo@fycheo-demo.com)
    gen_random_uuid(), -- 2: Sofía Morales
    gen_random_uuid(), -- 3: Javier Romero
    gen_random_uuid(), -- 4: Laura García
    gen_random_uuid(), -- 5: David Torres
    gen_random_uuid(), -- 6: Carmen Blanco
    gen_random_uuid(), -- 7: Roberto Méndez
    gen_random_uuid(), -- 8: Patricia Herrero
    gen_random_uuid(), -- 9: Antonio Ramos
    gen_random_uuid(), -- 10: Isabel Fuentes
    gen_random_uuid(), -- 11: Lucía Castillo
    gen_random_uuid(), -- 12: Jorge Domínguez
    gen_random_uuid(), -- 13: Marta Ibáñez
    gen_random_uuid(), -- 14: Raúl Guerrero
    gen_random_uuid()  -- 15: Beatriz Aguilar
  ];

  -- ── Perfiles de usuarios admin/gestores ────────────────────────
  INSERT INTO public.profiles (id, full_name, name, email, avatar, phone, dni_nie, ss_number, created_at) VALUES
    (admin_id,   'Carlos Martínez García', 'Carlos',  'demo.admin@fycheo-demo.com',   'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', '+34 666 100 001', '12345678A', '28/000/01', NOW() - INTERVAL '14 months'),
    (manager_id, 'Ana López Fernández',    'Ana',     'demo.manager@fycheo-demo.com', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face', '+34 677 100 002', '23456789B', '28/000/02', NOW() - INTERVAL '14 months'),
    (rrhh_id,    'Miguel Sánchez Torres',  'Miguel',  'demo.rrhh@fycheo-demo.com',    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face', '+34 688 100 003', '34567890C', '28/000/03', NOW() - INTERVAL '14 months')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, name = EXCLUDED.name, avatar = EXCLUDED.avatar, phone = EXCLUDED.phone, dni_nie = EXCLUDED.dni_nie;

  -- ── Empresa ───────────────────────────────────────────────────
  INSERT INTO public.companies (id, name, owner_id, plan, settings, created_at) VALUES (
    company_uuid, 'Distribuciones Martínez S.A.', admin_id, 'pro',
    '{
      "schedule": {
        "monday":    {"active":true,  "start":"08:00","end":"17:00"},
        "tuesday":   {"active":true,  "start":"08:00","end":"17:00"},
        "wednesday": {"active":true,  "start":"08:00","end":"17:00"},
        "thursday":  {"active":true,  "start":"08:00","end":"17:00"},
        "friday":    {"active":true,  "start":"08:00","end":"15:00"},
        "saturday":  {"active":false, "start":"09:00","end":"13:00"},
        "sunday":    {"active":false, "start":"09:00","end":"13:00"}
      },
      "general": {"tolerance":"15","timezone":"Europe/Madrid"},
      "shift_types": [
        {"name":"Mañana",           "color":"#3b82f6","start":"06:00","end":"14:00"},
        {"name":"Tarde",            "color":"#f59e0b","start":"14:00","end":"22:00"},
        {"name":"Jornada Completa", "color":"#10b981","start":"08:00","end":"17:00"}
      ],
      "leave_policies": [
        {"id":"vacation","name":"Vacaciones",         "color":"emerald","hex":"#10b981","limitUnit":"days","limitPeriod":"year","maxAmount":23,"minAmount":1,"isPaid":true},
        {"id":"sick",    "name":"Baja Médica",        "color":"red",    "hex":"#ef4444","limitUnit":"days","limitPeriod":"year","maxAmount":365,"minAmount":1,"isPaid":true},
        {"id":"personal","name":"Asuntos Propios",    "color":"blue",   "hex":"#3b82f6","limitUnit":"days","limitPeriod":"year","maxAmount":5,  "minAmount":1,"isPaid":true}
      ]
    }'::jsonb,
    NOW() - INTERVAL '14 months'
  );

  -- ── Equipos ───────────────────────────────────────────────────
  INSERT INTO public.teams (id, company_id, name, description, created_at) VALUES
    (team_rep,  company_uuid, 'Repartidores',  'Equipo de reparto y entrega a clientes',       NOW() - INTERVAL '13 months'),
    (team_alm,  company_uuid, 'Almacén',       'Personal de almacén y logística',               NOW() - INTERVAL '13 months'),
    (team_ofic, company_uuid, 'Oficina',       'Personal de soporte, oficina y contabilidad',   NOW() - INTERVAL '13 months'),
    (team_dir,  company_uuid, 'Dirección',     'Equipo de administración y dirección general',  NOW() - INTERVAL '13 months');

  -- ── Vincular admins a la empresa ──────────────────────────────
  INSERT INTO public.company_members (user_id, company_id, role, team_id, accepted, weekly_hours) VALUES
    (admin_id,   company_uuid, 'admin',   team_dir, true, 40),
    (manager_id, company_uuid, 'manager', team_dir, true, 40),
    (rrhh_id,    company_uuid, 'hr',      team_dir, true, 37.5);

  -- ── Perfiles empleados ficticios ─────────────────────────────
  INSERT INTO public.profiles (id, full_name, name, email, avatar, phone, dni_nie, ss_number, created_at) VALUES
    -- Repartidores (5)
    (e[1],  'Pedro Jiménez Ruiz',       'Pedro',    'empleado.demo@fycheo-demo.com',   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face', '+34 611 001 001','45678901D','28/001/01', NOW()-INTERVAL '12 months'),
    (e[2],  'Sofía Morales Vega',       'Sofía',    'sofia.morales@martinez-sa.com',   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face', '+34 622 002 002','56789012E','28/002/02', NOW()-INTERVAL '11 months'),
    (e[3],  'Javier Romero Castro',     'Javier',   'javier.romero@martinez-sa.com',   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', '+34 633 003 003','67890123F','28/003/03', NOW()-INTERVAL '10 months'),
    (e[4],  'Laura García Ruiz',        'Laura',    'laura.garcia@martinez-sa.com',    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face', '+34 644 004 004','78901234G','28/004/04', NOW()-INTERVAL '9 months'),
    (e[5],  'David Torres Ortiz',       'David',    'david.torres@martinez-sa.com',    'https://images.unsplash.com/photo-1500048993953-d23a436266cf?w=150&h=150&fit=crop&crop=face', '+34 655 005 005','89012345H','28/005/05', NOW()-INTERVAL '8 months'),
    
    -- Almacén (5)
    (e[6],  'Carmen Blanco Ortega',     'Carmen',   'carmen.blanco@martinez-sa.com',   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face', '+34 688 008 008','12345679L','28/006/06', NOW()-INTERVAL '13 months'),
    (e[7],  'Roberto Méndez Gil',       'Roberto',  'roberto.mendez@martinez-sa.com',  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face', '+34 699 009 009','23456780M','28/007/07', NOW()-INTERVAL '12 months'),
    (e[8],  'Patricia Herrero Cano',    'Patricia', 'patricia.herrero@martinez-sa.com','https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face', '+34 600 010 010','34567891N','28/008/08', NOW()-INTERVAL '6 months'),
    (e[9],  'Antonio Ramos Silva',      'Antonio',  'antonio.ramos@martinez-sa.com',   'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=face', '+34 611 011 011','45678912P','28/009/09', NOW()-INTERVAL '5 months'),
    (e[10], 'Isabel Fuentes Sanz',      'Isabel',   'isabel.fuentes@martinez-sa.com',  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face', '+34 622 012 012','56789023Q','28/010/10', NOW()-INTERVAL '4 months'),
    
    -- Oficina (5)
    (e[11], 'Lucía Castillo Prieto',    'Lucía',    'lucia.castillo@martinez-sa.com',  'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=150&h=150&fit=crop&crop=face', '+34 644 014 014','78901235S','28/011/11', NOW()-INTERVAL '13 months'),
    (e[12], 'Jorge Domínguez Rubio',    'Jorge',    'jorge.dominguez@martinez-sa.com', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=face', '+34 655 015 015','89012346T','28/012/12', NOW()-INTERVAL '8 months'),
    (e[13], 'Marta Ibáñez Soler',       'Marta',    'marta.ibanez@martinez-sa.com',    'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&h=150&fit=crop&crop=face', '+34 666 016 016','90123456U','28/013/13', NOW()-INTERVAL '7 months'),
    (e[14], 'Raúl Guerrero Menéndez',   'Raúl',     'raul.guerrero@martinez-sa.com',   'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face', '+34 677 017 017','01234567V','28/014/14', NOW()-INTERVAL '6 months'),
    (e[15], 'Beatriz Aguilar Medina',   'Beatriz',  'beatriz.aguilar@martinez-sa.com', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150&h=150&fit=crop&crop=face', '+34 688 018 018','12345680X','28/015/15', NOW()-INTERVAL '13 months');

  -- ── Vincular empleados a la empresa ──────────────────────────
  -- weekly_hours: Repartidores y Almacén 40h (convenio transporte), Oficina 37.5h
  INSERT INTO public.company_members (user_id, company_id, role, team_id, accepted, weekly_hours) VALUES
    -- Repartidores (40h/semana — convenio de transporte)
    (e[1], company_uuid, 'employee', team_rep, true, 40),
    (e[2], company_uuid, 'employee', team_rep, true, 40),
    (e[3], company_uuid, 'employee', team_rep, true, 40),
    (e[4], company_uuid, 'employee', team_rep, true, 40),
    (e[5], company_uuid, 'employee', team_rep, true, 40),
    -- Almacén (40h/semana)
    (e[6], company_uuid, 'employee', team_alm, true, 40),
    (e[7], company_uuid, 'employee', team_alm, true, 40),
    (e[8], company_uuid, 'employee', team_alm, true, 40),
    (e[9], company_uuid, 'employee', team_alm, true, 40),
    (e[10],company_uuid, 'employee', team_alm, true, 40),
    -- Oficina (37.5h/semana — jornada intensiva viernes)
    (e[11],company_uuid, 'employee', team_ofic, true, 37.5),
    (e[12],company_uuid, 'employee', team_ofic, true, 37.5),
    (e[13],company_uuid, 'employee', team_ofic, true, 37.5),
    (e[14],company_uuid, 'employee', team_ofic, true, 37.5),
    (e[15],company_uuid, 'employee', team_ofic, true, 37.5);

  -- ── Festivos (Año 2026) ──────────────────────────────────────
  INSERT INTO public.company_holidays (company_id, name, date, type) VALUES
    (company_uuid, 'Año Nuevo',            '2026-01-01', 'closed'),
    (company_uuid, 'Reyes Magos',          '2026-01-06', 'closed'),
    (company_uuid, 'Jueves Santo',         '2026-04-02', 'closed'),
    (company_uuid, 'Viernes Santo',        '2026-04-03', 'closed'),
    (company_uuid, 'Día del Trabajador',   '2026-05-01', 'closed'),
    (company_uuid, 'Asunción',             '2026-08-15', 'closed'),
    (company_uuid, 'Fiesta Nacional',      '2026-10-12', 'closed'),
    (company_uuid, 'Todos los Santos',     '2026-11-01', 'closed'),
    (company_uuid, 'Constitución',         '2026-12-06', 'closed'),
    (company_uuid, 'Inmaculada',           '2026-12-08', 'closed'),
    (company_uuid, 'Navidad',              '2026-12-25', 'closed');

  -- ── Turnos y fichajes para todo 2026 ──────────────────────────
  emp_idx := 0;
  FOREACH emp IN ARRAY e LOOP
    emp_idx := emp_idx + 1;
    
    SELECT p.email, p.full_name INTO emp_email, emp_name
    FROM public.profiles p
    WHERE p.id = emp;

    d := '2026-01-01'::DATE;

    WHILE d <= '2026-12-31'::DATE LOOP
      dow := EXTRACT(DOW FROM d);

      IF dow BETWEEN 1 AND 5 THEN
        -- Comprobar festivo
        SELECT EXISTS (
          SELECT 1 FROM public.company_holidays 
          WHERE company_id = company_uuid AND date = d
        ) INTO is_holiday;

        -- Comprobar ausencias programadas
        is_on_leave := false;
        
        -- Vacaciones de verano para todos (13 al 26 de julio de 2026)
        IF d BETWEEN '2026-07-13'::DATE AND '2026-07-26'::DATE THEN
          is_on_leave := true;
        END IF;

        -- Vacaciones de Navidad para Pedro y Lucía (24 al 31 de diciembre)
        IF (emp = e[1] OR emp = e[11]) AND (d BETWEEN '2026-12-24'::DATE AND '2026-12-31'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- Baja médica de Carmen Blanco (1 al 10 de junio)
        IF emp = e[6] AND (d BETWEEN '2026-06-01'::DATE AND '2026-06-10'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- Baja médica de Sofía Morales (4 al 8 de junio)
        IF emp = e[2] AND (d BETWEEN '2026-06-04'::DATE AND '2026-06-08'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- Baja médica de Pedro Jiménez (9 al 13 de febrero)
        IF emp = e[1] AND (d BETWEEN '2026-02-09'::DATE AND '2026-02-13'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- Calcular turno rotativo semanal
        week_index := EXTRACT(WEEK FROM d)::int;
        shift_index := (week_index + emp_idx) % 3;

        IF shift_index = 0 THEN
          sh_color := '#3b82f6'; sh_start := '06:00'; sh_end := '14:00';
          ci_h := 6; co_h := 14; br_s_h := 10; br_e_h := 10;
          ci_m := 0; co_m := 0; br_s_m := 0; br_e_m := 30;
        ELSIF shift_index = 1 THEN
          sh_color := '#f59e0b'; sh_start := '14:00'; sh_end := '22:00';
          ci_h := 14; co_h := 22; br_s_h := 18; br_e_h := 18;
          ci_m := 0; co_m := 0; br_s_m := 0; br_e_m := 30;
        ELSE
          sh_color := '#10b981'; sh_start := '08:00'; sh_end := '17:00';
          ci_h := 8; co_h := 17; br_s_h := 13; br_e_h := 14;
          ci_m := 0; co_m := 0; br_s_m := 0; br_e_m := 0;
        END IF;

        -- Determinar estado del turno
        IF is_holiday OR is_on_leave THEN
          sh_status := 'absent';
        ELSIF d < '2026-06-04'::DATE THEN
          sh_status := 'completed';
        ELSE
          sh_status := 'scheduled';
        END IF;

        -- Insertar turno
        INSERT INTO public.shifts (employee_id, company_id, date, start_time, end_time, color, status, is_published)
        VALUES (emp, company_uuid, d, sh_start, sh_end, sh_color, sh_status, true);

        -- Generar fichajes en el pasado / hoy
        IF NOT is_holiday AND NOT is_on_leave THEN
          IF d < '2026-06-04'::DATE THEN
            t_ci := (d::TEXT || ' ' || LPAD(ci_h::TEXT, 2, '0') || ':00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 21 - 10)::int || ' minutes')::INTERVAL;
            t_bs := (d::TEXT || ' ' || LPAD(br_s_h::TEXT, 2, '0') || ':00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 15)::int || ' minutes')::INTERVAL;
            t_be := t_bs + (br_e_h - br_s_h || ' hours')::INTERVAL + (br_e_m - br_s_m || ' minutes')::INTERVAL + (floor(random() * 6 - 3)::int || ' minutes')::INTERVAL;
            t_co := (d::TEXT || ' ' || LPAD(co_h::TEXT, 2, '0') || ':00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 21 - 10)::int || ' minutes')::INTERVAL;

            INSERT INTO public.time_entries (user_id, company_id, entry_type, occurred_at, status, description, date, entry_time, minutes, is_manual) VALUES
              (emp, company_uuid, 'clock-in',    t_ci, 'approved', 'Entrada',         d, to_char(t_ci, 'HH24:MI'), 0, false),
              (emp, company_uuid, 'break-start', t_bs, 'approved', 'Inicio descanso', d, to_char(t_bs, 'HH24:MI'), 0, false),
              (emp, company_uuid, 'break-end',   t_be, 'approved', 'Fin descanso',    d, to_char(t_be, 'HH24:MI'), 0, false),
              (emp, company_uuid, 'clock-out',   t_co, 'approved', 'Salida',          d, to_char(t_co, 'HH24:MI'), (EXTRACT(EPOCH FROM (t_co - t_ci))/60 - EXTRACT(EPOCH FROM (t_be - t_bs))/60)::integer, false);
          ELSIF d = '2026-06-04'::DATE THEN
            -- Fichajes de hoy
            IF shift_index = 0 THEN
              t_ci := (d::TEXT || ' 06:00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 11 - 5)::int || ' minutes')::INTERVAL;
              t_bs := (d::TEXT || ' 10:00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 10)::int || ' minutes')::INTERVAL;
              t_be := t_bs + '30 minutes'::INTERVAL + (floor(random() * 4 - 2)::int || ' minutes')::INTERVAL;

              INSERT INTO public.time_entries (user_id, company_id, entry_type, occurred_at, status, description, date, entry_time, minutes, is_manual) VALUES
                (emp, company_uuid, 'clock-in',    t_ci, 'approved', 'Entrada',         d, to_char(t_ci, 'HH24:MI'), 0, false),
                (emp, company_uuid, 'break-start', t_bs, 'approved', 'Inicio descanso', d, to_char(t_bs, 'HH24:MI'), 0, false),
                (emp, company_uuid, 'break-end',   t_be, 'approved', 'Fin descanso',    d, to_char(t_be, 'HH24:MI'), 0, false);
            ELSIF shift_index = 2 THEN
              t_ci := (d::TEXT || ' 08:00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 11 - 5)::int || ' minutes')::INTERVAL;

              INSERT INTO public.time_entries (user_id, company_id, entry_type, occurred_at, status, description, date, entry_time, minutes, is_manual) VALUES
                (emp, company_uuid, 'clock-in',    t_ci, 'approved', 'Entrada',         d, to_char(t_ci, 'HH24:MI'), 0, false);
            END IF;
          END IF;
        END IF;

      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  -- ── Ausencias en public.absences ───────────────────────────────
  -- Vacaciones de verano para todos
  FOR i IN 1..15 LOOP
    INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
    VALUES (e[i], company_uuid, '2026-07-13', '2026-07-26', 'Vacaciones', 'approved', 'Vacaciones de verano', '2026-05-15'::TIMESTAMP);
  END LOOP;

  -- Vacaciones de Navidad para Pedro y Lucía
  INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at) VALUES
    (e[1],  company_uuid, '2026-12-24', '2026-12-31', 'Vacaciones', 'approved', 'Vacaciones de Navidad', '2026-10-15'::TIMESTAMP),
    (e[11], company_uuid, '2026-12-24', '2026-12-31', 'Vacaciones', 'approved', 'Vacaciones de Navidad', '2026-10-15'::TIMESTAMP);

  -- Bajas médicas (Carmen Blanco activa hoy, Sofía Morales activa hoy, Pedro Jiménez pasada en febrero)
  INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at) VALUES
    (e[6], company_uuid, '2026-06-01', '2026-06-10', 'Baja Médica', 'approved', 'Esguince de tobillo', '2026-06-01'::TIMESTAMP),
    (e[2], company_uuid, '2026-06-04', '2026-06-08', 'Baja Médica', 'approved', 'Gastroenteritis aguda', '2026-06-04'::TIMESTAMP),
    (e[1], company_uuid, '2026-02-09', '2026-02-13', 'Baja Médica', 'approved', 'Gripe común', '2026-02-09'::TIMESTAMP);

  -- Solicitudes pendientes de vacaciones y asuntos propios
  INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at) VALUES
    (e[9], company_uuid, '2026-09-07', '2026-09-14', 'Vacaciones', 'pending', 'Viaje familiar retrasado', '2026-06-02'::TIMESTAMP),
    (e[8], company_uuid, '2026-06-18', '2026-06-19', 'Asuntos Propios', 'pending', 'Trámites notariales', '2026-06-02'::TIMESTAMP),
    (e[12], company_uuid, '2026-05-12', '2026-05-13', 'Asuntos Propios', 'approved', 'Mudanza de domicilio', '2026-05-02'::TIMESTAMP);


  -- ── Nóminas y Contratos en public.employee_documents ───────────
  FOREACH emp IN ARRAY e LOOP
    -- Contrato Laboral Indefinido
    INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at)
    VALUES (company_uuid, emp, 'contrato', 'Contrato de Trabajo Indefinido', NULL, company_uuid::TEXT || '/' || emp::TEXT || '/contrato/contrato_firmado.pdf', 142350, '2026-01-02'::TIMESTAMP);

    -- Certificado de Retenciones IRPF 2025
    INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at)
    VALUES (company_uuid, emp, 'certificado', 'Certificado de Retenciones IRPF 2025', NULL, company_uuid::TEXT || '/' || emp::TEXT || '/certificado/retenciones_2025.pdf', 230410, '2026-02-15'::TIMESTAMP);

    -- Nóminas de Enero a Mayo de 2026
    INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at) VALUES
      (company_uuid, emp, 'nomina', 'Nómina Enero 2026',    '2026-01', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_01.pdf', 85200, '2026-01-31'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Febrero 2026',  '2026-02', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_02.pdf', 85200, '2026-02-28'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Marzo 2026',    '2026-03', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_03.pdf', 85200, '2026-03-31'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Abril 2026',    '2026-04', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_04.pdf', 85200, '2026-04-30'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Mayo 2026',     '2026-05', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_05.pdf', 85200, '2026-05-31'::TIMESTAMP);
  END LOOP;

  -- ── Documentos extra para Pedro Jiménez (empleado.demo) ────────
  INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at)
  VALUES (company_uuid, e[1], 'otro', 'Certificado Oficial de No Llegar Tarde (Casi Nunca)', NULL, company_uuid::TEXT || '/' || e[1]::TEXT || '/otro/certificado_puntualidad_jaja.pdf', 64200, '2026-03-01'::TIMESTAMP);

  INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at)
  VALUES (company_uuid, e[1], 'otro', 'Carta del Jefe: Felicitación por No Romper Nada en Febrero', NULL, company_uuid::TEXT || '/' || e[1]::TEXT || '/otro/carta_felicitacion_febrero.pdf', 41800, '2026-03-05'::TIMESTAMP);

  INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at)
  VALUES (company_uuid, e[1], 'nomina', 'Nómina Junio 2026 (Preview, No Vale pa Nada)', '2026-06', company_uuid::TEXT || '/' || e[1]::TEXT || '/nomina/nomina_2026_06_preview.pdf', 85200, '2026-06-01'::TIMESTAMP);


  -- ── Tareas y Avisos en public.tasks ────────────────────────────
  FOREACH emp IN ARRAY e LOOP
    -- Tarea realizada en el pasado
    INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, done_at, created_at)
    VALUES (company_uuid, admin_id, emp, 'task', 'Lectura de Normativa Interna v2026', 'Leer y aceptar las nuevas directrices de la política interna de la empresa.', '2026-01-15'::DATE, 'low', 'done', '2026-01-14 11:30:00 Europe/Madrid'::TIMESTAMPTZ, '2026-01-05'::TIMESTAMP);

    -- Aviso general
    INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
    VALUES (company_uuid, admin_id, emp, 'notice', 'Nueva normativa de Seguridad Vial', 'Es obligatorio leer y firmar el nuevo protocolo de conducción segura publicado por RRHH.', NULL, 'normal', 'pending', '2026-06-02'::TIMESTAMP);
  END LOOP;

  -- Tareas individuales pendientes
  INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at) VALUES
    (company_uuid, admin_id, e[1], 'task', 'Completar curso de PRL', 'Realizar la formación online de Prevención de Riesgos Laborales antes de la fecha límite.', '2026-06-15'::DATE, 'high', 'pending', '2026-06-01'::TIMESTAMP),
    (company_uuid, admin_id, e[1], 'task', 'Revisar tacógrafo de la furgoneta', 'Extraer y revisar los registros de conducción de la furgoneta de reparto principal.', '2026-06-08'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP),
    (company_uuid, admin_id, e[2], 'task', 'Revisión técnica de la furgoneta', 'Llevar la furgoneta de reparto al taller asignado para la revisión semestral.', '2026-06-12'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP),
    (company_uuid, admin_id, e[3], 'task', 'Entregar albaranes firmados', 'Escanear y depositar en administración todos los albaranes firmados del mes de mayo.', '2026-06-10'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP),
    (company_uuid, admin_id, e[6], 'task', 'Organizar estantería de palets A', 'Al regresar de la baja médica, organizar y etiquetar la estantería del sector de palets A.', '2026-06-25'::DATE, 'low', 'pending', '2026-06-01'::TIMESTAMP),
    (company_uuid, admin_id, e[7], 'task', 'Inventario mensual del pasillo 4', 'Realizar el recuento total del stock del pasillo 4 del almacén central.', '2026-06-15'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP),
    (company_uuid, admin_id, e[8], 'task', 'Preparar pedido cliente #8890', 'Preparar el pedido especial y coordinar con reparto urgente.', '2026-06-05'::DATE, 'high', 'pending', '2026-06-03'::TIMESTAMP),
    (company_uuid, admin_id, e[11], 'task', 'Cierre contable provisional', 'Preparar y consolidar el informe provisional de gastos de mayo.', '2026-06-10'::DATE, 'high', 'pending', '2026-06-02'::TIMESTAMP);

  -- Avisos extra para Pedro (con todo el cariño del mundo, oye)
  INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at) VALUES
    (company_uuid, admin_id, e[1], 'notice', '¡Enhorabuena! Llevas 6 meses sin multas de tráfico', 'Es oficial: eres el repartidor con el historial más limpio del equipo. Carlos dice que hay una caja de galletas esperándote en recepción (las de chocolate, no las de limón).', NULL, 'low', 'pending', '2026-06-01'::TIMESTAMP),
    (company_uuid, manager_id, e[1], 'notice', 'Recordatorio: La furgoneta no es tu coche personal', 'Pedro, cariño, por favor para de ajustar el asiento del conductor cada vez que te montas. El resto del equipo tiene piernas. Ana.', NULL, 'normal', 'pending', '2026-05-20'::TIMESTAMP),
    (company_uuid, admin_id, e[1], 'notice', 'Acuerdo Salarial 2026 firmado — ¡Toca revisión!', 'El convenio colectivo ha sido renovado. Revisa el documento adjunto en tu ficha y, si tienes dudas, habla con RRHH antes de preguntar en el grupo de WhatsApp.', NULL, 'high', 'pending', '2026-06-03'::TIMESTAMP);

  -- Una tarea ya hecha (bonus) para Pedro
  INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, done_at, created_at)
  VALUES (company_uuid, manager_id, e[1], 'task', 'Entregar hoja de gastos de mayo', 'Completar y entregar el formulario G-22 con todos los recibos de gasoil de mayo.', '2026-06-01'::DATE, 'normal', 'done', '2026-05-30 16:45:00 Europe/Madrid'::TIMESTAMPTZ, '2026-05-28'::TIMESTAMP);


  -- ── Mensajes de chat en public.ephemeral_messages ─────────────
  INSERT INTO public.ephemeral_messages (company_id, sender_id, receiver_id, content, sent_at, expires_at) VALUES
    (company_uuid, manager_id, e[1], 'Hola Pedro, ¿cómo vas con la entrega del pedido especial?', NOW() - INTERVAL '4 hours', NOW() + INTERVAL '20 hours'),
    (company_uuid, e[1], manager_id, 'Hola Ana, ya está cargado en la furgoneta. Salgo ahora mismo a entregarlo.', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '20 hours'),
    (company_uuid, manager_id, e[1], 'Perfecto, avísame en cuanto esté entregado y firmado.', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '20 hours'),
    (company_uuid, e[1], manager_id, '¡Entregado! El cliente ha quedado muy contento.', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '20 hours'),
    (company_uuid, manager_id, e[1], 'Excelente trabajo, muchas gracias.', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '20 hours'),
    (company_uuid, admin_id, e[1], 'Hola Pedro, ¿puedes revisar el tacógrafo de la furgoneta al terminar el turno?', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '20 hours'),
    (company_uuid, e[1], admin_id, 'Sí, Carlos. En cuanto vuelva a la oficina extraigo los datos y te los dejo en la mesa.', NOW() - INTERVAL '45 minutes', NOW() + INTERVAL '20 hours');


  -- ── Logs de Actividad ──────────────────────────────────────────
  INSERT INTO public.activity_logs (company_id, manager_id, action_type, description, metadata, created_at) VALUES
    (company_uuid, admin_id, 'company_created', 'Empresa "Distribuciones Martínez S.A." creada', '{"plan": "pro"}'::jsonb, '2025-04-15 09:00:00'::TIMESTAMP),
    (company_uuid, admin_id, 'team_created', 'Creado equipo "Repartidores"', '{"team_name": "Repartidores"}'::jsonb, '2025-05-02 10:30:00'::TIMESTAMP),
    (company_uuid, admin_id, 'team_created', 'Creado equipo "Almacén"', '{"team_name": "Almacén"}'::jsonb, '2025-05-02 10:35:00'::TIMESTAMP),
    (company_uuid, admin_id, 'team_created', 'Creado equipo "Oficina"', '{"team_name": "Oficina"}'::jsonb, '2025-05-02 10:40:00'::TIMESTAMP),
    (company_uuid, admin_id, 'employee_added', 'Añadido empleado Pedro Jiménez Ruiz al equipo Repartidores', '{"employee_email": "empleado.demo@fycheo-demo.com"}'::jsonb, '2025-06-01'::TIMESTAMP),
    (company_uuid, admin_id, 'absence_approved', 'Aprobó vacaciones de verano generales para la plantilla', '{"days": 14}'::jsonb, '2026-05-15 14:00:00'::TIMESTAMP),
    (company_uuid, admin_id, 'shift_published', 'Publicó turnos de junio de 2026', '{"publishedCount": 330}'::jsonb, '2026-05-28 17:30:00'::TIMESTAMP);

  IF manager_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (company_id, manager_id, action_type, description, metadata, created_at) VALUES
      (company_uuid, manager_id, 'absence_approved', 'Aprobó baja médica de Carmen Blanco Ortega', '{"employee": "Carmen Blanco"}'::jsonb, '2026-06-01'::TIMESTAMP),
      (company_uuid, manager_id, 'task_created', 'Asignó tarea de PRL a Pedro Jiménez', '{"employee": "Pedro Jiménez"}'::jsonb, '2026-06-01'::TIMESTAMP);
  END IF;

  -- ── RESULTADO ────────────────────────────────────────────────
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'DEMO CREADA CORRECTAMENTE CON 10 EMPLEADOS Y DATOS DE 2026';
  RAISE NOTICE 'COMPANY_ID = %', company_uuid;
  RAISE NOTICE 'Copia este ID en tu archivo .env como VITE_DEMO_COMPANY_ID';
  RAISE NOTICE '====================================================';
END $$;
