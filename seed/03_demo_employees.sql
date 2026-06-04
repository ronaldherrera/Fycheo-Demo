-- =============================================================
-- FYCHEO DEMO — PASO 3: Empleados ficticios
-- 10 empleados de Distribuciones Martínez S.A.
-- =============================================================
-- IMPORTANTE: Reemplaza los UUIDs con los reales de tu proyecto:
--   COMPANY_UUID  → ID de la empresa (de 02_demo_company_and_teams.sql)
--   TEAM_REP_UUID → ID del equipo Repartidores
--   TEAM_ALM_UUID → ID del equipo Almacén
--   TEAM_ADM_UUID → ID del equipo Administración
--   TEAM_CON_UUID → ID del equipo Conductores
-- =============================================================

DO $$
DECLARE
  company_uuid UUID;
  team_rep_uuid UUID;
  team_alm_uuid UUID;
  team_ofic_uuid UUID;

  -- IDs de perfiles (15 empleados ficticios)
  emp_ids UUID[] := ARRAY[
    gen_random_uuid(), -- 1: Pedro Jiménez
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

BEGIN
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Distribuciones Martínez S.A.' LIMIT 1;
  IF company_uuid IS NULL THEN
    RAISE EXCEPTION 'Empresa no encontrada. Ejecuta 02_demo_company_and_teams.sql primero.';
  END IF;

  SELECT id INTO team_rep_uuid FROM public.teams WHERE company_id = company_uuid AND name = 'Repartidores';
  SELECT id INTO team_alm_uuid FROM public.teams WHERE company_id = company_uuid AND name = 'Almacén';
  SELECT id INTO team_ofic_uuid FROM public.teams WHERE company_id = company_uuid AND name = 'Oficina';

  -- Insertar perfiles de empleados ficticios
  -- Repartidores (5 empleados)
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    (emp_ids[1],  'Pedro Jiménez Ruiz',       'pedro.jimenez@martinez-sa.com',    '+34 611 001 001', '45678901D', '28/001/01', NOW() - INTERVAL '12 months'),
    (emp_ids[2],  'Sofía Morales Vega',       'sofia.morales@martinez-sa.com',     '+34 622 002 002', '56789012E', '28/002/02', NOW() - INTERVAL '11 months'),
    (emp_ids[3],  'Javier Romero Castro',     'javier.romero@martinez-sa.com',     '+34 633 003 003', '67890123F', '28/003/03', NOW() - INTERVAL '10 months'),
    (emp_ids[4],  'Laura García Ruiz',        'laura.garcia@martinez-sa.com',      '+34 644 004 004', '78901234G', '28/004/04', NOW() - INTERVAL '9 months'),
    (emp_ids[5],  'David Torres Ortiz',       'david.torres@martinez-sa.com',      '+34 655 005 005', '89012345H', '28/005/05', NOW() - INTERVAL '8 months');

  -- Almacén (5 empleados)
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    (emp_ids[6],  'Carmen Blanco Ortega',     'carmen.blanco@martinez-sa.com',     '+34 688 008 008', '12345679L', '28/006/06', NOW() - INTERVAL '13 months'),
    (emp_ids[7],  'Roberto Méndez Gil',       'roberto.mendez@martinez-sa.com',    '+34 699 009 009', '23456780M', '28/007/07', NOW() - INTERVAL '12 months'),
    (emp_ids[8],  'Patricia Herrero Cano',    'patricia.herrero@martinez-sa.com',  '+34 600 010 010', '34567891N', '28/008/08', NOW() - INTERVAL '6 months'),
    (emp_ids[9],  'Antonio Ramos Silva',      'antonio.ramos@martinez-sa.com',     '+34 611 011 011', '45678912P', '28/009/09', NOW() - INTERVAL '5 months'),
    (emp_ids[10], 'Isabel Fuentes Sanz',      'isabel.fuentes@martinez-sa.com',    '+34 622 012 012', '56789023Q', '28/010/10', NOW() - INTERVAL '4 months');

  -- Oficina (5 empleados)
  INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, ss_number, created_at) VALUES
    (emp_ids[11], 'Lucía Castillo Prieto',    'lucia.castillo@martinez-sa.com',    '+34 644 014 014', '78901235S', '28/011/11', NOW() - INTERVAL '13 months'),
    (emp_ids[12], 'Jorge Domínguez Rubio',    'jorge.dominguez@martinez-sa.com',   '+34 655 015 015', '89012346T', '28/012/12', NOW() - INTERVAL '8 months'),
    (emp_ids[13], 'Marta Ibáñez Soler',       'marta.ibanez@martinez-sa.com',      '+34 666 016 016', '90123456U', '28/013/13', NOW() - INTERVAL '7 months'),
    (emp_ids[14], 'Raúl Guerrero Menéndez',   'raul.guerrero@martinez-sa.com',     '+34 677 017 017', '01234567V', '28/014/14', NOW() - INTERVAL '6 months'),
    (emp_ids[15], 'Beatriz Aguilar Medina',   'beatriz.aguilar@martinez-sa.com',   '+34 688 018 018', '12345680X', '28/015/15', NOW() - INTERVAL '13 months');

  -- Vincular a company_members con sus equipos
  INSERT INTO public.company_members (user_id, company_id, role, team_id, accepted) VALUES
    -- Repartidores
    (emp_ids[1],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[2],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[3],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[4],  company_uuid, 'employee', team_rep_uuid, true),
    (emp_ids[5],  company_uuid, 'employee', team_rep_uuid, true),
    -- Almacén
    (emp_ids[6],  company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[7],  company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[8],  company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[9],  company_uuid, 'employee', team_alm_uuid, true),
    (emp_ids[10], company_uuid, 'employee', team_alm_uuid, true),
    -- Oficina
    (emp_ids[11], company_uuid, 'employee', team_ofic_uuid, true),
    (emp_ids[12], company_uuid, 'employee', team_ofic_uuid, true),
    (emp_ids[13], company_uuid, 'employee', team_ofic_uuid, true),
    (emp_ids[14], company_uuid, 'employee', team_ofic_uuid, true),
    (emp_ids[15], company_uuid, 'employee', team_ofic_uuid, true);

  RAISE NOTICE '15 empleados creados y vinculados a la empresa.';
END $$;
