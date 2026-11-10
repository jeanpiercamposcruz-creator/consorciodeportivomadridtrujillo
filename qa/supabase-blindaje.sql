-- =====================================================================================
-- PLANTILLA de blindaje para Supabase (ERP CDMT)         *** NO PROBADA contra tu base ***
-- Los nombres de tablas/columnas salen del mapeo TB de public/script.js; el repo NO incluye
-- tu SQL real ni tus políticas actuales. Ejecuta primero en una copia/branch de la base,
-- revisa `select * from pg_policies;` y adapta (p. ej. si ya tienes roles REC/ENT).
-- =====================================================================================

-- 0) AUDITORÍA RÁPIDA: ¿qué tablas NO tienen RLS?  (cualquier fila con false es un hueco)
select schemaname, tablename, rowsecurity from pg_tables where schemaname = 'public' order by 3, 2;
select * from pg_policies where schemaname in ('public', 'storage') order by tablename, policyname;

-- 1) Función de rol (SECURITY DEFINER: lee perfiles sin exponerlo)
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'ADM');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 2) RLS en TODAS las tablas del ERP: solo ADM autenticado (el chequeo de rol del navegador
--    en sess() es cosmético: lo que protege es esto)
do $$ declare t text; begin
  foreach t in array array['sedes','deportes','personal','horarios','horario_profesores','alumnos',
                           'asistencias','kits_ventas','caja_movimientos','ajustes','erp_meta','perfiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists adm_all on public.%I', t);
    execute format('create policy adm_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- La anon key NO debe poder tocar tablas internas
revoke all on all tables in schema public from anon;

-- 3) Pre-registro público (único INSERT permitido a anon) + validación EN SERVIDOR
alter table public.preregistros enable row level security;
revoke all on public.preregistros from anon;
grant insert on public.preregistros to anon;
drop policy if exists pre_insert_anon on public.preregistros;
create policy pre_insert_anon on public.preregistros for insert to anon with check (true);
drop policy if exists pre_admin_all on public.preregistros;
create policy pre_admin_all on public.preregistros for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- "not valid" = no revisa filas viejas; luego `alter table ... validate constraint ...`
alter table public.preregistros
  add constraint pre_nombres check (char_length(nombres) between 1 and 60 and char_length(apellidos) between 1 and 60) not valid,
  add constraint pre_dni     check (dni is null or dni ~ '^[0-9]{8}$') not valid,
  add constraint pre_cel     check (celular_apoderado is null or celular_apoderado ~ '^[0-9]{1,9}$') not valid,
  add constraint pre_nac     check (fecha_nacimiento::text ~ '^\d{4}-\d{2}-\d{2}$') not valid,
  add constraint pre_modal   check (modalidad in ('Presencial','Virtual')) not valid,
  add constraint pre_foto    check (foto is null or (octet_length(foto) <= 300000 and foto ~ '^data:image/(jpeg|png);base64,')) not valid,
  add constraint pre_docs    check (
      (doc_dni_frente is null or doc_dni_frente ~ '^preregistro/[a-z0-9]+/dni-[0-9]+\.(jpg|png|pdf)$') and
      (doc_seguro     is null or doc_seguro     ~ '^preregistro/[a-z0-9]+/seguro-[0-9]+\.(jpg|png|pdf)$') and
      (doc_ficha      is null or doc_ficha      ~ '^preregistro/[a-z0-9]+/ficha-[0-9]+\.(jpg|png|pdf)$')) not valid;

-- Freno global anti-inundación (no distingue IP; para CAPTCHA/rate-limit por IP usa una Edge Function)
-- Supone que preregistros.fecha_hora es timestamptz con default now().
create or replace function public.pre_throttle() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.preregistros where fecha_hora > now() - interval '1 minute') >= 20 then
    raise exception 'Demasiados pre-registros en el último minuto. Intenta de nuevo en un momento.';
  end if;
  return new;
end $$;
drop trigger if exists pre_throttle on public.preregistros;
create trigger pre_throttle before insert on public.preregistros for each row execute function public.pre_throttle();

-- 4) Storage: tamaño y tipo se imponen en el BUCKET (el límite de 5 MB del navegador es evitable)
update storage.buckets
   set public = false, file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','application/pdf']
 where id = 'documentos';
drop policy if exists doc_anon_insert on storage.objects;
create policy doc_anon_insert on storage.objects for insert to anon
  with check (bucket_id = 'documentos' and name ~ '^preregistro/[a-z0-9]+/(dni|seguro|ficha)-[0-9]+\.(jpg|png|pdf)$');
drop policy if exists doc_admin_all on storage.objects;
create policy doc_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'documentos' and public.is_admin()) with check (bucket_id = 'documentos' and public.is_admin());

-- 5) RPC pública del carnet: que devuelva solo lo imprescindible y que solo anon/authenticated la ejecuten
--    (revisa el cuerpo de public.carnet_publico: nunca DNI, celular, correo ni documentos de menores)
-- revoke all on function public.carnet_publico(text) from public;
-- grant execute on function public.carnet_publico(text) to anon, authenticated;

-- 6) PRUEBAS NEGATIVAS (ejecútalas con la anon key, SIN iniciar sesión; todas deben fallar o devolver 0 filas):
--    GET    /rest/v1/alumnos?select=*           -> []  o 401/403
--    PATCH  /rest/v1/caja_movimientos?id=eq.x   -> 401/403
--    DELETE /rest/v1/sedes?id=eq.SED-CSJ        -> 401/403
--    POST   /rest/v1/preregistros  {dni:"abc"}  -> 400/23514 (check)
--    POST   /storage/v1/object/documentos/alumnos/x.pdf (fuera de preregistro/) -> 403
