-- Una única lectura de estado reduce la presión sobre el pool PostgREST.
-- SECURITY INVOKER conserva los permisos y políticas RLS del usuario autenticado.
CREATE OR REPLACE FUNCTION public.erp_obtener_lote()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_rol text := public.rol_actual();
  v_nombre text;
  v_filas jsonb;
  v_resultado jsonb := '{}'::jsonb;
  v_tablas text[] := ARRAY[
    'centros_costo','sedes','deportes','contratos_alquiler','personal',
    'personal_sedes','personal_certificaciones','horarios','horario_profesores',
    'alumnos','cronograma_cuotas','asistencias','kits_ventas','caja_movimientos','ajustes'
  ];
BEGIN
  IF coalesce(v_rol, '') NOT IN ('ADM','REC','ENT') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'La sesión no tiene permiso para cargar el estado del ERP.';
  END IF;

  FOREACH v_nombre IN ARRAY v_tablas LOOP
    IF to_regclass(format('public.%I', v_nombre)) IS NULL THEN
      v_filas := '[]'::jsonb;
    ELSIF v_nombre = 'personal' AND v_rol <> 'ADM' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb)
        INTO v_filas
        FROM public.personal_directorio() AS p;
    ELSE
      EXECUTE format(
        'SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), ''[]''::jsonb) FROM public.%I AS t',
        v_nombre
      ) INTO v_filas;
    END IF;
    v_resultado := v_resultado || jsonb_build_object(v_nombre, coalesce(v_filas, '[]'::jsonb));
  END LOOP;

  RETURN v_resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.erp_obtener_lote() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_obtener_lote() TO authenticated;
