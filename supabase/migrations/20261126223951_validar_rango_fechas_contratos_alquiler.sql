ALTER TABLE public.contratos_alquiler
  DROP CONSTRAINT IF EXISTS contratos_alquiler_fechas_validas_check;

ALTER TABLE public.contratos_alquiler
  ADD CONSTRAINT contratos_alquiler_fechas_validas_check
  CHECK (fecha_fin > fecha_inicio);
