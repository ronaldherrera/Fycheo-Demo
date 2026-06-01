-- ================================================================
-- FYCHEO DEMO — Tabla de acceso por invitación
-- ================================================================
-- Ejecuta esto en el SQL Editor del proyecto Supabase demo
-- Después añade emails desde Table Editor > demo_access > Insert row
-- ================================================================

CREATE TABLE IF NOT EXISTS public.demo_access (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  company    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Añade aquí los primeros emails con acceso:
INSERT INTO public.demo_access (email, name, company) VALUES
  ('ronaldcalzadilla31@gmail.com', 'Ronald', 'Fycheo')
ON CONFLICT (email) DO NOTHING;
