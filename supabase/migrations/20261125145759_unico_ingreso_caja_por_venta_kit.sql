-- Una venta de indumentaria debe tener como máximo un ingreso de Caja vinculado.
-- El identificador de la venta se conserva en caja_movimientos.origen = 'kit|<id>'.
create unique index if not exists caja_movimientos_kit_origen_uidx
  on public.caja_movimientos (origen)
  where origen like 'kit|%';
