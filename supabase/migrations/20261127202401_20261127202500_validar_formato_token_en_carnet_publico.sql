CREATE OR REPLACE FUNCTION public.carnet_publico(t text)
RETURNS TABLE(
  codigo text,
  nombres text,
  apellidos text,
  categoria integer,
  deporte text,
  sede text,
  estado text,
  foto text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT
    a.id,
    a.nombres,
    a.apellidos,
    extract(year from a.fecha_nacimiento)::int,
    d.nombre,
    s.nombre,
    a.estado,
    a.foto
  FROM public.alumnos a
  LEFT JOIN public.deportes d ON d.id = a.deporte_id
  LEFT JOIN public.sedes s ON s.id = a.sede_id
  WHERE t ~ '^[a-z0-9]{16}$'
    AND a.qr_token = t
$function$;