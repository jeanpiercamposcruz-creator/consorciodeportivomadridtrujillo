CREATE OR REPLACE FUNCTION public.fn_validar_solapamiento_contrato_alquiler()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Dejar que el CHECK de la tabla rechace rangos nulos, iguales o invertidos.
  -- Así evitamos construir daterange() con límites inválidos y devolvemos
  -- una violación de integridad clara en vez de un error interno de rango.
  IF NEW.fecha_inicio IS NULL
     OR NEW.fecha_fin IS NULL
     OR NEW.fecha_fin <= NEW.fecha_inicio THEN
    RETURN NEW;
  END IF;

  IF NEW.vigente IS TRUE THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('contrato-alquiler:' || NEW.sede_id, 0)
    );

    IF EXISTS (
      SELECT 1
        FROM public.contratos_alquiler c
       WHERE c.sede_id = NEW.sede_id
         AND c.id <> NEW.id
         AND c.vigente IS TRUE
         AND daterange(c.fecha_inicio, c.fecha_fin, '[]')
             && daterange(NEW.fecha_inicio, NEW.fecha_fin, '[]')
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23P01',
        MESSAGE = 'Ya existe un contrato vigente que se cruza con esas fechas para esta sede.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
