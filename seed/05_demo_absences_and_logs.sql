-- =============================================================
-- FYCHEO DEMO — PASO 5: Ausencias, Bajas y Logs de Actividad
-- =============================================================

DO $$
DECLARE
  company_uuid UUID;
  admin_uuid UUID;
  manager_uuid UUID;
  emp_ids UUID[];
  emp_id UUID;
  i INT;
  start_d DATE;
  end_d DATE;

BEGIN
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Distribuciones Martínez S.A.' LIMIT 1;
  SELECT id INTO admin_uuid FROM auth.users WHERE email = 'demo.admin@fycheo-demo.com';
  SELECT id INTO manager_uuid FROM auth.users WHERE email = 'demo.manager@fycheo-demo.com';

  SELECT ARRAY_AGG(user_id) INTO emp_ids
  FROM public.company_members
  WHERE company_id = company_uuid AND role = 'employee';

  IF company_uuid IS NULL THEN RAISE EXCEPTION 'Empresa no encontrada.'; END IF;

  -- ────────────────────────────────────────────────────────────
  -- Ausencias aprobadas (vacaciones del año pasado)
  -- ────────────────────────────────────────────────────────────
  FOR i IN 1..array_length(emp_ids, 1) LOOP
    emp_id := emp_ids[i];

    -- Vacaciones de verano (julio)
    start_d := (DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' + INTERVAL '6 months' + ((i % 3) * 7 || ' days')::INTERVAL)::DATE;
    end_d := start_d + INTERVAL '13 days';
    INSERT INTO public.absences (id, employee_id, company_id, start_date, end_date, type, status, reason, created_at)
    VALUES (gen_random_uuid(), emp_id, company_uuid, start_d, end_d, 'Vacaciones', 'approved',
      'Vacaciones de verano', start_d - INTERVAL '30 days');

    -- Vacaciones de Navidad (diciembre, algunos empleados)
    IF i % 3 = 0 THEN
      start_d := (DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' + INTERVAL '11 months' + '21 days'::INTERVAL)::DATE;
      end_d := start_d + INTERVAL '9 days';
      INSERT INTO public.absences (id, employee_id, company_id, start_date, end_date, type, status, reason, created_at)
      VALUES (gen_random_uuid(), emp_id, company_uuid, start_d, end_d, 'Vacaciones', 'approved',
        'Vacaciones de Navidad', start_d - INTERVAL '45 days');
    END IF;
  END LOOP;

  -- ────────────────────────────────────────────────────────────
  -- Bajas médicas (algunos empleados)
  -- ────────────────────────────────────────────────────────────

  -- Empleado 1: baja por gripe en enero
  INSERT INTO public.absences (id, employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  VALUES (gen_random_uuid(), emp_ids[1], company_uuid,
    (CURRENT_DATE - INTERVAL '10 months' + INTERVAL '5 days')::DATE,
    (CURRENT_DATE - INTERVAL '10 months' + INTERVAL '10 days')::DATE,
    'Baja Médica', 'approved', 'Gripe con reposo médico',
    CURRENT_DATE - INTERVAL '10 months' + INTERVAL '5 days');

  -- Empleado 3: baja por accidente laboral (larga duración)
  INSERT INTO public.absences (id, employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  VALUES (gen_random_uuid(), emp_ids[3], company_uuid,
    (CURRENT_DATE - INTERVAL '7 months')::DATE,
    (CURRENT_DATE - INTERVAL '5 months')::DATE,
    'Baja Médica', 'approved', 'Accidente laboral - esguince de tobillo',
    CURRENT_DATE - INTERVAL '7 months');

  -- Empleado 8: baja por maternidad
  INSERT INTO public.absences (id, employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  VALUES (gen_random_uuid(), emp_ids[8], company_uuid,
    (CURRENT_DATE - INTERVAL '4 months')::DATE,
    (CURRENT_DATE - INTERVAL '1 month')::DATE,
    'Maternidad/Paternidad', 'approved', 'Permiso de maternidad',
    CURRENT_DATE - INTERVAL '4 months');

  -- Empleado 14: asuntos propios (rechazada)
  INSERT INTO public.absences (id, employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  VALUES (gen_random_uuid(), emp_ids[14], company_uuid,
    (CURRENT_DATE - INTERVAL '1 month')::DATE,
    (CURRENT_DATE - INTERVAL '1 month' + INTERVAL '2 days')::DATE,
    'Asuntos Propios', 'rejected', 'Gestiones personales',
    CURRENT_DATE - INTERVAL '1 month');

  -- Ausencias pendientes (recientes - para que el manager tenga algo que aprobar)
  INSERT INTO public.absences (id, employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  VALUES
    (gen_random_uuid(), emp_ids[2], company_uuid,
      CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '18 days',
      'Vacaciones', 'pending', 'Viaje familiar programado', CURRENT_DATE - INTERVAL '2 days'),
    (gen_random_uuid(), emp_ids[5], company_uuid,
      CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE + INTERVAL '5 days',
      'Asuntos Propios', 'pending', 'Trámites bancarios urgentes', CURRENT_DATE - INTERVAL '1 day'),
    (gen_random_uuid(), emp_ids[11], company_uuid,
      CURRENT_DATE, NULL,
      'Baja Médica', 'pending', 'Dolor de espalda - pendiente de parte médico', CURRENT_DATE);

  -- ────────────────────────────────────────────────────────────
  -- Logs de actividad
  -- ────────────────────────────────────────────────────────────
  IF admin_uuid IS NOT NULL THEN
    INSERT INTO public.activity_logs (id, company_id, manager_id, action_type, description, metadata, created_at) VALUES
      (gen_random_uuid(), company_uuid, admin_uuid, 'company_created',
        'Empresa "Distribuciones Martínez S.A." creada',
        '{"plan": "pro"}'::jsonb, NOW() - INTERVAL '14 months'),
      (gen_random_uuid(), company_uuid, admin_uuid, 'team_created',
        'Creado equipo "Repartidores"',
        '{"team_name": "Repartidores"}'::jsonb, NOW() - INTERVAL '13 months'),
      (gen_random_uuid(), company_uuid, admin_uuid, 'team_created',
        'Creado equipo "Almacén"',
        '{"team_name": "Almacén"}'::jsonb, NOW() - INTERVAL '13 months'),
      (gen_random_uuid(), company_uuid, admin_uuid, 'employee_added',
        'Añadido empleado Pedro Jiménez Ruiz al equipo Repartidores',
        '{"employee_email": "pedro.jimenez@martinez-sa.com"}'::jsonb, NOW() - INTERVAL '12 months'),
      (gen_random_uuid(), company_uuid, admin_uuid, 'shift_published',
        'Publicó 18 turnos para la semana del 15/05',
        '{"publishedCount": 18}'::jsonb, NOW() - INTERVAL '3 weeks'),
      (gen_random_uuid(), company_uuid, admin_uuid, 'absence_approved',
        'Aprobó solicitud de vacaciones de Sofía Morales (14 días)',
        '{"employee": "Sofía Morales", "days": 14}'::jsonb, NOW() - INTERVAL '2 weeks'),
      (gen_random_uuid(), company_uuid, admin_uuid, 'shift_published',
        'Publicó 21 turnos para la semana actual',
        '{"publishedCount": 21}'::jsonb, NOW() - INTERVAL '5 days');
  END IF;

  IF manager_uuid IS NOT NULL THEN
    INSERT INTO public.activity_logs (id, company_id, manager_id, action_type, description, metadata, created_at) VALUES
      (gen_random_uuid(), company_uuid, manager_uuid, 'absence_rejected',
        'Rechazó solicitud de permisos de Lucía Castillo (conflicto de fechas)',
        '{"employee": "Lucía Castillo"}'::jsonb, NOW() - INTERVAL '1 month'),
      (gen_random_uuid(), company_uuid, manager_uuid, 'shift_published',
        'Publicó 24 turnos para el mes de mayo',
        '{"publishedCount": 24}'::jsonb, NOW() - INTERVAL '6 weeks');
  END IF;

  RAISE NOTICE 'Ausencias y logs de actividad creados.';
END $$;
