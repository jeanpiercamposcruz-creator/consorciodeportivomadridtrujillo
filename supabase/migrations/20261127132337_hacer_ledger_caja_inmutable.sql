-- Caja funciona como ledger: los cambios se registran mediante reversión
-- y un nuevo movimiento, no editando la operación original.
CREATE OR REPLACE FUNCTION public.fn_bloquear_actualizacion_caja_historica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF OLD IS NOT DISTINCT FROM NEW THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'Los movimientos de Caja son inmutables. Registra una reversión y un nuevo movimiento para corregir una operación.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_bloquear_actualizacion_caja_historica ON public.caja_movimientos;
CREATE TRIGGER trg_bloquear_actualizacion_caja_historica
BEFORE UPDATE ON public.caja_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_bloquear_actualizacion_caja_historica();

REVOKE ALL ON FUNCTION public.fn_bloquear_actualizacion_caja_historica() FROM PUBLIC, anon, authenticated;
