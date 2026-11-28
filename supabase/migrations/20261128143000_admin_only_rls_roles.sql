-- El único rol con acceso funcional al ERP es ADM.
-- REC/ENT pueden permanecer en datos históricos, pero jamás conceden permisos.
-- El pre-registro público conserva su vía anon limitada; no es un rol de acceso ERP.

BEGIN;

CREATE OR REPLACE FUNCTION public.rol_actual()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT CASE WHEN p.rol = 'ADM' THEN 'ADM'::text ELSE NULL::text END
  FROM public.perfiles AS p
  WHERE p.user_id = auth.uid()
$function$;

-- Los vínculos de personal/horarios no deben abrir rutas indirectas a REC/ENT.
CREATE OR REPLACE FUNCTION public.mi_personal()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT personal_id
  FROM public.perfiles
  WHERE user_id = auth.uid()
    AND rol = 'ADM'
$function$;

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
  FROM public.personal AS p
  WHERE public.rol_actual() = 'ADM'
  ORDER BY p.nombres, p.id
$function$;

-- Alumnos: lectura y escritura exclusivamente ADM.
ALTER POLICY esc_alumnos_delete ON public.alumnos
  USING (public.rol_actual() = 'ADM');
ALTER POLICY esc_alumnos_insert ON public.alumnos
  WITH CHECK (public.rol_actual() = 'ADM');
ALTER POLICY esc_alumnos_update ON public.alumnos
  USING (public.rol_actual() = 'ADM')
  WITH CHECK (public.rol_actual() = 'ADM');
ALTER POLICY lee_alumnos ON public.alumnos
  USING (public.rol_actual() = 'ADM');

-- Asistencia, caja, cuotas y ventas: sin excepciones REC/ENT.
ALTER POLICY asis_por_rol ON public.asistencias
  USING (public.rol_actual() = 'ADM')
  WITH CHECK (public.rol_actual() = 'ADM');
ALTER POLICY acc_caja_movimientos ON public.caja_movimientos
  USING (public.rol_actual() = 'ADM')
  WITH CHECK (public.rol_actual() = 'ADM');
ALTER POLICY acc_cronograma_cuotas ON public.cronograma_cuotas
  USING (public.rol_actual() = 'ADM')
  WITH CHECK (public.rol_actual() = 'ADM');
ALTER POLICY acc_kits_ventas ON public.kits_ventas
  USING (public.rol_actual() = 'ADM')
  WITH CHECK (public.rol_actual() = 'ADM');

-- Lecturas de catálogos/datos internos autenticados también quedan solo ADM.
ALTER POLICY lee_ajustes ON public.ajustes
  USING (public.rol_actual() = 'ADM');
ALTER POLICY lee_deportes ON public.deportes
  USING (public.rol_actual() = 'ADM');
ALTER POLICY lee_meta ON public.erp_meta
  USING (public.rol_actual() = 'ADM');
ALTER POLICY lee_horario_profesores ON public.horario_profesores
  USING (public.rol_actual() = 'ADM');
ALTER POLICY lee_horarios ON public.horarios
  USING (public.rol_actual() = 'ADM');
ALTER POLICY lee_personal ON public.personal
  USING (public.rol_actual() = 'ADM');
ALTER POLICY lee_sedes ON public.sedes
  USING (public.rol_actual() = 'ADM');

-- Los catálogos anon de sedes/deportes se conservan para el formulario público.
-- Los documentos ERP solo son accesibles por ADM; se mantiene la subida anon
-- restringida a rutas de pre-registro y límites MIME/tamaño del bucket.
ALTER POLICY documentos_adm_rec_delete ON storage.objects
  USING (bucket_id = 'documentos' AND public.rol_actual() = 'ADM');
ALTER POLICY documentos_adm_rec_insert ON storage.objects
  WITH CHECK (bucket_id = 'documentos' AND public.rol_actual() = 'ADM');
ALTER POLICY documentos_adm_rec_select ON storage.objects
  USING (bucket_id = 'documentos' AND public.rol_actual() = 'ADM');
DROP POLICY IF EXISTS documentos_prereg_authenticated_insert ON storage.objects;

-- El pre-registro anónimo sigue permitido por pre_anon_insert.
-- La vía authenticated se reserva a ADM.
ALTER POLICY pre_authenticated_insert ON public.preregistros
  WITH CHECK (public.rol_actual() = 'ADM');

COMMIT;
