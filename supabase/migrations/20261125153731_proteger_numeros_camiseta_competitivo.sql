-- Evita números de camiseta duplicados en fútbol/vóley competitivo entre categorías ±2 años.
-- El bloqueo asesor serializa compras simultáneas del mismo deporte y número.
create or replace function public.fn_validar_numero_camiseta_competitivo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_modalidad text;
  v_deporte text;
  v_anio integer;
begin
  if coalesce(new.estado, 'Activa') = 'Anulada'
     or nullif(btrim(new.numero), '') is null then
    return new;
  end if;

  select a.modalidad, a.deporte_id, extract(year from a.fecha_nacimiento)::integer
    into v_modalidad, v_deporte, v_anio
    from public.alumnos a
   where a.id = new.alumno_id;

  if not found then
    raise exception using errcode = '23503',
      message = 'El alumno asociado a la venta no existe.';
  end if;

  if v_modalidad = 'Competitivo' then
    if v_anio is null then
      raise exception using errcode = '23514',
        message = 'El alumno competitivo debe tener fecha de nacimiento para asignar número de camiseta.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('camiseta:' || v_deporte || ':' || btrim(new.numero), 0));

    if exists (
      select 1
        from public.kits_ventas k
        join public.alumnos a on a.id = k.alumno_id
       where k.id <> new.id
         and coalesce(k.estado, 'Activa') = 'Activa'
         and btrim(coalesce(k.numero, '')) = btrim(new.numero)
         and a.id <> new.alumno_id
         and a.modalidad = 'Competitivo'
         and a.deporte_id = v_deporte
         and abs(extract(year from a.fecha_nacimiento)::integer - v_anio) <= 2
    ) then
      raise exception using errcode = '23505',
        message = 'Ese número de camiseta ya está ocupado en la misma disciplina y categorías de ±2 años.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_numero_camiseta_competitivo on public.kits_ventas;
create trigger trg_validar_numero_camiseta_competitivo
before insert or update of alumno_id, numero, estado
on public.kits_ventas
for each row execute function public.fn_validar_numero_camiseta_competitivo();
