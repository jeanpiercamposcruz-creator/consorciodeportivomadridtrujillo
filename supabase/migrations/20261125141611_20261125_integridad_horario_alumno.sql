-- Valida que el horario asignado a un alumno sea compatible con su sede, deporte y categoría.
create or replace function public.fn_validar_horario_alumno()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_horario public.horarios%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.horario_id is not distinct from old.horario_id
     and new.sede_id is not distinct from old.sede_id
     and new.deporte_id is not distinct from old.deporte_id
     and new.fecha_nacimiento is not distinct from old.fecha_nacimiento then
    return new;
  end if;
  if new.horario_id is null then return new; end if;
  select * into v_horario from public.horarios where id = new.horario_id;
  if not found then
    raise exception using errcode = '23503', message = 'El horario seleccionado no existe.';
  end if;
  if coalesce(v_horario.estado, 'Activo') <> 'Activo' then
    raise exception using errcode = '23514', message = 'No se puede matricular al alumno en un horario inactivo.';
  end if;
  if new.sede_id is distinct from v_horario.sede_id then
    raise exception using errcode = '23514', message = 'La sede del alumno no coincide con la sede del horario.';
  end if;
  if new.deporte_id is distinct from v_horario.deporte_id then
    raise exception using errcode = '23514', message = 'El deporte del alumno no coincide con el deporte del horario.';
  end if;
  if new.fecha_nacimiento is null or extract(year from new.fecha_nacimiento)::integer <> v_horario.categoria then
    raise exception using errcode = '23514', message = 'La categoría del horario no coincide con el año de nacimiento del alumno.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_horario_alumno on public.alumnos;
create trigger trg_validar_horario_alumno
before insert or update on public.alumnos
for each row execute function public.fn_validar_horario_alumno();
