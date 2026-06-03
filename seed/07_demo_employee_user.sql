-- ================================================================
-- FYCHEO DEMO — Usuario Auth para la App de Empleado
-- ================================================================
-- 1. Crea este usuario en Supabase Auth > Users:
--    Email:    empleado.demo@fycheo-demo.com
--    Password: FycheoDemo2024!
--    (marca Auto Confirm)
--
-- 2. Luego ejecuta este script para vincular ese usuario
--    al perfil de Pedro Jiménez Ruiz en la empresa demo
-- ================================================================

DO $$
DECLARE
  emp_auth_id UUID;
  company_uuid UUID;
  pedro_profile_id UUID;
BEGIN
  SELECT id INTO emp_auth_id FROM auth.users WHERE email = 'empleado.demo@fycheo-demo.com';
  IF emp_auth_id IS NULL THEN
    RAISE EXCEPTION 'Usuario empleado.demo@fycheo-demo.com no encontrado en Auth. Créalo primero.';
  END IF;

  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Distribuciones Martínez S.A.' LIMIT 1;

  -- Buscar el perfil de Pedro Jiménez Ruiz
  SELECT id INTO pedro_profile_id FROM public.profiles WHERE full_name = 'Pedro Jiménez Ruiz' LIMIT 1;

  IF pedro_profile_id IS NOT NULL THEN
    -- Actualizar el perfil existente de Pedro para que use el ID del auth user
    -- (hacer que el auth user tenga los mismos datos que Pedro)
    UPDATE public.profiles SET
      id = emp_auth_id,
      full_name = 'Pedro Jiménez Ruiz',
      email = 'empleado.demo@fycheo-demo.com',
      phone = '+34 611 001 001',
      dni_nie = '45678901D'
    WHERE id = pedro_profile_id;

    -- Actualizar company_members con el nuevo ID
    UPDATE public.company_members SET user_id = emp_auth_id
    WHERE user_id = pedro_profile_id AND company_id = company_uuid;

    -- Actualizar time_entries con el nuevo ID
    UPDATE public.time_entries SET user_id = emp_auth_id
    WHERE user_id = pedro_profile_id AND company_id = company_uuid;

    -- Actualizar shifts
    UPDATE public.shifts SET employee_id = emp_auth_id
    WHERE employee_id = pedro_profile_id AND company_id = company_uuid;

    -- Actualizar absences
    UPDATE public.absences SET employee_id = emp_auth_id
    WHERE employee_id = pedro_profile_id AND company_id = company_uuid;

    RAISE NOTICE 'Pedro Jiménez Ruiz vinculado al usuario Auth empleado.demo@fycheo-demo.com';
  ELSE
    -- Si no existe el perfil, crearlo directamente con el ID del auth user
    INSERT INTO public.profiles (id, full_name, email, phone, dni_nie, created_at)
    VALUES (emp_auth_id, 'Pedro Jiménez Ruiz', 'empleado.demo@fycheo-demo.com', '+34 611 001 001', '45678901D', NOW() - INTERVAL '12 months');

    -- Vincularlo a la empresa
    INSERT INTO public.company_members (user_id, company_id, role, accepted)
    SELECT emp_auth_id, company_uuid, 'employee', true
    WHERE company_uuid IS NOT NULL
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Perfil creado y vinculado.';
  END IF;
END $$;
