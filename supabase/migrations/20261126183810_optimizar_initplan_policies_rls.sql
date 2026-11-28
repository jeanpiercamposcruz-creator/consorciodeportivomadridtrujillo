ALTER POLICY ver_perfil ON public.perfiles
  USING (user_id = (select auth.uid()) OR rol_actual() = 'ADM');

ALTER POLICY adm_total ON public.centros_costo
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'));

ALTER POLICY adm_total ON public.contratos_alquiler
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'));

ALTER POLICY adm_total ON public.personal_sedes
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'));

ALTER POLICY adm_total ON public.personal_certificaciones
  USING (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles p WHERE p.user_id = (select auth.uid()) AND p.rol = 'ADM'));
