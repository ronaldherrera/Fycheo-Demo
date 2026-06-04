-- =============================================================
-- FYCHEO DEMO — PASO 4: Turnos y Fichajes (Año 2026 completo)
-- Genera programación para todo 2026 y fichajes hasta hoy
-- =============================================================

DO $$
DECLARE
  company_uuid UUID;
  emp_ids UUID[];
  emp UUID;
  emp_email TEXT;
  team_name TEXT;
  d DATE;
  d_start DATE := '2026-01-01'::DATE;
  d_end DATE := '2026-12-31'::DATE;
  dow INT;

  -- Variables de turno
  sh_color TEXT;
  sh_start TEXT;
  sh_end TEXT;
  sh_status TEXT;
  
  -- Horas de fichaje
  ci_h INT; ci_m INT; co_h INT; co_m INT;
  br_s_h INT; br_s_m INT; br_e_h INT; br_e_m INT;
  
  -- Timestamps
  t_ci TIMESTAMPTZ; t_bs TIMESTAMPTZ; t_be TIMESTAMPTZ; t_co TIMESTAMPTZ;

  -- Ausencias programadas
  is_on_leave BOOLEAN;
  is_holiday BOOLEAN;

  -- Control de rotación
  emp_idx INT := 0;
  week_index INT;
  shift_index INT;
  
BEGIN
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Distribuciones Martínez S.A.' LIMIT 1;
  IF company_uuid IS NULL THEN
    RAISE EXCEPTION 'Empresa no encontrada.';
  END IF;

  -- Obtener todos los empleados
  SELECT ARRAY_AGG(user_id) INTO emp_ids
  FROM public.company_members
  WHERE company_id = company_uuid AND role = 'employee';

  IF emp_ids IS NULL OR array_length(emp_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No hay empleados. Ejecuta 03_demo_employees.sql primero.';
  END IF;

  RAISE NOTICE 'Generando turnos y fichajes para todo 2026 (% empleados)...', array_length(emp_ids, 1);

  -- Limpiar turnos y fichajes anteriores si los hubiera
  DELETE FROM public.shifts WHERE company_id = company_uuid;
  DELETE FROM public.time_entries WHERE company_id = company_uuid;

  -- Bucle por cada empleado
  FOREACH emp IN ARRAY emp_ids
  LOOP
    emp_idx := emp_idx + 1;

    -- Obtener email para comprobar ausencias específicas
    SELECT p.email INTO emp_email
    FROM public.profiles p
    WHERE p.id = emp;

    d := d_start;

    WHILE d <= d_end LOOP
      dow := EXTRACT(DOW FROM d); -- 0=domingo, 6=sábado

      -- Solo días laborables (lunes a viernes)
      IF dow BETWEEN 1 AND 5 THEN
        
        -- 1. Comprobar si es Festivo
        SELECT EXISTS (
          SELECT 1 FROM public.company_holidays 
          WHERE company_id = company_uuid AND date = d
        ) INTO is_holiday;

        -- 2. Comprobar si está de Vacaciones o Baja
        is_on_leave := false;
        
        -- Vacaciones de verano para todos (13 de julio al 26 de julio de 2026)
        IF d BETWEEN '2026-07-13'::DATE AND '2026-07-26'::DATE THEN
          is_on_leave := true;
        END IF;

        -- Vacaciones de Navidad para Pedro y Lucía (24 de diciembre al 31 de diciembre de 2026)
        IF (emp_email IN ('pedro.jimenez@martinez-sa.com', 'empleado.demo@fycheo-demo.com', 'lucia.castillo@martinez-sa.com')) 
           AND (d BETWEEN '2026-12-24'::DATE AND '2026-12-31'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- Baja médica de Carmen Blanco (1 de junio al 10 de junio de 2026 - ¡cubre hoy!)
        IF (emp_email = 'carmen.blanco@martinez-sa.com') 
           AND (d BETWEEN '2026-06-01'::DATE AND '2026-06-10'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- Baja médica de Sofía Morales (4 de junio al 8 de junio de 2026 - ¡cubre hoy!)
        IF (emp_email = 'sofia.morales@martinez-sa.com') 
           AND (d BETWEEN '2026-06-04'::DATE AND '2026-06-08'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- Baja médica pasada de Pedro Jiménez (9 de febrero al 13 de febrero de 2026)
        IF (emp_email IN ('pedro.jimenez@martinez-sa.com', 'empleado.demo@fycheo-demo.com')) 
           AND (d BETWEEN '2026-02-09'::DATE AND '2026-02-13'::DATE) THEN
          is_on_leave := true;
        END IF;

        -- 3. Calcular turno rotativo semanal
        week_index := EXTRACT(WEEK FROM d)::int;
        shift_index := (week_index + emp_idx) % 3;

        IF shift_index = 0 THEN
          -- Turno Mañana
          sh_color := '#3b82f6'; sh_start := '06:00'; sh_end := '14:00';
          ci_h := 6; co_h := 14; br_s_h := 10; br_e_h := 10;
          ci_m := 0; co_m := 0; br_s_m := 0; br_e_m := 30;
        ELSIF shift_index = 1 THEN
          -- Turno Tarde
          sh_color := '#f59e0b'; sh_start := '14:00'; sh_end := '22:00';
          ci_h := 14; co_h := 22; br_s_h := 18; br_e_h := 18;
          ci_m := 0; co_m := 0; br_s_m := 0; br_e_m := 30;
        ELSE
          -- Jornada Completa
          sh_color := '#10b981'; sh_start := '08:00'; sh_end := '17:00';
          ci_h := 8; co_h := 17; br_s_h := 13; br_e_h := 14;
          ci_m := 0; co_m := 0; br_s_m := 0; br_e_m := 0;
        END IF;

        -- Determinar estado del turno
        IF is_holiday OR is_on_leave THEN
          sh_status := 'absent';
        ELSIF d < '2026-06-04'::DATE THEN
          sh_status := 'completed';
        ELSE
          sh_status := 'scheduled';
        END IF;

        -- Insertar turno
        INSERT INTO public.shifts (employee_id, company_id, date, start_time, end_time, color, status, is_published)
        VALUES (emp, company_uuid, d, sh_start, sh_end, sh_color, sh_status, true);

        -- Generar fichajes en el pasado / hoy
        IF NOT is_holiday AND NOT is_on_leave THEN
          IF d < '2026-06-04'::DATE THEN
            -- Días pasados completos
            t_ci := (d::TEXT || ' ' || LPAD(ci_h::TEXT, 2, '0') || ':00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 21 - 10)::int || ' minutes')::INTERVAL;
            t_bs := (d::TEXT || ' ' || LPAD(br_s_h::TEXT, 2, '0') || ':00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 15)::int || ' minutes')::INTERVAL;
            t_be := t_bs + (br_e_h - br_s_h || ' hours')::INTERVAL + (br_e_m - br_s_m || ' minutes')::INTERVAL + (floor(random() * 6 - 3)::int || ' minutes')::INTERVAL;
            t_co := (d::TEXT || ' ' || LPAD(co_h::TEXT, 2, '0') || ':00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 21 - 10)::int || ' minutes')::INTERVAL;

            INSERT INTO public.time_entries (user_id, company_id, entry_type, occurred_at, status, description, date, entry_time, minutes, is_manual) VALUES
              (emp, company_uuid, 'clock-in',    t_ci, 'approved', 'Entrada',         d, to_char(t_ci, 'HH24:MI'), 0, false),
              (emp, company_uuid, 'break-start', t_bs, 'approved', 'Inicio descanso', d, to_char(t_bs, 'HH24:MI'), 0, false),
              (emp, company_uuid, 'break-end',   t_be, 'approved', 'Fin descanso',    d, to_char(t_be, 'HH24:MI'), 0, false),
              (emp, company_uuid, 'clock-out',   t_co, 'approved', 'Salida',          d, to_char(t_co, 'HH24:MI'), (EXTRACT(EPOCH FROM (t_co - t_ci))/60 - EXTRACT(EPOCH FROM (t_be - t_bs))/60)::integer, false);
          ELSIF d = '2026-06-04'::DATE THEN
            -- Hoy: Fichajes parciales basados en la hora actual (11:23)
            -- Turno de Mañana (06:00 - 14:00): clock-in, break-start y break-end ya ocurrieron
            IF shift_index = 0 THEN
              t_ci := (d::TEXT || ' 06:00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 11 - 5)::int || ' minutes')::INTERVAL;
              t_bs := (d::TEXT || ' 10:00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 10)::int || ' minutes')::INTERVAL;
              t_be := t_bs + '30 minutes'::INTERVAL + (floor(random() * 4 - 2)::int || ' minutes')::INTERVAL;

              INSERT INTO public.time_entries (user_id, company_id, entry_type, occurred_at, status, description, date, entry_time, minutes, is_manual) VALUES
                (emp, company_uuid, 'clock-in',    t_ci, 'approved', 'Entrada',         d, to_char(t_ci, 'HH24:MI'), 0, false),
                (emp, company_uuid, 'break-start', t_bs, 'approved', 'Inicio descanso', d, to_char(t_bs, 'HH24:MI'), 0, false),
                (emp, company_uuid, 'break-end',   t_be, 'approved', 'Fin descanso',    d, to_char(t_be, 'HH24:MI'), 0, false);
            -- Turno de Jornada Completa (08:00 - 17:00): clock-in ya ocurrió
            ELSIF shift_index = 2 THEN
              t_ci := (d::TEXT || ' 08:00:00 Europe/Madrid')::TIMESTAMPTZ + (floor(random() * 11 - 5)::int || ' minutes')::INTERVAL;

              INSERT INTO public.time_entries (user_id, company_id, entry_type, occurred_at, status, description, date, entry_time, minutes, is_manual) VALUES
                (emp, company_uuid, 'clock-in',    t_ci, 'approved', 'Entrada',         d, to_char(t_ci, 'HH24:MI'), 0, false);
            -- Turno de Tarde (14:00 - 22:00): aún no entra
            END IF;
          END IF;
        END IF;

      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Turnos y fichajes para todo 2026 generados con éxito.';
END $$;
