-- Persiste los cambios del ERP como una única transacción PostgreSQL.
-- La lista de tablas está cerrada y el rol ADM se valida dentro de la función.
create or replace function public.erp_persistir_lote(p_payload jsonb)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_name text;
  v_insert jsonb;
  v_update jsonb;
  v_delete jsonb;
  v_set text;
  v_rel regclass;
  v_ids text[];
begin
  if (select public.rol_actual()) is distinct from 'ADM' then
    raise exception using errcode = '42501', message = 'Solo un administrador puede persistir el lote ERP.';
  end if;

  if jsonb_typeof(p_payload) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'El lote ERP debe ser un arreglo JSON.';
  end if;

  -- Inserciones y actualizaciones respetan el orden padre -> hijo de TB.
  for v_item in
    select value from jsonb_array_elements(p_payload) with ordinality order by ordinality
  loop
    v_name := v_item->>'name';
    if v_name is null or v_name <> all(array[
      'centros_costo','sedes','deportes','contratos_alquiler','personal',
      'personal_sedes','personal_certificaciones','horarios','horario_profesores',
      'alumnos','cronograma_cuotas','asistencias','kits_ventas','caja_movimientos','ajustes'
    ]) then
      raise exception using errcode = '22023', message = 'Tabla no autorizada en lote ERP.';
    end if;

    v_insert := coalesce(v_item->'insert','[]'::jsonb);
    v_update := coalesce(v_item->'update','[]'::jsonb);
    v_delete := coalesce(v_item->'delete','[]'::jsonb);
    if jsonb_typeof(v_insert) is distinct from 'array'
       or jsonb_typeof(v_update) is distinct from 'array'
       or jsonb_typeof(v_delete) is distinct from 'array' then
      raise exception using errcode = '22023', message = 'Cada operación del lote debe ser un arreglo JSON.';
    end if;

    v_rel := to_regclass(format('public.%I', v_name));
    if v_rel is null then
      if jsonb_array_length(v_insert) > 0 or jsonb_array_length(v_update) > 0 or jsonb_array_length(v_delete) > 0 then
        raise exception using errcode = '42P01', message = format('No existe la tabla ERP %s.', v_name);
      end if;
      continue;
    end if;

    if jsonb_array_length(v_insert) > 0 then
      execute format(
        'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)',
        v_name, v_name
      ) using v_insert;
    end if;

    if jsonb_array_length(v_update) > 0 then
      select string_agg(format('%I = EXCLUDED.%I', a.attname, a.attname), ',')
        into v_set
        from pg_attribute a
       where a.attrelid = v_rel
         and a.attnum > 0
         and not a.attisdropped
         and a.attname <> 'id';
      if v_set is null then
        raise exception using errcode = '22023', message = format('La tabla %s no tiene columnas actualizables.', v_name);
      end if;
      execute format(
        'insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict (id) do update set %s',
        v_name, v_name, v_set
      ) using v_update;
    end if;
  end loop;

  -- Borrados en orden hijo -> padre para respetar las claves foráneas.
  for v_item in
    select value from jsonb_array_elements(p_payload) with ordinality order by ordinality desc
  loop
    v_name := v_item->>'name';
    v_delete := coalesce(v_item->'delete','[]'::jsonb);
    if jsonb_array_length(v_delete) > 0 then
      select array_agg(value) into v_ids from jsonb_array_elements_text(v_delete) as x(value);
      execute format('delete from public.%I where id = any($1)', v_name) using v_ids;
    end if;
  end loop;
end;
$$;

revoke all on function public.erp_persistir_lote(jsonb) from public, anon;
grant execute on function public.erp_persistir_lote(jsonb) to authenticated;
