-- Las reversiones de campo se registran completas: el índice único permite
-- una sola reversión por ingreso, por lo que no deben aceptarse importes parciales.
CREATE OR REPLACE FUNCTION public.fn_exigir_reversion_campo_completa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_original_id text;
  v_original_monto numeric;
BEGIN
  IF NEW.origen IS NULL OR NEW.origen NOT LIKE 'reversion-campo:%' THEN
    RETURN NEW;
  END IF;

  v_original_id := substring(NEW.origen FROM char_length('reversion-campo:') + 1);
  SELECT c.monto
    INTO v_original_monto
    FROM public.caja_movimientos c
   WHERE c.id = v_original_id
     AND c.tipo = 'I'
     AND c.concepto = 'Pago de campo'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión de campo no identifica un ingreso original válido.';
  END IF;

  IF round(NEW.monto, 2) IS DISTINCT FROM round(v_original_monto, 2) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión de un pago de campo debe cancelar el importe completo del ingreso original.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_exigir_reversion_campo_completa ON public.caja_movimientos;
CREATE TRIGGER trg_exigir_reversion_campo_completa
BEFORE INSERT ON public.caja_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_exigir_reversion_campo_completa();

REVOKE ALL ON FUNCTION public.fn_exigir_reversion_campo_completa() FROM PUBLIC, anon, authenticated;
