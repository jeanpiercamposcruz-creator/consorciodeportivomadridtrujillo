-- Protege la relación profesor-sede-horario también cuando se escribe directamente en Supabase.
-- No modifica ni elimina asignaciones históricas; solo valida INSERT/UPDATE futuros.
create unique index if not exists horario_profesores_horario_personal_uidx
  on public.horario_profesores (horario_id, personal_id);

create or replace function public.fn_validar_asignacion_profesor_horario()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sede_id text;
  v_permite_varias boolean;
  v_estado text;
begin
  -- Serializa las asignaciones de cada profesor para evitar carreras concurrentes.
  perform pg_advisory_xact_lock(hashtextextended(new.personal_id, 0));

  select h.sede_id, coalesce(h.estado, 'Activo')
    into v_sede_id, v_estado
    from public.horarios h
   where h.id = new.horario_id;

  if not found then
    raise exception using errcode = '23503',
      message = 'El horario seleccionado no existe.';
  end if;

  if v_estado <> 'Activo' then
    raise exception using errcode = '23514',
      message = 'No se puede asignar un profesor a un horario inactivo.';
  end if;

  select coalesce(p.permite_varias_sedes, false)
    into v_permite_varias
    from public.personal p
   where p.id = new.personal_id;

  if not found then
    raise exception using errcode = '23503',
      message = 'El profesor seleccionado no existe.';
  end if;

  if not exists (
    select 1
      from public.personal_sedes ps
     where ps.personal_id = new.personal_id
       and ps.sede_id = v_sede_id
  ) then
    raise exception using errcode = '23514',
      message = 'El profesor no está vinculado a la sede del horario.';
  end if;

  if not v_permite_varias and exists (
    select 1
      from public.horario_profesores hp
      join public.horarios h on h.id = hp.horario_id
     where hp.personal_id = new.personal_id
       and hp.id <> new.id
       and h.estado is distinct from 'Inactivo'
       and h.sede_id <> v_sede_id
  ) then
    raise exception using errcode = '23514',
      message = 'El profesor no tiene permitido dictar en varias sedes.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_asignacion_profesor_horario
  on public.horario_profesores;

create trigger trg_validar_asignacion_profesor_horario
before insert or update of horario_id, personal_id
on public.horario_profesores
for each row
execute function public.fn_validar_asignacion_profesor_horario();
