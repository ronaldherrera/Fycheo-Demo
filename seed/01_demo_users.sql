-- =============================================================
-- FYCHEO DEMO — PASO 1: Usuarios Demo
-- Distribuciones Martínez S.A.
-- =============================================================
-- INSTRUCCIONES:
-- 1. Ejecuta este script en el SQL Editor de tu proyecto Supabase demo
-- 2. Luego ejecuta 02_demo_company.sql, 03_demo_employees.sql, etc.
-- 3. Crea las contraseñas manualmente en Auth > Users o usa la API
-- =============================================================

-- Usuarios que necesitas crear en Supabase Auth (Dashboard > Authentication > Users):
--
-- Email: demo.admin@fycheo-demo.com     | Password: FycheoDemo2024! | Role: Admin (dueño empresa)
-- Email: demo.manager@fycheo-demo.com   | Password: FycheoDemo2024! | Role: Manager
-- Email: demo.rrhh@fycheo-demo.com      | Password: FycheoDemo2024! | Role: RRHH

-- Después de crear los usuarios en Auth, apunta sus UUIDs y úsalos en el script 02.
-- Puedes obtenerlos con:
-- SELECT id, email FROM auth.users WHERE email LIKE '%fycheo-demo%';

-- -------------------------------------------------------
-- Perfiles (se crean automáticamente por el trigger)
-- Pero actualizamos los datos con este UPDATE:
-- -------------------------------------------------------

-- NOTA: Reemplaza los UUIDs con los reales de tu proyecto

DO $$
DECLARE
  admin_id UUID;
  manager_id UUID;
  rrhh_id UUID;
BEGIN
  -- Obtener IDs de los usuarios demo
  SELECT id INTO admin_id FROM auth.users WHERE email = 'demo.admin@fycheo-demo.com';
  SELECT id INTO manager_id FROM auth.users WHERE email = 'demo.manager@fycheo-demo.com';
  SELECT id INTO rrhh_id FROM auth.users WHERE email = 'demo.rrhh@fycheo-demo.com';

  -- Actualizar perfiles
  IF admin_id IS NOT NULL THEN
    UPDATE public.profiles SET
      full_name = 'Carlos Martínez García',
      phone = '+34 666 123 456',
      dni_nie = '12345678A'
    WHERE id = admin_id;
  END IF;

  IF manager_id IS NOT NULL THEN
    UPDATE public.profiles SET
      full_name = 'Ana López Fernández',
      phone = '+34 677 234 567',
      dni_nie = '23456789B'
    WHERE id = manager_id;
  END IF;

  IF rrhh_id IS NOT NULL THEN
    UPDATE public.profiles SET
      full_name = 'Miguel Sánchez Torres',
      phone = '+34 688 345 678',
      dni_nie = '34567890C'
    WHERE id = rrhh_id;
  END IF;
END $$;
