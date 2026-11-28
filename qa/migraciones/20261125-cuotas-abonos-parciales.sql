-- Persistencia de abonos parciales y saldos por cuota (solo QA).
-- Ejecutar en el proyecto Supabase de QA antes de validar la recarga de datos.
begin;
alter table if exists public.cronograma_cuotas
  add column if not exists monto_abonado numeric(12,2) not null default 0,
  add column if not exists saldo_pendiente numeric(12,2) not null default 0;
commit;
