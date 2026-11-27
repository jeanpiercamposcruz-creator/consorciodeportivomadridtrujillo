-- Reduce policies permisivas superpuestas sin ampliar privilegios.
-- Se conserva exactamente la condición efectiva de lectura/escritura por rol.
BEGIN;

-- Tablas con SELECT más una política ALL administrativa: separar DML de SELECT.
DROP POLICY IF EXISTS esc_ajustes ON public.ajustes;
CREATE POLICY esc_ajustes_insert ON public.ajustes FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_ajustes_update ON public.ajustes FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'ADM') WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_ajustes_delete ON public.ajustes FOR DELETE TO authenticated
  USING (public.rol_actual() = 'ADM');

DROP POLICY IF EXISTS esc_alumnos ON public.alumnos;
CREATE POLICY esc_alumnos_insert ON public.alumnos FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = ANY (ARRAY['ADM','REC']));
CREATE POLICY esc_alumnos_update ON public.alumnos FOR UPDATE TO authenticated
  USING (public.rol_actual() = ANY (ARRAY['ADM','REC']))
  WITH CHECK (public.rol_actual() = ANY (ARRAY['ADM','REC']));
CREATE POLICY esc_alumnos_delete ON public.alumnos FOR DELETE TO authenticated
  USING (public.rol_actual() = ANY (ARRAY['ADM','REC']));

DROP POLICY IF EXISTS esc_deportes ON public.deportes;
CREATE POLICY esc_deportes_insert ON public.deportes FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_deportes_update ON public.deportes FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'ADM') WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_deportes_delete ON public.deportes FOR DELETE TO authenticated
  USING (public.rol_actual() = 'ADM');

DROP POLICY IF EXISTS esc_horario_profesores ON public.horario_profesores;
CREATE POLICY esc_horario_profesores_insert ON public.horario_profesores FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_horario_profesores_update ON public.horario_profesores FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'ADM') WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_horario_profesores_delete ON public.horario_profesores FOR DELETE TO authenticated
  USING (public.rol_actual() = 'ADM');

DROP POLICY IF EXISTS esc_horarios ON public.horarios;
CREATE POLICY esc_horarios_insert ON public.horarios FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_horarios_update ON public.horarios FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'ADM') WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_horarios_delete ON public.horarios FOR DELETE TO authenticated
  USING (public.rol_actual() = 'ADM');

DROP POLICY IF EXISTS esc_personal ON public.personal;
CREATE POLICY esc_personal_insert ON public.personal FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_personal_update ON public.personal FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'ADM') WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_personal_delete ON public.personal FOR DELETE TO authenticated
  USING (public.rol_actual() = 'ADM');

DROP POLICY IF EXISTS esc_sedes ON public.sedes;
CREATE POLICY esc_sedes_insert ON public.sedes FOR INSERT TO authenticated
  WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_sedes_update ON public.sedes FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'ADM') WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY esc_sedes_delete ON public.sedes FOR DELETE TO authenticated
  USING (public.rol_actual() = 'ADM');

-- Asistencias: ambas políticas ALL se combinan con OR, preservando ADM/REC
-- y ENT limitado a sus propios horarios, sin solapamientos por comando.
DROP POLICY IF EXISTS asis_adm_rec ON public.asistencias;
DROP POLICY IF EXISTS asis_ent ON public.asistencias;
CREATE POLICY asis_por_rol ON public.asistencias FOR ALL TO authenticated
  USING (
    public.rol_actual() = ANY (ARRAY['ADM','REC'])
    OR (public.rol_actual() = 'ENT' AND horario_id IN (SELECT public.mis_horarios()))
  )
  WITH CHECK (
    public.rol_actual() = ANY (ARRAY['ADM','REC'])
    OR (public.rol_actual() = 'ENT' AND horario_id IN (SELECT public.mis_horarios()))
  );

-- Preregistros: mantener inserción pública con ventana temporal y administración
-- autenticada; separar anon de authenticated elimina el solapamiento.
DROP POLICY IF EXISTS pre_admin ON public.preregistros;
DROP POLICY IF EXISTS pre_insert ON public.preregistros;
CREATE POLICY pre_admin_select ON public.preregistros FOR SELECT TO authenticated
  USING (public.rol_actual() = 'ADM');
CREATE POLICY pre_anon_insert ON public.preregistros FOR INSERT TO anon
  WITH CHECK (fecha_hora >= now() - interval '5 minutes' AND fecha_hora <= now() + interval '5 minutes');
CREATE POLICY pre_authenticated_insert ON public.preregistros FOR INSERT TO authenticated
  WITH CHECK (
    public.rol_actual() = 'ADM'
    OR (fecha_hora >= now() - interval '5 minutes' AND fecha_hora <= now() + interval '5 minutes')
  );
CREATE POLICY pre_admin_update ON public.preregistros FOR UPDATE TO authenticated
  USING (public.rol_actual() = 'ADM') WITH CHECK (public.rol_actual() = 'ADM');
CREATE POLICY pre_admin_delete ON public.preregistros FOR DELETE TO authenticated
  USING (public.rol_actual() = 'ADM');

COMMIT;
