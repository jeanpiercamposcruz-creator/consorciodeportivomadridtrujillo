-- Impide alterar los términos económicos de una matrícula que ya tiene pagos.
-- Primero deben revertirse los pagos; luego se puede corregir el contrato.
CREATE OR REPLACE FUNCTION public.fn_proteger_contrato_alumno_con_pagos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF coalesce(OLD.monto_pagado, 0) > 0
     AND (
       NEW.costo_matricula IS DISTINCT FROM OLD.costo_matricula
       OR NEW.costo_mensualidad IS DISTINCT FROM OLD.costo_mensualidad
       OR NEW.meses IS DISTINCT FROM OLD.meses
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'alumnos_contrato_bloqueado_con_pagos',
      MESSAGE = 'No se pueden modificar los términos del contrato mientras existan pagos registrados. Primero revierte el pago.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_proteger_contrato_alumno_con_pagos ON public.alumnos;
CREATE TRIGGER trg_proteger_contrato_alumno_con_pagos
BEFORE UPDATE OF costo_matricula, costo_mensualidad, meses
ON public.alumnos
FOR EACH ROW
EXECUTE FUNCTION public.fn_proteger_contrato_alumno_con_pagos();
