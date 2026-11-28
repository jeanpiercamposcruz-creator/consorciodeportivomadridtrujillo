-- Elimina únicamente políticas RLS idénticas; se conserva la política adm_total.
drop policy if exists adm_total_centros_costo on public.centros_costo;
drop policy if exists adm_total_contratos_alquiler on public.contratos_alquiler;
drop policy if exists adm_total_cronograma_cuotas on public.cronograma_cuotas;
drop policy if exists adm_total_personal_certificaciones on public.personal_certificaciones;
drop policy if exists adm_total_personal_sedes on public.personal_sedes;
