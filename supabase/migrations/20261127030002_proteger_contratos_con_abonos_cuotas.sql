-- También protege los términos del contrato cuando hay abonos en cuotas,
-- aunque el resumen alumnos.monto_pagado esté desactualizado.
CREATE OR REPLACE FUNCTION public.fn_proteger_contrato_alumno_con_pagos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF (
       coalesce(OLD.monto_pagado, 0) > 0
       OR EXISTS (
         SELECT 1
           FROM public.cronograma_cuotas q
          WHERE q.alumno_id = OLD.id
            AND coalesce(q.monto_abonado, 0) > 0
       )
     )
     AND (
       NEW.costo_matricula IS DISTINCT FROM OLD.costo_matricula
       OR NEW.costo_mensualidad IS DISTINCT FROM OLD.costo_mensualidad
       OR NEW.meses IS DISTINCT FROM OLD.meses
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'alumnos_contrato_bloqueado_con_pagos',
      MESSAGE = 'No se pueden modificar los términos del contrato mientras existan pagos en matrícula o cuotas. Primero revierte todos los pagos.';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_proteger_contrato_alumno_con_pagos() FROM PUBLIC, anon, authenticated;
