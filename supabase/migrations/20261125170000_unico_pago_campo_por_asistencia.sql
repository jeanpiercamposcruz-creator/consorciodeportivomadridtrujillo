-- Prevent concurrent attendance marking from creating duplicate field-payment
-- income rows in Caja for the same student, date, and schedule.
-- Existing QA data was checked: no campo| origins or duplicates existed.
create unique index caja_movimientos_pago_campo_asistencia_uidx
on public.caja_movimientos (origen)
where origen like 'campo|%';
