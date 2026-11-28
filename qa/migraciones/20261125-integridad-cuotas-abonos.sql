-- Reconciliar abonos/saldos del cronograma y evitar futuras inconsistencias.
-- Alcance: ejecutar exclusivamente en Supabase QA (consorcio-erp-qa).
-- La distribución usa monto_pagado del alumno, primero matrícula y luego cuotas FIFO.
-- No modifica alumnos ni movimientos de Caja.

begin;

with base as (
  select
    c.id,
    c.monto,
    coalesce(a.monto_pagado, 0) as monto_pagado,
    coalesce(a.costo_matricula, 0) as costo_matricula,
    coalesce(
      sum(c.monto) over (
        partition by c.alumno_id
        order by c.numero_cuota
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as cuotas_anteriores
  from public.cronograma_cuotas c
  join public.alumnos a on a.id = c.alumno_id
),
calculado as (
  select
    id,
    least(
      monto,
      greatest(0, monto_pagado - costo_matricula - cuotas_anteriores)
    ) as abonado
  from base
)
update public.cronograma_cuotas c
set
  monto_abonado = calculado.abonado,
  saldo_pendiente = round(c.monto - calculado.abonado, 2)
from calculado
where c.id = calculado.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cronograma_cuotas'::regclass
      and conname = 'cronograma_cuotas_importes_coherentes_check'
  ) then
    alter table public.cronograma_cuotas
      add constraint cronograma_cuotas_importes_coherentes_check
      check (
        monto is not null
        and monto >= 0
        and monto_abonado >= 0
        and saldo_pendiente >= 0
        and monto_abonado <= monto
        and saldo_pendiente <= monto
        and round(monto_abonado + saldo_pendiente, 2) = round(monto, 2)
      );
  end if;
end
$$;

commit;
