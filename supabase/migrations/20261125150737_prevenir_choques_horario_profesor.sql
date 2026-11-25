-- Impide que un profesor quede asignado a dos horarios activos simultáneos.
-- También valida cambios de día/hora en horarios que ya tienen profesores.
create or replace function public.fn_validar_asignacion_profesor_horario()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sede_id text;
  v_permite_varias boolean;
  v_estado text;
  v_dia text;
  v_inicio time;
  v_fin time;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.personal_id, 0));

  select h.sede_id, coalesce(h.estado, 'Activo'), h.dia_semana,
         nullif(h.hora_inicio, '')::time, nullif(h.hora_fin, '')::time
    into v_sede_id, v_estado, v_dia, v_inicio, v_fin
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

  if v_inicio is null or v_fin is null or v_fin <= v_inicio then
    raise exception using errcode = '23514',
      message = 'El horario debe tener un rango de horas válido.';
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
    select 1 from public.personal_sedes ps
     where ps.personal_id = new.personal_id and ps.sede_id = v_sede_id
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

  if exists (
    select 1
      from public.horario_profesores hp
      join public.horarios h on h.id = hp.horario_id
     where hp.personal_id = new.personal_id
       and hp.id <> new.id
       and h.estado is distinct from 'Inactivo'
       and h.dia_semana = v_dia
       and nullif(h.hora_inicio, '')::time < v_fin
       and v_inicio < nullif(h.hora_fin, '')::time
  ) then
    raise exception using errcode = '23514',
      message = 'El profesor ya tiene otro horario activo que se cruza con este horario.';
  end if;

  return new;
end;
$$;

create or replace function public.fn_validar_cambio_sede_horario()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_permite_varias boolean;
  v_inicio time;
  v_fin time;
begin
  if new.estado = 'Inactivo' then
    return new;
  end if;

  if new.sede_id is not distinct from old.sede_id
     and new.estado is not distinct from old.estado
     and new.dia_semana is not distinct from old.dia_semana
     and new.hora_inicio is not distinct from old.hora_inicio
     and new.hora_fin is not distinct from old.hora_fin then
    return new;
  end if;

  v_inicio := nullif(new.hora_inicio, '')::time;
  v_fin := nullif(new.hora_fin, '')::time;
  if v_inicio is null or v_fin is null or v_fin <= v_inicio then
    raise exception using errcode = '23514',
      message = 'El horario debe tener un rango de horas válido.';
  end if;

  for r in
    select hp.personal_id
      from public.horario_profesores hp
     where hp.horario_id = new.id
     order by hp.personal_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(r.personal_id, 0));

    if not exists (
      select 1 from public.personal_sedes ps
       where ps.personal_id = r.personal_id and ps.sede_id = new.sede_id
    ) then
      raise exception using errcode = '23514',
        message = 'No se puede activar o cambiar la sede: un profesor no está vinculado a la nueva sede.';
    end if;

    select coalesce(p.permite_varias_sedes, false)
      into v_permite_varias
      from public.personal p
     where p.id = r.personal_id;

    if not v_permite_varias and exists (
      select 1
        from public.horario_profesores hp2
        join public.horarios h2 on h2.id = hp2.horario_id
       where hp2.personal_id = r.personal_id
         and hp2.horario_id <> new.id
         and h2.estado is distinct from 'Inactivo'
         and h2.sede_id <> new.sede_id
    ) then
      raise exception using errcode = '23514',
        message = 'No se puede activar o cambiar la sede: el profesor no tiene permitido dictar en varias sedes.';
    end if;

    if exists (
      select 1
        from public.horario_profesores hp2
        join public.horarios h2 on h2.id = hp2.horario_id
       where hp2.personal_id = r.personal_id
         and hp2.horario_id <> new.id
         and h2.estado is distinct from 'Inactivo'
         and h2.dia_semana = new.dia_semana
         and nullif(h2.hora_inicio, '')::time < v_fin
         and v_inicio < nullif(h2.hora_fin, '')::time
    ) then
      raise exception using errcode = '23514',
        message = 'El cambio produciría un cruce con otro horario activo del profesor.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_validar_cambio_sede_horario on public.horarios;
create trigger trg_validar_cambio_sede_horario
before update of sede_id, estado, dia_semana, hora_inicio, hora_fin
on public.horarios
for each row
execute function public.fn_validar_cambio_sede_horario();
