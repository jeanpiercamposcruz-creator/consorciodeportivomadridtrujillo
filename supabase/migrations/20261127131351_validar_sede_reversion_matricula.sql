-- Las reversiones de matrícula deben permanecer en la misma sede del ingreso.
-- Así Caja no traslada artificialmente el egreso a otra sede.
CREATE OR REPLACE FUNCTION public.fn_validar_sede_reversion_matricula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_sede_original text;
  v_original_id text;
BEGIN
  IF NEW.origen IS NULL OR NEW.origen NOT LIKE 'reversion:%' THEN
    RETURN NEW;
  END IF;

  v_original_id := substring(NEW.origen FROM 11);
  SELECT c.sede_id
    INTO v_sede_original
    FROM public.caja_movimientos c
   WHERE c.id = v_original_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión no identifica un ingreso original de Caja.';
  END IF;

  IF NEW.sede_id IS DISTINCT FROM v_sede_original THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión de matrícula debe registrarse en la misma sede del ingreso original.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_sede_reversion_matricula ON public.caja_movimientos;
CREATE TRIGGER trg_validar_sede_reversion_matricula
BEFORE INSERT ON public.caja_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_sede_reversion_matricula();

REVOKE ALL ON FUNCTION public.fn_validar_sede_reversion_matricula() FROM PUBLIC, anon, authenticated;
