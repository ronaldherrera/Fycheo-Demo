-- =============================================================
-- FYCHEO DEMO — PASO 5: Ausencias, Documentos, Tareas y Logs
-- =============================================================

DO $$
DECLARE
  company_uuid UUID;
  admin_uuid UUID;
  manager_uuid UUID;
  emp_ids UUID[];
  emp UUID;
  emp_email TEXT;
  emp_name TEXT;
  i INT;
  
BEGIN
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Distribuciones Martínez S.A.' LIMIT 1;
  SELECT id INTO admin_uuid FROM auth.users WHERE email = 'demo.admin@fycheo-demo.com';
  SELECT id INTO manager_uuid FROM auth.users WHERE email = 'demo.manager@fycheo-demo.com';

  SELECT ARRAY_AGG(user_id) INTO emp_ids
  FROM public.company_members
  WHERE company_id = company_uuid AND role = 'employee';

  IF company_uuid IS NULL THEN RAISE EXCEPTION 'Empresa no encontrada.'; END IF;
  IF emp_ids IS NULL OR array_length(emp_ids, 1) = 0 THEN RAISE EXCEPTION 'No hay empleados.'; END IF;

  -- Limpiar datos previos
  DELETE FROM public.absences WHERE company_id = company_uuid;
  DELETE FROM public.employee_documents WHERE company_id = company_uuid;
  DELETE FROM public.tasks WHERE company_id = company_uuid;
  DELETE FROM public.activity_logs WHERE company_id = company_uuid;
  DELETE FROM public.ephemeral_messages WHERE company_id = company_uuid;

  -- ────────────────────────────────────────────────────────────
  -- 1. Ausencias (Vacaciones y Bajas)
  -- ────────────────────────────────────────────────────────────
  
  -- Vacaciones de verano para TODOS los empleados
  FOR i IN 1..array_length(emp_ids, 1) LOOP
    INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
    VALUES (emp_ids[i], company_uuid, '2026-07-13', '2026-07-26', 'Vacaciones', 'approved', 'Vacaciones de verano', '2026-05-15'::TIMESTAMP);
  END LOOP;

  -- Vacaciones de Navidad para Pedro y Lucía
  FOR emp IN SELECT user_id FROM public.company_members cm JOIN public.profiles p ON p.id = cm.user_id 
             WHERE cm.company_id = company_uuid AND p.email IN ('pedro.jimenez@martinez-sa.com', 'empleado.demo@fycheo-demo.com', 'lucia.castillo@martinez-sa.com') LOOP
    INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
    VALUES (emp, company_uuid, '2026-12-24', '2026-12-31', 'Vacaciones', 'approved', 'Vacaciones de Navidad', '2026-10-01'::TIMESTAMP);
  END LOOP;

  -- Bajas médicas específicas
  FOR emp, emp_email IN SELECT p.id, p.email FROM public.profiles p JOIN public.company_members cm ON cm.user_id = p.id WHERE cm.company_id = company_uuid LOOP
    -- Pedro: baja pasada en febrero
    IF emp_email IN ('pedro.jimenez@martinez-sa.com', 'empleado.demo@fycheo-demo.com') THEN
      INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
      VALUES (emp, company_uuid, '2026-02-09', '2026-02-13', 'Baja Médica', 'approved', 'Gripe común', '2026-02-09'::TIMESTAMP);
    END IF;

    -- Carmen: baja médica activa hoy (1 al 10 de junio de 2026)
    IF emp_email = 'carmen.blanco@martinez-sa.com' THEN
      INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
      VALUES (emp, company_uuid, '2026-06-01', '2026-06-10', 'Baja Médica', 'approved', 'Esguince de tobillo', '2026-06-01'::TIMESTAMP);
    END IF;

    -- Sofía: baja médica activa hoy (4 al 8 de junio de 2026)
    IF emp_email = 'sofia.morales@martinez-sa.com' THEN
      INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
      VALUES (emp, company_uuid, '2026-06-04', '2026-06-08', 'Baja Médica', 'approved', 'Gastroenteritis aguda', '2026-06-04'::TIMESTAMP);
    END IF;
  END LOOP;

  -- Solicitudes pendientes de ausencias para dar contenido al panel
  -- Antonio Ramos: solicita vacaciones en septiembre
  INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  SELECT p.id, company_uuid, '2026-09-07', '2026-09-14', 'Vacaciones', 'pending', 'Viaje familiar retrasado', '2026-06-02'::TIMESTAMP
  FROM public.profiles p WHERE p.email = 'antonio.ramos@martinez-sa.com';

  -- Patricia Herrero: solicita asuntos propios en junio
  INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  SELECT p.id, company_uuid, '2026-06-18', '2026-06-19', 'Asuntos Propios', 'pending', 'Trámites notariales', '2026-06-02'::TIMESTAMP
  FROM public.profiles p WHERE p.email = 'patricia.herrero@martinez-sa.com';

  -- Jorge Domínguez: mudanza aprobada en mayo
  INSERT INTO public.absences (employee_id, company_id, start_date, end_date, type, status, reason, created_at)
  SELECT p.id, company_uuid, '2026-05-12', '2026-05-13', 'Asuntos Propios', 'approved', 'Mudanza de domicilio', '2026-05-02'::TIMESTAMP
  FROM public.profiles p WHERE p.email = 'jorge.dominguez@martinez-sa.com';


  -- ────────────────────────────────────────────────────────────
  -- 2. Documentos de los Empleados (Nóminas y Contratos)
  -- ────────────────────────────────────────────────────────────
  FOREACH emp IN ARRAY emp_ids
  LOOP
    -- 2.1. Contrato Laboral Indefinido
    INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at)
    VALUES (
      company_uuid, emp, 'contrato', 
      'Contrato de Trabajo Indefinido', NULL, 
      company_uuid::TEXT || '/' || emp::TEXT || '/contrato/contrato_firmado.pdf', 
      142350, '2026-01-02'::TIMESTAMP
    );

    -- 2.2. Certificado IRPF
    INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at)
    VALUES (
      company_uuid, emp, 'certificado', 
      'Certificado de Retenciones IRPF 2025', NULL, 
      company_uuid::TEXT || '/' || emp::TEXT || '/certificado/retenciones_2025.pdf', 
      230410, '2026-02-15'::TIMESTAMP
    );

    -- 2.3. Nóminas mensuales de 2026 (Enero a Mayo)
    INSERT INTO public.employee_documents (company_id, employee_id, document_type, title, period, file_url, file_size, created_at) VALUES
      (company_uuid, emp, 'nomina', 'Nómina Enero 2026',    '2026-01', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_01.pdf', 85200, '2026-01-31'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Febrero 2026',  '2026-02', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_02.pdf', 85200, '2026-02-28'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Marzo 2026',    '2026-03', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_03.pdf', 85200, '2026-03-31'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Abril 2026',    '2026-04', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_04.pdf', 85200, '2026-04-30'::TIMESTAMP),
      (company_uuid, emp, 'nomina', 'Nómina Mayo 2026',     '2026-05', company_uuid::TEXT || '/' || emp::TEXT || '/nomina/nomina_2026_05.pdf', 85200, '2026-05-31'::TIMESTAMP);
  END LOOP;


  -- ────────────────────────────────────────────────────────────
  -- 3. Tareas y Avisos (public.tasks)
  -- ────────────────────────────────────────────────────────────
  FOREACH emp IN ARRAY emp_ids
  LOOP
    SELECT email, full_name INTO emp_email, emp_name FROM public.profiles WHERE id = emp;

    -- 3.1. Insertar una tarea en el pasado marcada como 'done'
    INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, done_at, created_at)
    VALUES (
      company_uuid, admin_uuid, emp, 'task', 
      'Lectura de Normativa Interna v2026', 
      'Leer y aceptar las nuevas directrices de la política interna de la empresa.', 
      '2026-01-15'::DATE, 'low', 'done', '2026-01-14 11:30:00 Europe/Madrid'::TIMESTAMPTZ, '2026-01-05'::TIMESTAMP
    );

    -- 3.2. Insertar una tarea pendiente para cada empleado (due_date en el futuro)
    IF emp_email IN ('pedro.jimenez@martinez-sa.com', 'empleado.demo@fycheo-demo.com') THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at) VALUES
        (company_uuid, admin_uuid, emp, 'task', 'Completar curso de PRL', 'Realizar la formación online de Prevención de Riesgos Laborales antes de la fecha límite.', '2026-06-15'::DATE, 'high', 'pending', '2026-06-01'::TIMESTAMP),
        (company_uuid, admin_uuid, emp, 'task', 'Revisar tacógrafo de la furgoneta', 'Extraer y revisar los registros de conducción de la furgoneta de reparto principal.', '2026-06-08'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP);
    ELSIF emp_email = 'sofia.morales@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Revisión técnica de la furgoneta', 'Llevar la furgoneta de reparto al taller asignado para la revisión semestral.', '2026-06-12'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP);
    ELSIF emp_email = 'javier.romero@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Entregar albaranes firmados', 'Escanear y depositar en administración todos los albaranes firmados del mes de mayo.', '2026-06-10'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP);
    ELSIF emp_email = 'laura.garcia@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Preparar informe de rutas semanales', 'Trazar el informe de eficiencia de las rutas de la zona norte de este mes.', '2026-06-15'::DATE, 'low', 'pending', '2026-06-03'::TIMESTAMP);
    ELSIF emp_email = 'david.torres@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Limpieza interna de furgoneta #2', 'Realizar la desinfección y limpieza del compartimento de carga del vehículo.', '2026-06-08'::DATE, 'low', 'pending', '2026-06-03'::TIMESTAMP);
    ELSIF emp_email = 'carmen.blanco@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Organizar estantería de palets A', 'Al regresar de la baja médica, organizar y etiquetar la estantería del sector de palets A.', '2026-06-25'::DATE, 'low', 'pending', '2026-06-01'::TIMESTAMP);
    ELSIF emp_email = 'roberto.mendez@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Inventario mensual del pasillo 4', 'Realizar el recuento total del stock del pasillo 4 del almacén central.', '2026-06-15'::DATE, 'normal', 'pending', '2026-06-02'::TIMESTAMP);
    ELSIF emp_email = 'patricia.herrero@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Preparar pedido cliente #8890', 'Preparar el pedido especial y coordinar con reparto urgente.', '2026-06-05'::DATE, 'high', 'pending', '2026-06-03'::TIMESTAMP);
    ELSIF emp_email = 'antonio.ramos@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Revisar stock de embalajes', 'Realizar auditoría del cartón de embalaje y cinta de precintar en el almacén.', '2026-06-12'::DATE, 'low', 'pending', '2026-06-03'::TIMESTAMP);
    ELSIF emp_email = 'isabel.fuentes@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Etiquetado de nuevos palets recibidos', 'Etiquetar con el código de barras correspondiente la mercancía del proveedor X.', '2026-06-10'::DATE, 'normal', 'pending', '2026-06-03'::TIMESTAMP);
    ELSIF emp_email = 'lucia.castillo@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Cierre contable provisional', 'Preparar y consolidar el informe provisional de gastos de mayo.', '2026-06-10'::DATE, 'high', 'pending', '2026-06-02'::TIMESTAMP);
    ELSIF emp_email = 'jorge.dominguez@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Archivar facturas de proveedores', 'Clasificar y subir las facturas digitales recibidas de los proveedores principales.', '2026-06-18'::DATE, 'low', 'pending', '2026-06-02'::TIMESTAMP);
    ELSIF emp_email = 'marta.ibanez@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Preparar contratos nuevas incorporaciones', 'Elaborar borradores de los dos nuevos contratos de prácticas para Julio.', '2026-06-15'::DATE, 'normal', 'pending', '2026-06-03'::TIMESTAMP);
    ELSIF emp_email = 'raul.guerrero@martinez-sa.com' THEN
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Revisión de nóminas de mayo', 'Verificar que las nóminas de mayo coinciden con los días trabajados antes del envío.', '2026-06-10'::DATE, 'normal', 'pending', '2026-06-03'::TIMESTAMP);
    ELSE
      INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
      VALUES (company_uuid, admin_uuid, emp, 'task', 'Planificar formación PRL de oficina', 'Coordinar con la empresa externa la fecha de la formación PRL del personal administrativo.', '2026-06-12'::DATE, 'low', 'pending', '2026-06-02'::TIMESTAMP);
    END IF;

    -- 3.3. Insertar un aviso/notificación pendiente para cada empleado (type = 'notice')
    INSERT INTO public.tasks (company_id, created_by, assigned_to, type, title, description, due_date, priority, status, created_at)
    VALUES (
      company_uuid, admin_uuid, emp, 'notice', 
      'Nueva normativa de Seguridad Vial', 
      'Es obligatorio leer y firmar el nuevo protocolo de conducción segura publicado por RRHH.', 
      NULL, 'normal', 'pending', '2026-06-02'::TIMESTAMP
    );
  END LOOP;

  -- ────────────────────────────────────────────────────────────
  -- 4. Chat efímero (public.ephemeral_messages)
  -- ────────────────────────────────────────────────────────────
  DECLARE
    pedro_uuid UUID := emp_ids[1];
    javier_uuid UUID := emp_ids[3];
  BEGIN
    -- Conversación Pedro <-> Ana López (manager_uuid)
    IF pedro_uuid IS NOT NULL AND manager_uuid IS NOT NULL THEN
      INSERT INTO public.ephemeral_messages (company_id, sender_id, receiver_id, content, sent_at, expires_at) VALUES
        (company_uuid, manager_uuid, pedro_uuid, 'Hola Pedro, ¿cómo vas con la entrega del pedido especial?', NOW() - INTERVAL '4 hours', NOW() + INTERVAL '20 hours'),
        (company_uuid, pedro_uuid, manager_uuid, 'Hola Ana, ya está cargado en la furgoneta. Salgo ahora mismo a entregarlo.', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '20 hours'),
        (company_uuid, manager_uuid, pedro_uuid, 'Perfecto, avísame en cuanto esté entregado y firmado.', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '20 hours'),
        (company_uuid, pedro_uuid, manager_uuid, '¡Entregado! El cliente ha quedado muy contento.', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '20 hours'),
        (company_uuid, manager_uuid, pedro_uuid, 'Excelente trabajo, muchas gracias.', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '20 hours');
    END IF;

    -- Conversación Pedro <-> Carlos Martínez (admin_uuid)
    IF pedro_uuid IS NOT NULL AND admin_uuid IS NOT NULL THEN
      INSERT INTO public.ephemeral_messages (company_id, sender_id, receiver_id, content, sent_at, expires_at) VALUES
        (company_uuid, admin_uuid, pedro_uuid, 'Hola Pedro, ¿puedes revisar el tacógrafo de la furgoneta al terminar el turno?', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '20 hours'),
        (company_uuid, pedro_uuid, admin_uuid, 'Sí, Carlos. En cuanto vuelva a la oficina extraigo los datos y te los dejo en la mesa.', NOW() - INTERVAL '45 minutes', NOW() + INTERVAL '20 hours'),
        (company_uuid, admin_uuid, pedro_uuid, 'Genial, gracias por tu ayuda.', NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '20 hours');
    END IF;

    -- Conversación Pedro <-> Miguel Sánchez (rrhh_uuid)
    IF pedro_uuid IS NOT NULL AND rrhh_uuid IS NOT NULL THEN
      INSERT INTO public.ephemeral_messages (company_id, sender_id, receiver_id, content, sent_at, expires_at) VALUES
        (company_uuid, rrhh_uuid, pedro_uuid, 'Pedro, recuerda que debes subir el justificante firmado del curso de PRL de esta semana.', NOW() - INTERVAL '1 day 2 hours', NOW() + INTERVAL '20 hours'),
        (company_uuid, pedro_uuid, rrhh_uuid, 'Hola Miguel. Lo tengo aquí, ahora en un rato lo escaneo y lo subo.', NOW() - INTERVAL '1 day 1 hour', NOW() + INTERVAL '20 hours'),
        (company_uuid, rrhh_uuid, pedro_uuid, 'Perfecto, lo compruebo esta tarde. Gracias.', NOW() - INTERVAL '23 hours', NOW() + INTERVAL '20 hours');
    END IF;

    -- Conversación Pedro <-> Javier Romero (javier_uuid)
    IF pedro_uuid IS NOT NULL AND javier_uuid IS NOT NULL THEN
      INSERT INTO public.ephemeral_messages (company_id, sender_id, receiver_id, content, sent_at, expires_at) VALUES
        (company_uuid, javier_uuid, pedro_uuid, 'Hola Pedro, ¿puedes pasarme la furgoneta #2 limpia hoy? Mañana me toca reparto temprano.', NOW() - INTERVAL '10 hours', NOW() + INTERVAL '20 hours'),
        (company_uuid, pedro_uuid, javier_uuid, 'Hola Javi, no te preocupes. La limpio al final del turno y te dejo las llaves en la taquilla.', NOW() - INTERVAL '9 hours', NOW() + INTERVAL '20 hours'),
        (company_uuid, javier_uuid, pedro_uuid, '¡Eres un grande! Muchas gracias tío.', NOW() - INTERVAL '8 hours', NOW() + INTERVAL '20 hours');
    END IF;
  END;

  -- ────────────────────────────────────────────────────────────
  -- 5. Logs de Actividad
  -- ────────────────────────────────────────────────────────────
  IF admin_uuid IS NOT NULL THEN
    INSERT INTO public.activity_logs (company_id, manager_id, action_type, description, metadata, created_at) VALUES
      (company_uuid, admin_uuid, 'company_created', 'Empresa "Distribuciones Martínez S.A." creada', '{"plan": "pro"}'::jsonb, '2025-04-15 09:00:00'::TIMESTAMP),
      (company_uuid, admin_uuid, 'team_created', 'Creado equipo "Repartidores"', '{"team_name": "Repartidores"}'::jsonb, '2025-05-02 10:30:00'::TIMESTAMP),
      (company_uuid, admin_uuid, 'team_created', 'Creado equipo "Almacén"', '{"team_name": "Almacén"}'::jsonb, '2025-05-02 10:35:00'::TIMESTAMP),
      (company_uuid, admin_uuid, 'team_created', 'Creado equipo "Oficina"', '{"team_name": "Oficina"}'::jsonb, '2025-05-02 10:40:00'::TIMESTAMP),
      (company_uuid, admin_uuid, 'employee_added', 'Añadido empleado Pedro Jiménez Ruiz al equipo Repartidores', '{"employee_email": "empleado.demo@fycheo-demo.com"}'::jsonb, '2025-06-01'::TIMESTAMP),
      (company_uuid, admin_uuid, 'absence_approved', 'Aprobó vacaciones de verano generales para la plantilla', '{"days": 14}'::jsonb, '2026-05-15 14:00:00'::TIMESTAMP),
      (company_uuid, admin_uuid, 'shift_published', 'Publicó turnos de junio de 2026', '{"publishedCount": 330}'::jsonb, '2026-05-28 17:30:00'::TIMESTAMP);
  END IF;

  IF manager_uuid IS NOT NULL THEN
    INSERT INTO public.activity_logs (company_id, manager_id, action_type, description, metadata, created_at) VALUES
      (company_uuid, manager_uuid, 'absence_approved', 'Aprobó baja médica de Carmen Blanco Ortega', '{"employee": "Carmen Blanco"}'::jsonb, '2026-06-01'::TIMESTAMP),
      (company_uuid, manager_uuid, 'task_created', 'Asignó tarea de PRL a Pedro Jiménez', '{"employee": "Pedro Jiménez"}'::jsonb, '2026-06-01'::TIMESTAMP);
  END IF;

  RAISE NOTICE 'Ausencias, nóminas, contratos, tareas, avisos y logs creados correctamente.';
END $$;
