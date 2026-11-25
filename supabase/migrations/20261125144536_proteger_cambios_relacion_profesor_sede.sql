-- Cierra vías de inconsistencia al modificar vínculos o permisos del profesor.
-- No repara ni modifica filas históricas; protege únicamente escrituras futuras.

create unique index if not exists personal_sedes_personal_sede_uidx
  on public.personal_sedes (personal_id, sede_id);

create or replace function public.fn_bloquear_quitar_sede_con_horario_activo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(old.personal_id, 0));

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

create or replace function public.fn_validar_cambio_vinculo_personal_sede()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.personal_id = new.personal_id then
    perform pg_advisory_xact_lock(hashtextextended(old.personal_id, 0));
  elsif old.personal_id < new.personal_id then
    perform pg_advisory_xact_lock(hashtextextended(old.personal_id, 0));
    perform pg_advisory_xact_lock(hashtextextended(new.personal_id, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended(new.personal_id, 0));
    perform pg_advisory_xact_lock(hashtextextended(old.personal_id, 0));
  end if;

  if (new.personal_id is distinct from old.personal_id
      or new.sede_id is distinct from old.sede_id)
     and exists (
       select 1
         from public.horario_profesores hp
         join public.horarios h on h.id = hp.horario_id
        where hp.personal_id = old.personal_id
          and h.sede_id = old.sede_id
          and h.estado is distinct from 'Inactivo'
     ) then
    raise exception using errcode = '23514',
      message = 'No se puede cambiar el vínculo: el profesor tiene horarios activos asignados en la sede actual.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_cambio_vinculo_personal_sede
  on public.personal_sedes;

create trigger trg_validar_cambio_vinculo_personal_sede
before update of personal_id, sede_id
on public.personal_sedes
for each row
execute function public.fn_validar_cambio_vinculo_personal_sede();

create or replace function public.fn_validar_permiso_multisede_personal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.permite_varias_sedes, false) then
    return new;
  end if;

  if new.permite_varias_sedes is not distinct from old.permite_varias_sedes then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id, 0));

  if exists (
    select 1
      from public.horario_profesores hp
      join public.horarios h on h.id = hp.horario_id
     where hp.personal_id = new.id
       and h.estado is distinct from 'Inactivo'
     group by hp.personal_id
    having count(distinct h.sede_id) > 1
  ) then
    raise exception using errcode = '23514',
      message = 'No se puede desactivar el permiso multisede: el profesor tiene horarios activos en más de una sede.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_permiso_multisede_personal
  on public.personal;

create trigger trg_validar_permiso_multisede_personal
before update of permite_varias_sedes
on public.personal
for each row
execute function public.fn_validar_permiso_multisede_personal();
