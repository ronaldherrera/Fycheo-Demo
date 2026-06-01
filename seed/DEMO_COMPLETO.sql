-- ================================================================
-- FYCHEO DEMO — SCRIPT ÚNICO COMPLETO
-- Distribuciones Martínez S.A.
-- ================================================================
-- INSTRUCCIONES:
-- 1. Ve a Authentication > Users y crea estos 3 usuarios primero:
--    - demo.admin@fycheo-demo.com    / FycheoDemo2024!
--    - demo.manager@fycheo-demo.com  / FycheoDemo2024!
--    - demo.rrhh@fycheo-demo.com     / FycheoDemo2024!
-- 2. Ejecuta este script en SQL Editor (Run without RLS)
-- 3. Al finalizar verás el COMPANY_ID en los resultados
-- ================================================================

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
  owner_id        UUID,
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
  user_id    UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'employee',
  team_id    UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  accepted   BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE public.shifts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL,
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
  user_id     UUID NOT NULL,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_type  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT DEFAULT 'approved',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.absences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL,
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
  manager_id  UUID,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'pending',
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id, occurred_at);
CREATE INDEX idx_time_entries_company ON public.time_entries(company_id);
CREATE INDEX idx_shifts_company_date ON public.shifts(company_id, date);
CREATE INDEX idx_absences_company ON public.absences(company_id);
CREATE INDEX idx_company_members_company ON public.company_members(company_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.absences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('Documents', 'Documents', true)
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

-- ── DATOS DEMO ──────────────────────────────────────────────────

DO $$
DECLARE
  -- IDs principales
  company_id     UUID := gen_random_uuid();
  admin_id       UUID;
  manager_id     UUID;
  rrhh_id        UUID;

  -- Equipos
  team_rep UUID := gen_random_uuid();
  team_alm UUID := gen_random_uuid();
  team_adm UUID := gen_random_uuid();
  team_con UUID := gen_random_uuid();

  -- Empleados (21)
  e UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid()
  ];

  -- Variables para turnos/fichajes
  emp        UUID;
  d          DATE;
  dow        INT;
  rnd        FLOAT;
  sh_color   TEXT;
  sh_start   TEXT;
  sh_end     TEXT;
  ci_h INT; ci_m INT; co_h INT; co_m INT; br_h INT;
  t_ci TIMESTAMPTZ; t_co TIMESTAMPTZ; t_bs TIMESTAMPTZ; t_be TIMESTAMPTZ;

BEGIN
  -- Obtener IDs de usuarios Auth creados previamente
  SELECT id INTO admin_id   FROM auth.users WHERE email = 'demo.admin@fycheo-demo.com'   LIMIT 1;
  SELECT id INTO manager_id FROM auth.users WHERE email = 'demo.manager@fycheo-demo.com' LIMIT 1;
  SELECT id INTO rrhh_id    FROM auth.users WHERE email = 'demo.rrhh@fycheo-demo.com'    LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No encontré demo.admin@fycheo-demo.com en Auth. Créalo primero en Authentication > Users.';
  END IF;

  -- ── Perfiles de usuarios admin ────────────────────────────────
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, created_at) VALUES
    (admin_id,   'Carlos Martínez García',  'demo.admin@fycheo-demo.com',   '+34 666 100 001', '12345678A', NOW() - INTERVAL '14 months'),
    (manager_id, 'Ana López Fernández',     'demo.manager@fycheo-demo.com', '+34 677 100 002', '23456789B', NOW() - INTERVAL '14 months'),
    (rrhh_id,    'Miguel Sánchez Torres',   'demo.rrhh@fycheo-demo.com',    '+34 688 100 003', '34567890C', NOW() - INTERVAL '14 months')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, dni_nie = EXCLUDED.dni_nie;

  -- ── Empresa ───────────────────────────────────────────────────
  INSERT INTO public.companies (id, name, owner_id, plan, settings, created_at) VALUES (
    company_id, 'Distribuciones Martínez S.A.', admin_id, 'pro',
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
    (team_rep, company_id, 'Repartidores',  'Equipo de reparto y entrega',      NOW() - INTERVAL '13 months'),
    (team_alm, company_id, 'Almacén',       'Personal de almacén y logística',  NOW() - INTERVAL '13 months'),
    (team_adm, company_id, 'Administración','Equipo administrativo',            NOW() - INTERVAL '13 months'),
    (team_con, company_id, 'Conductores',   'Conductores de largo recorrido',   NOW() - INTERVAL '13 months');

  -- ── Vincular admins a la empresa ──────────────────────────────
  INSERT INTO public.company_members (user_id, company_id, role, team_id, accepted) VALUES
    (admin_id,   company_id, 'admin',   team_adm, true),
    (manager_id, company_id, 'manager', team_adm, true),
    (rrhh_id,    company_id, 'hr',      team_adm, true);

  -- ── Perfiles empleados ficticios ─────────────────────────────
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    -- Repartidores
    (e[1],  'Pedro Jiménez Ruiz',       'pedro.jimenez@martinez-sa.com',   '+34 611 001 001','45678901D','28/001/01', NOW()-INTERVAL '12 months'),
    (e[2],  'Sofía Morales Vega',       'sofia.morales@martinez-sa.com',   '+34 622 002 002','56789012E','28/002/02', NOW()-INTERVAL '11 months'),
    (e[3],  'Javier Romero Castro',     'javier.romero@martinez-sa.com',   '+34 633 003 003','67890123F','28/003/03', NOW()-INTERVAL '10 months'),
    (e[4],  'Laura García Molina',      'laura.garcia@martinez-sa.com',    '+34 644 004 004','78901234G','28/004/04', NOW()-INTERVAL '9 months'),
    (e[5],  'David Torres Alonso',      'david.torres@martinez-sa.com',    '+34 655 005 005','89012345H','28/005/05', NOW()-INTERVAL '8 months'),
    (e[6],  'Elena Vargas Díaz',        'elena.vargas@martinez-sa.com',    '+34 666 006 006','90123456J','28/006/06', NOW()-INTERVAL '13 months'),
    (e[7],  'Marcos Navarro Serrano',   'marcos.navarro@martinez-sa.com',  '+34 677 007 007','01234567K','28/007/07', NOW()-INTERVAL '7 months'),
    -- Almacén
    (e[8],  'Carmen Blanco Ortega',     'carmen.blanco@martinez-sa.com',   '+34 688 008 008','12345679L','28/008/08', NOW()-INTERVAL '13 months'),
    (e[9],  'Roberto Méndez Gil',       'roberto.mendez@martinez-sa.com',  '+34 699 009 009','23456780M','28/009/09', NOW()-INTERVAL '12 months'),
    (e[10], 'Patricia Herrero Cano',    'patricia.herrero@martinez-sa.com','+34 600 010 010','34567891N','28/010/10', NOW()-INTERVAL '6 months'),
    (e[11], 'Antonio Ramos Delgado',    'antonio.ramos@martinez-sa.com',   '+34 611 011 011','45678902P','28/011/11', NOW()-INTERVAL '11 months'),
    (e[12], 'Isabel Fuentes León',      'isabel.fuentes@martinez-sa.com',  '+34 622 012 012','56789013Q','28/012/12', NOW()-INTERVAL '5 months'),
    (e[13], 'Fernando Pascual Iglesias','fernando.pascual@martinez-sa.com','+34 633 013 013','67890124R','28/013/13', NOW()-INTERVAL '10 months'),
    -- Administración
    (e[14], 'Lucía Castillo Prieto',    'lucia.castillo@martinez-sa.com',  '+34 644 014 014','78901235S','28/014/14', NOW()-INTERVAL '13 months'),
    (e[15], 'Jorge Domínguez Rubio',    'jorge.dominguez@martinez-sa.com', '+34 655 015 015','89012346T','28/015/15', NOW()-INTERVAL '8 months'),
    (e[16], 'Marta Ibáñez Mora',        'marta.ibanez@martinez-sa.com',    '+34 666 016 016','90123457V','28/016/16', NOW()-INTERVAL '13 months'),
    (e[17], 'Raúl Guerrero Reyes',      'raul.guerrero@martinez-sa.com',   '+34 677 017 017','01234568W','28/017/17', NOW()-INTERVAL '4 months'),
    -- Conductores
    (e[18], 'Beatriz Aguilar Medina',   'beatriz.aguilar@martinez-sa.com', '+34 688 018 018','12345680X','28/018/18', NOW()-INTERVAL '13 months'),
    (e[19], 'Sergio Pardo Vázquez',     'sergio.pardo@martinez-sa.com',    '+34 699 019 019','23456791Y','28/019/19', NOW()-INTERVAL '9 months'),
    (e[20], 'Natalia Montes Cabrera',   'natalia.montes@martinez-sa.com',  '+34 600 020 020','34567802Z','28/020/20', NOW()-INTERVAL '13 months'),
    (e[21], 'Pablo Peña Nieto',         'pablo.pena@martinez-sa.com',      '+34 611 021 021','45678913A','28/021/21', NOW()-INTERVAL '6 months');

  -- ── Vincular empleados a la empresa ──────────────────────────
  INSERT INTO public.company_members (user_id, company_id, role, team_id, accepted) VALUES
    (e[1], company_id,'employee',team_rep,true),(e[2], company_id,'employee',team_rep,true),
    (e[3], company_id,'employee',team_rep,true),(e[4], company_id,'employee',team_rep,true),
    (e[5], company_id,'employee',team_rep,true),(e[6], company_id,'employee',team_rep,true),
    (e[7], company_id,'employee',team_rep,true),(e[8], company_id,'employee',team_alm,true),
    (e[9], company_id,'employee',team_alm,true),(e[10],company_id,'employee',team_alm,true),
    (e[11],company_id,'employee',team_alm,true),(e[12],company_id,'employee',team_alm,true),
    (e[13],company_id,'employee',team_alm,true),(e[14],company_id,'employee',team_adm,true),
    (e[15],company_id,'employee',team_adm,true),(e[16],company_id,'employee',team_adm,true),
    (e[17],company_id,'employee',team_adm,true),(e[18],company_id,'employee',team_con,true),
    (e[19],company_id,'employee',team_con,true),(e[20],company_id,'employee',team_con,true),
    (e[21],company_id,'employee',team_con,true);

  -- ── Festivos ─────────────────────────────────────────────────
  INSERT INTO public.company_holidays (company_id, name, date, type) VALUES
    (company_id,'Año Nuevo',       (DATE_TRUNC('year',NOW())-INTERVAL '1 year')::date,             'closed'),
    (company_id,'Reyes Magos',     (DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'6 days'::interval)::date, 'closed'),
    (company_id,'Día del Trabajo', (DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'4 months'::interval)::date,'closed'),
    (company_id,'Hispanidad',      (DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'9 months'+'11 days'::interval)::date,'closed'),
    (company_id,'Navidad',         (DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'11 months'+'24 days'::interval)::date,'closed'),
    (company_id,'Año Nuevo',       DATE_TRUNC('year',NOW())::date,                                 'closed'),
    (company_id,'Reyes Magos',     (DATE_TRUNC('year',NOW())+'6 days'::interval)::date,            'closed'),
    (company_id,'Día del Trabajo', (DATE_TRUNC('year',NOW())+'4 months'::interval)::date,          'closed');

  -- ── Turnos y fichajes (12 meses) ─────────────────────────────
  FOREACH emp IN ARRAY e LOOP
    d := CURRENT_DATE - INTERVAL '12 months';
    WHILE d < CURRENT_DATE LOOP
      dow := EXTRACT(DOW FROM d);
      IF dow BETWEEN 1 AND 5 THEN
        rnd := random();
        IF rnd > 0.07 THEN
          -- Elegir tipo de turno
          IF rnd < 0.40 THEN
            sh_color:='#3b82f6'; sh_start:='06:00'; sh_end:='14:00';
            ci_h:=6;  ci_m:=floor(random()*15)::int;
            co_h:=14; co_m:=floor(random()*20)::int; br_h:=10;
          ELSIF rnd < 0.75 THEN
            sh_color:='#10b981'; sh_start:='08:00'; sh_end:='17:00';
            ci_h:=8;  ci_m:=floor(random()*20)::int;
            co_h:=17; co_m:=floor(random()*20)::int; br_h:=13;
          ELSE
            sh_color:='#f59e0b'; sh_start:='14:00'; sh_end:='22:00';
            ci_h:=14; ci_m:=floor(random()*15)::int;
            co_h:=22; co_m:=floor(random()*15)::int; br_h:=18;
          END IF;

          INSERT INTO public.shifts (employee_id,company_id,date,start_time,end_time,color,status,is_published)
          VALUES (emp,company_id,d,sh_start,sh_end,sh_color,'completed',true);

          t_ci := (d::text||' '||LPAD(ci_h::text,2,'0')||':'||LPAD(ci_m::text,2,'0')||':00 Europe/Madrid')::timestamptz;
          t_bs := t_ci + ((br_h*60 - ci_h*60 - ci_m + floor(random()*20)::int) || ' minutes')::interval;
          t_be := t_bs + (30 + floor(random()*15)::int || ' minutes')::interval;
          t_co := (d::text||' '||LPAD(co_h::text,2,'0')||':'||LPAD(co_m::text,2,'0')||':00 Europe/Madrid')::timestamptz;

          INSERT INTO public.time_entries (user_id,company_id,entry_type,occurred_at,status) VALUES
            (emp,company_id,'clock-in',   t_ci,'approved'),
            (emp,company_id,'break-start',t_bs,'approved'),
            (emp,company_id,'break-end',  t_be,'approved'),
            (emp,company_id,'clock-out',  t_co,'approved');
        END IF;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  -- ── Ausencias ────────────────────────────────────────────────
  -- Vacaciones verano
  INSERT INTO public.absences (employee_id,company_id,start_date,end_date,type,status,reason,created_at) VALUES
    (e[1], company_id,(DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'6 months')::date,   (DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'6 months'+'13 days'::interval)::date,  'Vacaciones','approved','Vacaciones verano',NOW()-INTERVAL '8 months'),
    (e[2], company_id,(DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'6 months'+'7 days'::interval)::date,(DATE_TRUNC('year',NOW())-INTERVAL '1 year'+'6 months'+'20 days'::interval)::date,'Vacaciones','approved','Vacaciones verano',NOW()-INTERVAL '8 months'),
    (e[8], company_id,(DATE_TRUNC('year',NOW())-INTERVAL '4 months')::date,            (DATE_TRUNC('year',NOW())-INTERVAL '1 month')::date, 'Maternidad/Paternidad','approved','Permiso de maternidad',NOW()-INTERVAL '4 months'),
    (e[3], company_id,(DATE_TRUNC('year',NOW())-INTERVAL '7 months')::date,            (DATE_TRUNC('year',NOW())-INTERVAL '5 months')::date,'Baja Médica','approved','Accidente laboral - esguince',NOW()-INTERVAL '7 months');
  -- Ausencias pendientes (para que el manager tenga algo que aprobar)
  INSERT INTO public.absences (employee_id,company_id,start_date,end_date,type,status,reason,created_at) VALUES
    (e[2], company_id,CURRENT_DATE+7,CURRENT_DATE+20,'Vacaciones','pending','Viaje familiar',NOW()-INTERVAL '2 days'),
    (e[5], company_id,CURRENT_DATE+3,CURRENT_DATE+5, 'Asuntos Propios','pending','Trámites personales',NOW()-INTERVAL '1 day'),
    (e[11],company_id,CURRENT_DATE,  NULL,            'Baja Médica','pending','Dolor de espalda',NOW());

  -- ── Logs de actividad ─────────────────────────────────────────
  INSERT INTO public.activity_logs (company_id,manager_id,action_type,description,metadata,created_at) VALUES
    (company_id,admin_id,  'company_created', 'Empresa creada','{"plan":"pro"}'::jsonb,NOW()-INTERVAL '14 months'),
    (company_id,admin_id,  'shift_published', 'Publicó 21 turnos para la semana del 15/05','{"count":21}'::jsonb,NOW()-INTERVAL '3 weeks'),
    (company_id,admin_id,  'absence_approved','Aprobó vacaciones de Sofía Morales (14 días)','{"days":14}'::jsonb,NOW()-INTERVAL '2 weeks'),
    (company_id,manager_id,'shift_published', 'Publicó turnos del mes de abril','{"count":18}'::jsonb,NOW()-INTERVAL '6 weeks'),
    (company_id,manager_id,'absence_rejected','Rechazó solicitud de Lucía Castillo','{}'::jsonb,NOW()-INTERVAL '1 month');

  -- ── RESULTADO ────────────────────────────────────────────────
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'DEMO CREADA CORRECTAMENTE';
  RAISE NOTICE 'COMPANY_ID = %', company_id;
  RAISE NOTICE 'Copia este ID en GitHub Secrets como VITE_DEMO_COMPANY_ID';
  RAISE NOTICE '====================================================';
END $$;
