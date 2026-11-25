-- Asegura que cada asistencia coincida con el alumno/entrenador y su horario.
-- Los índices evitan duplicados diarios por concurrencia; no modifican histórico.

create unique index if not exists asistencias_alumno_fecha_horario_uidx
  on public.asistencias (fecha, horario_id, alumno_id)
  where tipo = 'A' and alumno_id is not null and horario_id is not null;

create unique index if not exists asistencias_personal_fecha_horario_uidx
  on public.asistencias (fecha, horario_id, personal_id)
  where tipo = 'P' and personal_id is not null and horario_id is not null;

create or replace function public.fn_validar_integridad_asistencia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_alumno record;
  v_horario record;
begin
  if new.tipo = 'A' then
    if new.alumno_id is null or new.personal_id is not null then
      raise exception using errcode = '23514',
        message = 'La asistencia de alumno requiere alumno_id y no admite personal_id.';
    end if;

    if new.pago_campo is true and new.alumno_id is null then
      raise exception using errcode = '23514',
        message = 'El pago de campo debe estar asociado a un alumno.';
    end if;

    if new.horario_id is not null then
      select a.sede_id, a.deporte_id, a.fecha_nacimiento,
             h.sede_id as horario_sede, h.deporte_id as horario_deporte,
             h.categoria as horario_categoria
        into v_alumno
        from public.alumnos a
        join public.horarios h on h.id = new.horario_id
       where a.id = new.alumno_id;

      if not found then
        raise exception using errcode = '23514',
          message = 'El alumno o el horario asociado a la asistencia no existe.';
      end if;

      if v_alumno.sede_id is distinct from v_alumno.horario_sede
         or v_alumno.deporte_id is distinct from v_alumno.horario_deporte
         or v_alumno.fecha_nacimiento is null
         or v_alumno.horario_categoria is distinct from extract(year from v_alumno.fecha_nacimiento)::int then
        raise exception using errcode = '23514',
          message = 'El horario de asistencia no corresponde a la sede, deporte y categoría del alumno.';
      end if;
    end if;

  elsif new.tipo = 'P' then
    if new.personal_id is null or new.alumno_id is not null then
      raise exception using errcode = '23514',
        message = 'La asistencia de personal requiere personal_id y no admite alumno_id.';
    end if;

    if new.horario_id is not null and not exists (
      select 1 from public.horario_profesores hp
       where hp.horario_id = new.horario_id
         and hp.personal_id = new.personal_id
    ) then
      raise exception using errcode = '23514',
        message = 'El personal no está asignado al horario de esta asistencia.';
    end if;
  else
    raise exception using errcode = '23514',
      message = 'El tipo de asistencia debe ser A (alumno) o P (personal).';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_integridad_asistencia on public.asistencias;

create trigger trg_validar_integridad_asistencia
before insert or update of tipo, alumno_id, personal_id, horario_id, pago_campo
on public.asistencias
for each row
execute function public.fn_validar_integridad_asistencia();
