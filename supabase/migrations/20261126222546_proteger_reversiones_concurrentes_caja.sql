CREATE OR REPLACE FUNCTION public.fn_validar_reversion_pago_matricula()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_original_id text;
  v_original_monto numeric;
  v_original_tipo text;
  v_original_concepto text;
  v_original_detalle text;
  v_total_revertido numeric;
BEGIN
  -- Las operaciones administrativas directas de PostgreSQL pueden limpiar QA;
  -- la API de la aplicación nunca ejecuta como postgres.
  IF TG_OP = 'DELETE' THEN
    IF current_user = 'postgres' THEN
      RETURN OLD;
    END IF;

    IF OLD.origen LIKE 'reversion:%' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede eliminar una reversión de matrícula; debe conservarse la auditoría.';
    END IF;

    SELECT COALESCE(SUM(c.monto), 0)
      INTO v_total_revertido
      FROM public.caja_movimientos c
     WHERE c.origen = 'reversion:' || OLD.id
       AND c.tipo = 'E';

    IF v_total_revertido > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede eliminar un ingreso que ya tiene reversiones vinculadas.';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.origen LIKE 'reversion:%'
       AND (NEW.origen IS DISTINCT FROM OLD.origen OR NEW.id IS DISTINCT FROM OLD.id) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede desvincular ni cambiar el identificador de una reversión de matrícula.';
    END IF;

    SELECT COALESCE(SUM(c.monto), 0)
      INTO v_total_revertido
      FROM public.caja_movimientos c
     WHERE c.origen = 'reversion:' || OLD.id
       AND c.tipo = 'E';

    IF v_total_revertido > 0
       AND (
         NEW.id IS DISTINCT FROM OLD.id
         OR NEW.tipo IS DISTINCT FROM 'I'
         OR NEW.concepto IS DISTINCT FROM 'Matrícula / mensualidad'
         OR NEW.detalle IS DISTINCT FROM OLD.detalle
         OR NEW.origen IS DISTINCT FROM OLD.origen
         OR NEW.monto < v_total_revertido
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede alterar un ingreso de matrícula por debajo de sus reversiones registradas.';
    END IF;
  END IF;

  IF NEW.origen IS NULL OR NEW.origen NOT LIKE 'reversion:%' THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo IS DISTINCT FROM 'E'
     OR NEW.concepto IS DISTINCT FROM 'Reversión de pago de matrícula'
     OR NEW.monto IS NULL
     OR NEW.monto <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión de matrícula debe ser un egreso positivo con concepto válido.';
  END IF;

  v_original_id := substring(NEW.origen FROM 11);
  IF v_original_id = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión no identifica el ingreso original de Caja.';
  END IF;

  -- El bloqueo de la fila original serializa reversiones concurrentes
  -- del mismo ingreso: la segunda transacción vuelve a calcular el saldo
  -- después de que la primera haya confirmado.
  SELECT c.monto, c.tipo, c.concepto, c.detalle
    INTO v_original_monto, v_original_tipo, v_original_concepto, v_original_detalle
    FROM public.caja_movimientos c
   WHERE c.id = v_original_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'No existe el ingreso original de Caja que se intenta revertir.';
  END IF;

  IF v_original_tipo IS DISTINCT FROM 'I'
     OR v_original_concepto IS DISTINCT FROM 'Matrícula / mensualidad'
     OR v_original_detalle IS DISTINCT FROM NEW.detalle THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión no corresponde a un ingreso de matrícula del mismo alumno.';
  END IF;

  SELECT COALESCE(SUM(c.monto), 0)
    INTO v_total_revertido
    FROM public.caja_movimientos c
   WHERE c.origen = NEW.origen
     AND c.tipo = 'E'
     AND c.id IS DISTINCT FROM NEW.id;

  IF ROUND(v_total_revertido + NEW.monto, 2) > ROUND(v_original_monto, 2) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión supera el saldo disponible del ingreso original de matrícula.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_reversion_pago_matricula ON public.caja_movimientos;

CREATE TRIGGER trg_validar_reversion_pago_matricula
BEFORE INSERT OR UPDATE OR DELETE ON public.caja_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_reversion_pago_matricula();
