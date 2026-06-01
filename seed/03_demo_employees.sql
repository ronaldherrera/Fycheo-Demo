-- =============================================================
-- FYCHEO DEMO — PASO 3: Empleados ficticios
-- 24 empleados de Distribuciones Martínez S.A.
-- =============================================================
-- IMPORTANTE: Reemplaza los UUIDs con los reales de tu proyecto:
--   COMPANY_UUID  → ID de la empresa (de 02_demo_company_and_teams.sql)
--   TEAM_REP_UUID → ID del equipo Repartidores
--   TEAM_ALM_UUID → ID del equipo Almacén
--   TEAM_ADM_UUID → ID del equipo Administración
--   TEAM_CON_UUID → ID del equipo Conductores
-- =============================================================
-- Para obtener los UUIDs del paso anterior:
-- SELECT id, name FROM public.companies WHERE name = 'Distribuciones Martínez S.A.';
-- SELECT id, name FROM public.teams WHERE company_id = '<company_id>';
-- =============================================================

-- Función auxiliar para crear un empleado demo completo
-- (perfil en auth.users + profiles + company_members)
-- Usamos la función de Supabase para crear usuarios sin email de confirmación

-- ⚠️  CREA ESTOS USUARIOS EN SUPABASE AUTH (Dashboard > Authentication > Users)
-- O usa el script de invitación masiva de Fycheo.
--
-- Los DNIs deben coincidir exactamente con lo que metes aquí.
-- Empleados con dni_nie = los del INSERT de abajo.

-- Insertamos directamente en profiles para empleados que ya tienen cuenta
-- En producción usarías invite-employees, pero para demo insertamos directamente.

-- PRIMERO: Obtener IDs
DO $$
DECLARE
  company_uuid UUID;
  team_rep_uuid UUID;
  team_alm_uuid UUID;
  team_adm_uuid UUID;
  team_con_uuid UUID;

  -- IDs de perfiles (se crearán nuevos UUIDs para empleados ficticios)
  emp_ids UUID[] := ARRAY[
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
    gen_random_uuid()
  ];

  emp_data RECORD;
BEGIN
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Distribuciones Martínez S.A.' LIMIT 1;
  IF company_uuid IS NULL THEN
    RAISE EXCEPTION 'Empresa no encontrada. Ejecuta 02_demo_company_and_teams.sql primero.';
  END IF;

  SELECT id INTO team_rep_uuid FROM public.teams WHERE company_id = company_uuid AND name = 'Repartidores';
  SELECT id INTO team_alm_uuid FROM public.teams WHERE company_id = company_uuid AND name = 'Almacén';
  SELECT id INTO team_adm_uuid FROM public.teams WHERE company_id = company_uuid AND name = 'Administración';
  SELECT id INTO team_con_uuid FROM public.teams WHERE company_id = company_uuid AND name = 'Conductores';

  -- Insertar perfiles de empleados ficticios
  -- (En Supabase real, estos deberían crearse en auth.users primero)
  -- Para demo, insertamos en profiles directamente y los vinculamos como empleados

  -- Repartidores (7 empleados)
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    (emp_ids[1],  'Pedro Jiménez Ruiz',      'pedro.jimenez@martinez-sa.com',    '+34 611 001 001', '45678901D', '28/123456789/01', NOW() - INTERVAL '12 months'),
    (emp_ids[2],  'Sofía Morales Vega',       'sofia.morales@martinez-sa.com',     '+34 622 002 002', '56789012E', '28/234567890/02', NOW() - INTERVAL '11 months'),
    (emp_ids[3],  'Javier Romero Castro',     'javier.romero@martinez-sa.com',     '+34 633 003 003', '67890123F', '28/345678901/03', NOW() - INTERVAL '10 months'),
    (emp_ids[4],  'Laura García Molina',      'laura.garcia@martinez-sa.com',      '+34 644 004 004', '78901234G', '28/456789012/04', NOW() - INTERVAL '9 months'),
    (emp_ids[5],  'David Torres Alonso',      'david.torres@martinez-sa.com',      '+34 655 005 005', '89012345H', '28/567890123/05', NOW() - INTERVAL '8 months'),
    (emp_ids[6],  'Elena Vargas Díaz',        'elena.vargas@martinez-sa.com',      '+34 666 006 006', '90123456J', '28/678901234/06', NOW() - INTERVAL '13 months'),
    (emp_ids[7],  'Marcos Navarro Serrano',   'marcos.navarro@martinez-sa.com',    '+34 677 007 007', '01234567K', '28/789012345/07', NOW() - INTERVAL '7 months');

  -- Almacén (6 empleados)
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    (emp_ids[8],  'Carmen Blanco Ortega',     'carmen.blanco@martinez-sa.com',     '+34 688 008 008', '12345679L', '28/890123456/08', NOW() - INTERVAL '13 months'),
    (emp_ids[9],  'Roberto Méndez Gil',       'roberto.mendez@martinez-sa.com',    '+34 699 009 009', '23456780M', '28/901234567/09', NOW() - INTERVAL '12 months'),
    (emp_ids[10], 'Patricia Herrero Cano',    'patricia.herrero@martinez-sa.com',  '+34 600 010 010', '34567891N', '28/012345678/10', NOW() - INTERVAL '6 months'),
    (emp_ids[11], 'Antonio Ramos Delgado',    'antonio.ramos@martinez-sa.com',     '+34 611 011 011', '45678902P', '28/123456780/11', NOW() - INTERVAL '11 months'),
    (emp_ids[12], 'Isabel Fuentes León',      'isabel.fuentes@martinez-sa.com',    '+34 622 012 012', '56789013Q', '28/234567891/12', NOW() - INTERVAL '5 months'),
    (emp_ids[13], 'Fernando Pascual Iglesias','fernando.pascual@martinez-sa.com',  '+34 633 013 013', '67890124R', '28/345678902/13', NOW() - INTERVAL '10 months');

  -- Administración (4 empleados)
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    (emp_ids[14], 'Lucía Castillo Prieto',    'lucia.castillo@martinez-sa.com',    '+34 644 014 014', '78901235S', '28/456789013/14', NOW() - INTERVAL '13 months'),
    (emp_ids[15], 'Jorge Domínguez Rubio',    'jorge.dominguez@martinez-sa.com',   '+34 655 015 015', '89012346T', '28/567890124/15', NOW() - INTERVAL '8 months'),
    (emp_ids[16], 'Marta Ibáñez Mora',        'marta.ibanez@martinez-sa.com',      '+34 666 016 016', '90123457V', '28/678901235/16', NOW() - INTERVAL '13 months'),
    (emp_ids[17], 'Raúl Guerrero Reyes',      'raul.guerrero@martinez-sa.com',     '+34 677 017 017', '01234568W', '28/789012346/17', NOW() - INTERVAL '4 months');

  -- Conductores (4 empleados)
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    (emp_ids[18], 'Beatriz Aguilar Medina',   'beatriz.aguilar@martinez-sa.com',   '+34 688 018 018', '12345680X', '28/890123457/18', NOW() - INTERVAL '13 months'),
    (emp_ids[19], 'Sergio Pardo Vázquez',     'sergio.pardo@martinez-sa.com',      '+34 699 019 019', '23456791Y', '28/901234568/19', NOW() - INTERVAL '9 months'),
    (emp_ids[20], 'Natalia Montes Cabrera',   'natalia.montes@martinez-sa.com',    '+34 600 020 020', '34567802Z', '28/012345679/20', NOW() - INTERVAL '13 months'),
    (emp_ids[21], 'Pablo Peña Nieto',         'pablo.pena@martinez-sa.com',        '+34 611 021 021', '45678913A', '28/123456781/21', NOW() - INTERVAL '6 months');

  -- Vincular a company_members con sus equipos
  INSERT INTO public.company_members (user_id, company_id, role, team_id, accepted) VALUES
    -- Repartidores
    (emp_ids[1],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[2],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[3],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[4],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[5],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[6],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[7],  company_uuid, 'employee', team_rep_uuid, true),
    -- Almacén
    (emp_ids[8],  company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[9],  company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[10], company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[11], company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[12], company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[13], company_uuid, 'employee', team_alm_uuid, true),
    -- Administración
    (emp_ids[14], company_uuid, 'employee', team_adm_uuid, true),
    (emp_ids[15], company_uuid, 'employee', team_adm_uuid, true),
    (emp_ids[16], company_uuid, 'employee', team_adm_uuid, true),
    (emp_ids[17], company_uuid, 'employee', team_adm_uuid, true),
    -- Conductores
    (emp_ids[18], company_uuid, 'employee', team_con_uuid, true),
    (emp_ids[19], company_uuid, 'employee', team_con_uuid, true),
    (emp_ids[20], company_uuid, 'employee', team_con_uuid, true),
    (emp_ids[21], company_uuid, 'employee', team_con_uuid, true);

  RAISE NOTICE '21 empleados creados y vinculados a la empresa.';
END $$;
