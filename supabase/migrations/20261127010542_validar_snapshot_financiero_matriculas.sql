-- Amplía la protección concurrente a todos los importes y términos del contrato.
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
  v_actual_finanzas jsonb;
  v_esperado_finanzas jsonb;
BEGIN
  IF coalesce(public.rol_actual(), '') NOT IN ('ADM', 'REC', 'ENT') THEN
    RAISE EXCEPTION USING errcode = '42501',
      message = 'El rol no tiene permiso para persistir este lote ERP.';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'El lote ERP debe ser un arreglo JSON.';
  END IF;
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

    -- Compare-and-set de finanzas: bloquea la fila y compara el snapshot
    -- que leyó la interfaz con los cuatro campos financieros vigentes.
    IF v_name = 'alumnos' AND jsonb_array_length(v_update) > 0 THEN
      FOR v_row IN SELECT value FROM jsonb_array_elements(v_update)
      LOOP
        IF v_row ? '__expected_finanzas' THEN
          v_esperado_finanzas := v_row->'__expected_finanzas';
          SELECT jsonb_build_object(
                   'monto_pagado', monto_pagado,
                   'costo_matricula', costo_matricula,
                   'costo_mensualidad', costo_mensualidad,
                   'meses', meses
                 )
            INTO v_actual_finanzas
            FROM public.alumnos
           WHERE id = v_row->>'id'
           FOR UPDATE;
          IF NOT FOUND OR v_actual_finanzas IS DISTINCT FROM v_esperado_finanzas THEN
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
