-- =============================================================
-- FYCHEO DEMO — PASO 2: Empresa, Equipos y Configuración
-- Distribuciones Martínez S.A.
-- =============================================================
-- IMPORTANTE: Ejecuta primero 01_demo_users.sql
-- Reemplaza ADMIN_USER_UUID con el UUID real del usuario admin
-- =============================================================

DO $$
DECLARE
  admin_id UUID;
  manager_id UUID;
  rrhh_id UUID;
  company_id UUID := gen_random_uuid();
  team_reparto_id UUID := gen_random_uuid();
  team_almacen_id UUID := gen_random_uuid();
  team_admin_id UUID := gen_random_uuid();
  team_conductores_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'demo.admin@fycheo-demo.com';
  SELECT id INTO manager_id FROM auth.users WHERE email = 'demo.manager@fycheo-demo.com';
  SELECT id INTO rrhh_id FROM auth.users WHERE email = 'demo.rrhh@fycheo-demo.com';

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Usuario demo.admin@fycheo-demo.com no encontrado. Crea los usuarios primero.';
  END IF;

  -- Crear empresa
  INSERT INTO public.companies (id, name, owner_id, plan, settings, created_at)
  VALUES (
    company_id,
    'Distribuciones Martínez S.A.',
    admin_id,
    'pro',
    '{
      "schedule": {
        "monday":    {"active": true,  "start": "08:00", "end": "17:00"},
        "tuesday":   {"active": true,  "start": "08:00", "end": "17:00"},
        "wednesday": {"active": true,  "start": "08:00", "end": "17:00"},
        "thursday":  {"active": true,  "start": "08:00", "end": "17:00"},
        "friday":    {"active": true,  "start": "08:00", "end": "15:00"},
        "saturday":  {"active": false, "start": "09:00", "end": "13:00"},
        "sunday":    {"active": false, "start": "09:00", "end": "13:00"}
      },
      "general": {
        "tolerance": "15",
        "timezone": "Europe/Madrid"
      },
      "shift_types": [
        {"name": "Mañana",    "color": "#3b82f6", "start": "06:00", "end": "14:00"},
        {"name": "Tarde",     "color": "#f59e0b", "start": "14:00", "end": "22:00"},
        {"name": "Jornada Completa", "color": "#10b981", "start": "08:00", "end": "17:00"},
        {"name": "Partido",   "color": "#8b5cf6", "start": "08:00", "end": "13:00"}
      ],
      "leave_policies": [
        {"id": "vacation", "name": "Vacaciones", "color": "emerald", "hex": "#10b981", "limitUnit": "days", "limitPeriod": "year", "maxAmount": 23, "minAmount": 1, "isPaid": true},
        {"id": "sick",     "name": "Baja Médica", "color": "red",     "hex": "#ef4444", "limitUnit": "days", "limitPeriod": "year", "maxAmount": 365, "minAmount": 1, "isPaid": true},
        {"id": "personal", "name": "Asuntos Propios", "color": "blue", "hex": "#3b82f6", "limitUnit": "days", "limitPeriod": "year", "maxAmount": 5, "minAmount": 1, "isPaid": true},
        {"id": "maternity","name": "Maternidad/Paternidad", "color": "pink", "hex": "#ec4899", "limitUnit": "days", "limitPeriod": "year", "maxAmount": 112, "minAmount": 1, "isPaid": true}
      ]
    }'::jsonb,
    NOW() - INTERVAL '14 months'
  );

  -- Guardar company_id en una tabla temporal para usarlo en otros scripts
  -- (o imprímelo en consola)
  RAISE NOTICE 'COMPANY_ID creado: %', company_id;
  RAISE NOTICE 'Copia este ID en tu archivo .env como VITE_DEMO_COMPANY_ID';

  -- Crear equipos
  INSERT INTO public.teams (id, company_id, name, description, created_at) VALUES
    (team_reparto_id,    company_id, 'Repartidores',     'Equipo de reparto y entrega a clientes', NOW() - INTERVAL '13 months'),
    (team_almacen_id,    company_id, 'Almacén',           'Personal de almacén y logística', NOW() - INTERVAL '13 months'),
    (team_admin_id,      company_id, 'Administración',    'Equipo administrativo y contabilidad', NOW() - INTERVAL '13 months'),
    (team_conductores_id,company_id, 'Conductores',       'Conductores de largo recorrido', NOW() - INTERVAL '13 months');

  -- Vincular usuarios admin a la empresa
  INSERT INTO public.company_members (user_id, company_id, role, accepted, team_id) VALUES
    (admin_id,   company_id, 'admin',   true, team_admin_id),
    (manager_id, company_id, 'manager', true, team_admin_id),
    (rrhh_id,    company_id, 'hr',      true, team_admin_id);

  -- Festivos de la empresa (año actual y anterior)
  INSERT INTO public.company_holidays (company_id, name, date, type) VALUES
    -- Festivos nacionales
    (company_id, 'Año Nuevo',            (DATE_TRUNC('year', NOW()) - INTERVAL '1 year')::date + '0 days'::interval, 'closed'),
    (company_id, 'Reyes Magos',          (DATE_TRUNC('year', NOW()) - INTERVAL '1 year')::date + '6 days'::interval, 'closed'),
    (company_id, 'Día del Trabajador',   (DATE_TRUNC('year', NOW()) - INTERVAL '1 year' + INTERVAL '4 months')::date, 'closed'),
    (company_id, 'Asunción',             (DATE_TRUNC('year', NOW()) - INTERVAL '1 year' + INTERVAL '7 months' + '14 days'::interval)::date, 'closed'),
    (company_id, 'Fiesta Nacional',      (DATE_TRUNC('year', NOW()) - INTERVAL '1 year' + INTERVAL '9 months' + '11 days'::interval)::date, 'closed'),
    (company_id, 'Todos los Santos',     (DATE_TRUNC('year', NOW()) - INTERVAL '1 year' + INTERVAL '10 months')::date, 'closed'),
    (company_id, 'Constitución',         (DATE_TRUNC('year', NOW()) - INTERVAL '1 year' + INTERVAL '11 months' + '5 days'::interval)::date, 'closed'),
    (company_id, 'Inmaculada',           (DATE_TRUNC('year', NOW()) - INTERVAL '1 year' + INTERVAL '11 months' + '7 days'::interval)::date, 'closed'),
    (company_id, 'Navidad',              (DATE_TRUNC('year', NOW()) - INTERVAL '1 year' + INTERVAL '11 months' + '24 days'::interval)::date, 'closed'),
    -- Año actual
    (company_id, 'Año Nuevo',            DATE_TRUNC('year', NOW())::date, 'closed'),
    (company_id, 'Reyes Magos',          (DATE_TRUNC('year', NOW()) + '6 days'::interval)::date, 'closed'),
    (company_id, 'Día del Trabajador',   (DATE_TRUNC('year', NOW()) + INTERVAL '4 months')::date, 'closed');

  RAISE NOTICE 'Empresa y equipos creados correctamente.';
  RAISE NOTICE '';
  RAISE NOTICE '=== IMPORTANT: Save these IDs ===';
  RAISE NOTICE 'COMPANY_ID:        %', company_id;
  RAISE NOTICE 'TEAM_REPARTO:      %', team_reparto_id;
  RAISE NOTICE 'TEAM_ALMACEN:      %', team_almacen_id;
  RAISE NOTICE 'TEAM_ADMIN:        %', team_admin_id;
  RAISE NOTICE 'TEAM_CONDUCTORES:  %', team_conductores_id;
END $$;
