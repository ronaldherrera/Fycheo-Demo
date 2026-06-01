-- =============================================================
-- FYCHEO DEMO — PASO 4: Turnos y Fichajes (12 meses de historial)
-- Genera datos realistas de lunes a viernes
-- =============================================================
-- Ejecuta este script DESPUÉS de 03_demo_employees.sql
-- Tarda ~10-30 segundos en ejecutarse
-- =============================================================

DO $$
DECLARE
  company_uuid UUID;
  emp_record RECORD;
  emp_ids UUID[];
  d DATE;
  d_start DATE;
  d_end DATE;
  day_of_week INT;

  -- Variables de tiempo
  start_h INT;
  start_m INT;
  end_h INT;
  end_m INT;
  break_start_h INT;
  break_end_h INT;

  -- Shift color/type selection
  shift_color TEXT;
  shift_start TEXT;
  shift_end TEXT;
  shift_name TEXT;
  rand_val FLOAT;

  -- IDs generados
  shift_id UUID;
  entry_id UUID;
  clockin_time TIMESTAMPTZ;
  clockout_time TIMESTAMPTZ;
  break_s_time TIMESTAMPTZ;
  break_e_time TIMESTAMPTZ;

  -- Para calcular ausencias
  absence_chance FLOAT;
  absence_type TEXT;
  absence_days INT;

BEGIN
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Distribuciones Martínez S.A.' LIMIT 1;
  IF company_uuid IS NULL THEN
    RAISE EXCEPTION 'Empresa no encontrada.';
  END IF;

  -- Obtener todos los empleados de la empresa
  SELECT ARRAY_AGG(user_id) INTO emp_ids
  FROM public.company_members
  WHERE company_id = company_uuid AND role = 'employee';

  IF emp_ids IS NULL OR array_length(emp_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No hay empleados. Ejecuta 03_demo_employees.sql primero.';
  END IF;

  -- Rango de fechas: 12 meses atrás hasta ayer
  d_start := CURRENT_DATE - INTERVAL '12 months';
  d_end := CURRENT_DATE - INTERVAL '1 day';

  RAISE NOTICE 'Generando turnos y fichajes del % al % para % empleados...',
    d_start, d_end, array_length(emp_ids, 1);

  -- Bucle por cada empleado
  FOREACH entry_id IN ARRAY emp_ids
  LOOP
    d := d_start;

    WHILE d <= d_end LOOP
      day_of_week := EXTRACT(DOW FROM d); -- 0=domingo, 6=sábado

      -- Solo días laborables (lunes-viernes)
      IF day_of_week BETWEEN 1 AND 5 THEN

        rand_val := random();

        -- 5% de probabilidad de ausencia planificada en días laborables
        IF rand_val < 0.05 THEN
          -- No crear turno ni fichaje ese día (ya hay una ausencia)
          -- (las ausencias se crean en el paso 05)
          NULL;

        -- 3% de probabilidad de no fichar (ausencia sin justificar)
        ELSIF rand_val < 0.08 THEN
          -- Solo crear turno programado, sin fichaje
          shift_color := (ARRAY['#3b82f6', '#10b981', '#8b5cf6'])[floor(random()*3+1)::int];

          IF shift_color = '#3b82f6' THEN
            shift_start := '06:00'; shift_end := '14:00';
          ELSIF shift_color = '#10b981' THEN
            shift_start := '08:00'; shift_end := '17:00';
          ELSE
            shift_start := '14:00'; shift_end := '22:00';
          END IF;

          INSERT INTO public.shifts (id, employee_id, company_id, date, start_time, end_time, color, status, is_published)
          VALUES (gen_random_uuid(), entry_id, company_uuid, d, shift_start, shift_end, shift_color, 'absent', true);

        ELSE
          -- Día normal: crear turno + fichajes

          -- Asignar turno según equipo del empleado (simplificado: aleatorio)
          rand_val := random();
          IF rand_val < 0.35 THEN
            -- Turno mañana
            shift_color := '#3b82f6';
            shift_start := '06:00'; shift_end := '14:00';
            start_h := 6; start_m := (floor(random()*15)::int);
            end_h := 14; end_m := (floor(random()*20)::int);
            break_start_h := 10; break_end_h := 10;
          ELSIF rand_val < 0.70 THEN
            -- Jornada completa
            shift_color := '#10b981';
            shift_start := '08:00'; shift_end := '17:00';
            start_h := 8; start_m := (floor(random()*20)::int);
            end_h := 17; end_m := (floor(random()*20)::int);
            break_start_h := 13; break_end_h := 14;
          ELSE
            -- Turno tarde
            shift_color := '#f59e0b';
            shift_start := '14:00'; shift_end := '22:00';
            start_h := 14; start_m := (floor(random()*15)::int);
            end_h := 22; end_m := (floor(random()*15)::int);
            break_start_h := 18; break_end_h := 18;
          END IF;

          shift_id := gen_random_uuid();

          INSERT INTO public.shifts (id, employee_id, company_id, date, start_time, end_time, color, status, is_published)
          VALUES (shift_id, entry_id, company_uuid, d, shift_start, shift_end, shift_color, 'completed', true);

          -- Calcular timestamps de fichaje
          clockin_time := (d::TEXT || 'T' || LPAD(start_h::TEXT, 2, '0') || ':' || LPAD(start_m::TEXT, 2, '0') || ':00+01:00')::TIMESTAMPTZ;
          clockout_time := (d::TEXT || 'T' || LPAD(end_h::TEXT, 2, '0') || ':' || LPAD(end_m::TEXT, 2, '0') || ':00+01:00')::TIMESTAMPTZ;
          break_s_time := (d::TEXT || 'T' || LPAD(break_start_h::TEXT, 2, '0') || ':' || LPAD((30 + floor(random()*20)::int)::TEXT, 2, '0') || ':00+01:00')::TIMESTAMPTZ;
          break_e_time := break_s_time + INTERVAL '30 minutes' + (floor(random()*20) || ' minutes')::INTERVAL;

          -- Insertar fichajes
          INSERT INTO public.time_entries (id, user_id, company_id, entry_type, occurred_at, status)
          VALUES
            (gen_random_uuid(), entry_id, company_uuid, 'clock-in',    clockin_time,  'approved'),
            (gen_random_uuid(), entry_id, company_uuid, 'break-start', break_s_time,  'approved'),
            (gen_random_uuid(), entry_id, company_uuid, 'break-end',   break_e_time,  'approved'),
            (gen_random_uuid(), entry_id, company_uuid, 'clock-out',   clockout_time, 'approved');

        END IF;
      END IF;

      d := d + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Turnos y fichajes generados correctamente.';
END $$;
