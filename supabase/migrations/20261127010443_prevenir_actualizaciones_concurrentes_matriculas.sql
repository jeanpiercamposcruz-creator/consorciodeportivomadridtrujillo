-- Evita que dos sesiones sobrescriban pagos de una misma matrícula
-- usando un estado desactualizado. El cliente adjunta el monto_pagado que leyó;
-- la RPC lo compara con la fila actual bajo bloqueo antes de aceptar el lote.
CREATE OR REPLACE FUNCTION public.erp_persistir_lote(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_name text;
  v_insert jsonb;
  v_update jsonb;
  v_delete jsonb;
  v_set text;
  v_rel regclass;
  v_ids text[];
  v_row jsonb;
  v_actual numeric;
  v_esperado numeric;
BEGIN
  -- La autorización de cada tabla sigue dependiendo de sus políticas RLS.
  -- ADM administra todo; REC opera matrículas, cuotas, ventas, asistencia y Caja
  -- según sus políticas; ENT solo puede persistir asistencia en sus horarios.
  IF coalesce(public.rol_actual(), '') NOT IN ('ADM', 'REC', 'ENT') THEN
    RAISE EXCEPTION USING errcode = '42501',
      message = 'El rol no tiene permiso para persistir este lote ERP.';
  END IF;

  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'El lote ERP debe ser un arreglo JSON.';
  END IF;

  -- Inserciones y actualizaciones respetan el orden padre -> hijo de TB.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_payload) WITH ORDINALITY ORDER BY ordinality
  LOOP
    v_name := v_item->>'name';
    IF v_name IS NULL OR v_name <> ALL(ARRAY[
      'centros_costo','sedes','deportes','contratos_alquiler','personal',
      'personal_sedes','personal_certificaciones','horarios','horario_profesores',
      'alumnos','cronograma_cuotas','asistencias','kits_ventas','caja_movimientos','ajustes'
    ]) THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'Tabla no autorizada en lote ERP.';
    END IF;

    v_insert := coalesce(v_item->'insert','[]'::jsonb);
    v_update := coalesce(v_item->'update','[]'::jsonb);
    v_delete := coalesce(v_item->'delete','[]'::jsonb);
    IF jsonb_typeof(v_insert) IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_update) IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_delete) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'Cada operación del lote debe ser un arreglo JSON.';
    END IF;

    v_rel := to_regclass(format('public.%I', v_name));
    IF v_rel IS NULL THEN
      IF jsonb_array_length(v_insert) > 0 OR jsonb_array_length(v_update) > 0 OR jsonb_array_length(v_delete) > 0 THEN
        RAISE EXCEPTION USING errcode = '42P01', message = format('No existe la tabla ERP %s.', v_name);
      END IF;
      CONTINUE;
    END IF;

    -- Compare-and-set para alumnos: bloquea la fila y rechaza un cliente
    -- cuyo snapshot de monto_pagado ya quedó obsoleto en otra sesión.
    -- Esto impide que el lote inserte Caja si la ficha ya cambió.
    IF v_name = 'alumnos' AND jsonb_array_length(v_update) > 0 THEN
      FOR v_row IN SELECT value FROM jsonb_array_elements(v_update)
      LOOP
        IF v_row ? '__expected_monto_pagado' THEN
          v_esperado := nullif(v_row->>'__expected_monto_pagado', '')::numeric;
          SELECT monto_pagado
            INTO v_actual
            FROM public.alumnos
           WHERE id = v_row->>'id'
           FOR UPDATE;

          IF NOT FOUND OR v_actual IS DISTINCT FROM v_esperado THEN
            RAISE EXCEPTION USING errcode = '40001',
              message = 'La matrícula fue modificada en otra sesión. Recarga los datos antes de guardar.';
          END IF;
        END IF;
      END LOOP;
    END IF;

    IF jsonb_array_length(v_insert) > 0 THEN
      EXECUTE format(
        'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)',
        v_name, v_name
      ) USING v_insert;
    END IF;

    IF jsonb_array_length(v_update) > 0 THEN
      SELECT string_agg(format('%I = EXCLUDED.%I', a.attname, a.attname), ',')
        INTO v_set
        FROM pg_attribute a
       WHERE a.attrelid = v_rel
         AND a.attnum > 0
         AND NOT a.attisdropped
         AND a.attname <> 'id';
      IF v_set IS NULL THEN
        RAISE EXCEPTION USING errcode = '22023', message = format('La tabla %s no tiene columnas actualizables.', v_name);
      END IF;
      EXECUTE format(
        'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict (id) do update set %s',
        v_name, v_name, v_set
      ) USING v_update;
    END IF;
  END LOOP;

  -- Borrados en orden hijo -> padre para respetar las claves foráneas.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_payload) WITH ORDINALITY ORDER BY ordinality DESC
  LOOP
    v_name := v_item->>'name';
    v_delete := coalesce(v_item->'delete','[]'::jsonb);
    IF jsonb_array_length(v_delete) > 0 THEN
      SELECT array_agg(value) INTO v_ids FROM jsonb_array_elements_text(v_delete) AS x(value);
      EXECUTE format('delete from public.%I where id = any($1)', v_name) USING v_ids;
    END IF;
  END LOOP;
END;
$function$;
