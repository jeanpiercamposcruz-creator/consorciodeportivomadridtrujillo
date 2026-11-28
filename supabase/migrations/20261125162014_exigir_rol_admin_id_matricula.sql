-- Evita que un JWT sin perfil pase la comprobación por comparación NULL <> 'ADM'.
create or replace function public.siguiente_id_matricula(p_anio smallint)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_prefijo text;
  v_actual integer;
  v_ultimo integer;
begin
  if p_anio is null or p_anio < 0 or p_anio > 99 then
    raise exception using errcode = '22023', message = 'Año de matrícula inválido.';
  end if;
  if coalesce(public.rol_actual(), '') <> 'ADM' then
    raise exception using errcode = '42501', message = 'Solo un administrador puede generar IDs de matrícula.';
  end if;
  v_prefijo := lpad(p_anio::text, 2, '0');
  perform pg_advisory_xact_lock(hashtextextended('matricula:' || v_prefijo, 0));
  select coalesce(max(substring(a.id from 3 for 4)::integer), 0)
    into v_actual
    from public.alumnos a
   where a.id ~ ('^' || v_prefijo || '[0-9]{4}$');
  select c.ultimo into v_ultimo
    from public.matricula_contadores c
   where c.anio = p_anio
   for update;
  v_ultimo := greatest(coalesce(v_ultimo, 0), coalesce(v_actual, 0));
  if v_ultimo >= 9999 then
    raise exception using errcode = '22003', message = 'Se agotaron los IDs disponibles para este año.';
  end if;
  v_ultimo := v_ultimo + 1;
  insert into public.matricula_contadores(anio, ultimo, updated_at)
  values (p_anio, v_ultimo, now())
  on conflict (anio) do update set ultimo = excluded.ultimo, updated_at = now();
  return v_prefijo || lpad(v_ultimo::text, 4, '0');
end;
$function$;
