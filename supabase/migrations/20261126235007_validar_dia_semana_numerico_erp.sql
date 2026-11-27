-- Alinea el formato de dia_semana con el contrato real del ERP:
-- la interfaz, el calendario y los generadores QA usan 1=lunes ... 7=domingo.
-- Se conserva NOT VALID para no alterar ni bloquear horarios históricos sin día.
alter table public.horarios
  drop constraint if exists horarios_dia_semana_valido_check;

alter table public.horarios
  add constraint horarios_dia_semana_valido_check
  check (
    dia_semana is not null
    and dia_semana ~ '^[1-7]$'
  ) not valid;

-- La asignación de profesores debe validar el mismo formato numérico que guarda el ERP.
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
    raise exception using errcode = '23503', message = 'El horario seleccionado no existe.';
  end if;
  if v_estado <> 'Activo' then
    raise exception using errcode = '23514', message = 'No se puede asignar un profesor a un horario inactivo.';
  end if;
  if v_dia is null or v_dia !~ '^[1-7]$' then
    raise exception using errcode = '23514', message = 'El horario debe tener un día numérico válido (1=lunes, 7=domingo).';
  end if;
  if v_inicio is null or v_fin is null or v_fin <= v_inicio then
    raise exception using errcode = '23514', message = 'El horario debe tener un rango de horas válido.';
  end if;

  select coalesce(p.permite_varias_sedes, false)
    into v_permite_varias
    from public.personal p
   where p.id = new.personal_id;
  if not found then
    raise exception using errcode = '23503', message = 'El profesor seleccionado no existe.';
  end if;

  if not exists (
    select 1 from public.personal_sedes ps
     where ps.personal_id = new.personal_id and ps.sede_id = v_sede_id
  ) then
    raise exception using errcode = '23514', message = 'El profesor no está vinculado a la sede del horario.';
  end if;

  if not v_permite_varias and exists (
    select 1 from public.horario_profesores hp
    join public.horarios h on h.id = hp.horario_id
    where hp.personal_id = new.personal_id and hp.id <> new.id
      and h.estado is distinct from 'Inactivo' and h.sede_id <> v_sede_id
  ) then
    raise exception using errcode = '23514', message = 'El profesor no tiene permitido dictar en varias sedes.';
  end if;

  if exists (
    select 1 from public.horario_profesores hp
    join public.horarios h on h.id = hp.horario_id
    where hp.personal_id = new.personal_id and hp.id <> new.id
      and h.estado is distinct from 'Inactivo' and h.dia_semana = v_dia
      and nullif(h.hora_inicio, '')::time < v_fin
      and v_inicio < nullif(h.hora_fin, '')::time
  ) then
    raise exception using errcode = '23514',
      message = 'El profesor ya tiene otro horario activo que se cruza con este horario.';
  end if;

  return new;
end;
$$;
