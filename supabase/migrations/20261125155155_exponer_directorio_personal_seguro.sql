-- Sustituye la vista SECURITY DEFINER por una función RPC que devuelve solo campos públicos.
drop view if exists public.personal_publico;
create or replace function public.personal_directorio()
returns table (id text,nombres text,rol text,especialidad text,activo smallint,foto text)
language sql stable security definer set search_path = pg_catalog, public
as $$ select p.id,p.nombres,p.rol,p.especialidad,p.activo,p.foto from public.personal p order by p.nombres,p.id $$;
revoke all on function public.personal_directorio() from public, anon;
grant execute on function public.personal_directorio() to authenticated;
