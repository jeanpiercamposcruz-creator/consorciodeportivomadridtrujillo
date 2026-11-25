-- Solo IDs temporales QA pueden borrarse para limpiar pruebas; ventas reales conservan auditoría.
create or replace function public.fn_auditar_anulacion_kit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if tg_op = 'DELETE' then
    if old.id like 'QA-KIT-%' then
      return old;
    end if;
    raise exception using errcode = '23514',
      message = 'No se puede borrar una venta de indumentaria; debe anularse para conservar la auditoría de Caja.';
  end if;

  if old.estado = 'Anulada' then
    if new is distinct from old then
      raise exception using errcode = '23514',
        message = 'Una venta anulada no se puede modificar ni reactivar.';
    end if;
    return new;
  end if;

  if new.estado = 'Anulada' and old.estado is distinct from new.estado then
    select count(*) into v_count
      from public.caja_movimientos c
     where c.origen = 'kit|' || old.id
       and c.tipo = 'I'
       and c.concepto = 'Indumentaria'
       and c.sede_id = old.sede_id
       and abs(c.monto - old.precio_publico) < 0.01;

    if v_count <> 1 then
      raise exception using errcode = '23514',
        message = 'No se puede anular la venta: no existe un ingreso único y conciliado en Caja.';
    end if;

    insert into public.caja_movimientos
      (id, fecha, sede_id, tipo, concepto, detalle, monto, origen)
    values
      ('REV-KIT-' || old.id, current_date, old.sede_id, 'E',
       'Reversión de indumentaria', old.alumno_id, old.precio_publico,
       'reversion-kit|' || old.id)
    on conflict (origen) where origen like 'reversion-kit|%' do nothing;
  end if;

  return new;
end;
$$;
