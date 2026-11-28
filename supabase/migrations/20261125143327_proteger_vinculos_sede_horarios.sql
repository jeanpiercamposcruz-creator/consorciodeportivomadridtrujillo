-- Impide dejar profesores con horarios activos en sedes de las que ya no forman parte.
create or replace function public.fn_bloquear_quitar_sede_con_horario_activo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.horario_profesores hp
      join public.horarios h on h.id = hp.horario_id
     where hp.personal_id = old.personal_id
       and h.sede_id = old.sede_id
       and h.estado is distinct from 'Inactivo'
  ) then
    raise exception using errcode = '23514',
      message = 'No se puede quitar la sede: el profesor tiene horarios activos asignados en ella.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_bloquear_quitar_sede_con_horario_activo
  on public.personal_sedes;

create trigger trg_bloquear_quitar_sede_con_horario_activo
before delete on public.personal_sedes
for each row
execute function public.fn_bloquear_quitar_sede_con_horario_activo();

create or replace function public.fn_validar_cambio_sede_horario()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  r record;
  v_permite_varias boolean;
begin
  if new.estado = 'Inactivo'
     or (new.sede_id is not distinct from old.sede_id
         and old.estado is distinct from 'Inactivo') then
    return new;
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
       where ps.personal_id = r.personal_id
         and ps.sede_id = new.sede_id
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
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_validar_cambio_sede_horario on public.horarios;

create trigger trg_validar_cambio_sede_horario
before update of sede_id, estado on public.horarios
for each row
execute function public.fn_validar_cambio_sede_horario();
