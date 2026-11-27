-- Quita escalas tipadas que redondeaban antes de evaluar los CHECK.
-- Las restricciones de precisión y rango ya instaladas pasan a rechazar el valor original.
ALTER TABLE public.alumnos
  ALTER COLUMN monto_pagar_hoy TYPE numeric
  USING monto_pagar_hoy::numeric;

ALTER TABLE public.contratos_alquiler
  ALTER COLUMN monto_mensual TYPE numeric
  USING monto_mensual::numeric;

ALTER TABLE public.cronograma_cuotas
  ALTER COLUMN monto TYPE numeric
  USING monto::numeric,
  ALTER COLUMN monto_abonado TYPE numeric
  USING monto_abonado::numeric,
  ALTER COLUMN saldo_pendiente TYPE numeric
  USING saldo_pendiente::numeric;

ALTER TABLE public.personal_sedes
  ALTER COLUMN horas_semanales TYPE numeric
  USING horas_semanales::numeric;
