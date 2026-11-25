-- Evita cuotas duplicadas y estados que contradicen los importes abonados/saldo.
create unique index if not exists cronograma_cuotas_alumno_numero_uidx
  on public.cronograma_cuotas (alumno_id, numero_cuota);

alter table public.cronograma_cuotas
  add constraint cronograma_cuotas_estado_coherente_check
  check (
    estado is not null
    and estado in ('Pendiente','Parcial','Pagada','Anulada')
    and (
      estado = 'Anulada'
      or (estado = 'Pagada' and saldo_pendiente <= 0.009 and monto_abonado >= monto - 0.009)
      or (estado = 'Parcial' and monto_abonado > 0.009 and saldo_pendiente > 0.009)
      or (estado = 'Pendiente' and monto_abonado <= 0.009 and saldo_pendiente > 0.009)
    )
  );
