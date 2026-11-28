-- Caja stores positive-direction amounts; tipo (I/E) determines the sign.
-- Zero remains valid for complimentary items, while null, negative and
-- sub-cent precision amounts are rejected at the database boundary.
alter table public.caja_movimientos
add constraint caja_movimientos_monto_valido_check
check (monto is not null and monto >= 0 and monto = round(monto, 2));
