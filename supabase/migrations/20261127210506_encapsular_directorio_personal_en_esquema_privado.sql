CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.personal_directorio()
RETURNS TABLE(
  id text,
  nombres text,
  rol text,
  especialidad text,
  activo smallint,
  foto text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT p.id, p.nombres, p.rol, p.especialidad, p.activo, p.foto
  FROM public.personal p
  WHERE coalesce(public.rol_actual(), '') IN ('ADM', 'REC', 'ENT')
  ORDER BY p.nombres, p.id
$function$;

REVOKE ALL ON FUNCTION private.personal_directorio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.personal_directorio() TO authenticated;

CREATE OR REPLACE FUNCTION public.personal_directorio()
RETURNS TABLE(
  id text,
  nombres text,
  rol text,
  especialidad text,
  activo smallint,
  foto text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT * FROM private.personal_directorio()
$function$;

REVOKE ALL ON FUNCTION public.personal_directorio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.personal_directorio() TO authenticated;

COMMENT ON FUNCTION private.personal_directorio() IS
  'Directorio reducido protegido por rol ERP; función privilegiada no expuesta al Data API.';
