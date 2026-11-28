-- Enlaza el estado de pago de campo con el movimiento de Caja exacto.
-- La FK es diferida porque erp_persistir_lote persiste primero asistencias y luego Caja.
ALTER TABLE public.asistencias
  ADD COLUMN pago_campo_movimiento_id text;

ALTER TABLE public.asistencias
  ADD CONSTRAINT asistencias_pago_campo_movimiento_fk
  FOREIGN KEY (pago_campo_movimiento_id)
  REFERENCES public.caja_movimientos(id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.asistencias
  ADD CONSTRAINT asistencias_pago_campo_movimiento_consistente_check
  CHECK (pago_campo_movimiento_id IS NULL OR pago_campo IS TRUE);

CREATE UNIQUE INDEX asistencias_pago_campo_movimiento_uidx
  ON public.asistencias (pago_campo_movimiento_id)
  WHERE pago_campo_movimiento_id IS NOT NULL;

CREATE UNIQUE INDEX caja_movimientos_reversion_campo_uidx
  ON public.caja_movimientos (origen)
  WHERE origen LIKE 'reversion-campo:%';

-- Un nuevo ingreso de campo debe estar enlazado a la asistencia exacta que lo genera.
CREATE OR REPLACE FUNCTION public.fn_validar_ingreso_pago_campo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_partes text[];
  v_fecha date;
BEGIN
  IF NEW.origen IS NULL OR NEW.origen NOT LIKE 'campo|%' THEN
    RETURN NEW;
  END IF;

  v_partes := string_to_array(NEW.origen, '|');
  IF NEW.tipo IS DISTINCT FROM 'I'
     OR NEW.concepto IS DISTINCT FROM 'Pago de campo'
     OR array_length(v_partes, 1) IS DISTINCT FROM 5
     OR v_partes[5] IS DISTINCT FROM NEW.id
     OR v_partes[2] !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El ingreso de campo debe identificar un pago único y válido.';
  END IF;

  v_fecha := v_partes[2]::date;
  IF NEW.fecha IS DISTINCT FROM v_fecha
     OR NEW.detalle IS DISTINCT FROM v_partes[3]
     OR NOT EXISTS (
       SELECT 1
       FROM public.asistencias a
       JOIN public.horarios h ON h.id = a.horario_id
       WHERE a.pago_campo_movimiento_id = NEW.id
         AND a.pago_campo IS TRUE
         AND a.tipo = 'A'
         AND a.fecha = v_fecha
         AND a.alumno_id = v_partes[3]
         AND a.horario_id = v_partes[4]
         AND h.sede_id = NEW.sede_id
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El ingreso de campo no coincide con la asistencia que lo registra.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_ingreso_pago_campo ON public.caja_movimientos;
CREATE TRIGGER trg_validar_ingreso_pago_campo
BEFORE INSERT ON public.caja_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_ingreso_pago_campo();

-- Amplía la protección de reversiones de matrícula a pagos de campo.
-- Las operaciones QA solo pueden limpiar movimientos cuyo detalle tiene prefijo QA-ATT-.
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
  v_original_sede text;
  v_original_origen text;
  v_total_revertido numeric;
  v_es_campo boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user = 'postgres' OR OLD.detalle LIKE 'QA-ATT-%' THEN
      RETURN OLD;
    END IF;

    IF OLD.origen LIKE 'reversion:%' OR OLD.origen LIKE 'reversion-campo:%' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede eliminar una reversión; debe conservarse la auditoría.';
    END IF;

    SELECT COALESCE(SUM(c.monto), 0)
      INTO v_total_revertido
      FROM public.caja_movimientos c
     WHERE c.tipo = 'E'
       AND c.origen IN ('reversion:' || OLD.id, 'reversion-campo:' || OLD.id);

    IF v_total_revertido > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede eliminar un ingreso que ya tiene reversiones vinculadas.';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.origen LIKE 'reversion:%' OR OLD.origen LIKE 'reversion-campo:%')
       AND (
         NEW.id IS DISTINCT FROM OLD.id
         OR NEW.origen IS DISTINCT FROM OLD.origen
         OR NEW.tipo IS DISTINCT FROM OLD.tipo
         OR NEW.concepto IS DISTINCT FROM OLD.concepto
         OR NEW.detalle IS DISTINCT FROM OLD.detalle
         OR NEW.sede_id IS DISTINCT FROM OLD.sede_id
         OR NEW.monto IS DISTINCT FROM OLD.monto
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede modificar una reversión registrada.';
    END IF;

    SELECT COALESCE(SUM(c.monto), 0)
      INTO v_total_revertido
      FROM public.caja_movimientos c
     WHERE c.tipo = 'E'
       AND c.origen IN ('reversion:' || OLD.id, 'reversion-campo:' || OLD.id);

    IF v_total_revertido > 0
       AND (
         NEW.id IS DISTINCT FROM OLD.id
         OR NEW.tipo IS DISTINCT FROM 'I'
         OR NEW.concepto IS DISTINCT FROM OLD.concepto
         OR NEW.detalle IS DISTINCT FROM OLD.detalle
         OR NEW.sede_id IS DISTINCT FROM OLD.sede_id
         OR NEW.origen IS DISTINCT FROM OLD.origen
         OR NEW.monto IS DISTINCT FROM OLD.monto
       ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'No se puede alterar un ingreso que ya tiene reversiones registradas.';
    END IF;
  END IF;

  IF NEW.origen LIKE 'reversion:%' THEN
    v_original_id := substring(NEW.origen FROM 11);
    v_es_campo := false;
  ELSIF NEW.origen LIKE 'reversion-campo:%' THEN
    v_original_id := substring(NEW.origen FROM char_length('reversion-campo:') + 1);
    v_es_campo := true;
  ELSE
    RETURN NEW;
  END IF;

  IF v_original_id = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión no identifica el ingreso original de Caja.';
  END IF;

  IF NEW.tipo IS DISTINCT FROM 'E'
     OR NEW.monto IS NULL
     OR NEW.monto <= 0
     OR (v_es_campo AND NEW.concepto IS DISTINCT FROM 'Reversión de pago de campo')
     OR (NOT v_es_campo AND NEW.concepto IS DISTINCT FROM 'Reversión de pago de matrícula') THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La reversión debe ser un egreso positivo con concepto válido.';
  END IF;

  SELECT c.monto, c.tipo, c.concepto, c.detalle, c.sede_id, c.origen
    INTO v_original_monto, v_original_tipo, v_original_concepto,
         v_original_detalle, v_original_sede, v_original_origen
    FROM public.caja_movimientos c
   WHERE c.id = v_original_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'No existe el ingreso original de Caja que se intenta revertir.';
  END IF;

  IF v_es_campo THEN
    IF v_original_tipo IS DISTINCT FROM 'I'
       OR v_original_concepto IS DISTINCT FROM 'Pago de campo'
       OR v_original_detalle IS DISTINCT FROM NEW.detalle
       OR v_original_sede IS DISTINCT FROM NEW.sede_id
       OR v_original_origen NOT LIKE 'campo|%' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'La reversión no corresponde a un ingreso de campo del mismo alumno y sede.';
    END IF;
  ELSE
    IF v_original_tipo IS DISTINCT FROM 'I'
       OR v_original_concepto IS DISTINCT FROM 'Matrícula / mensualidad'
       OR v_original_detalle IS DISTINCT FROM NEW.detalle THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'La reversión no corresponde a un ingreso de matrícula del mismo alumno.';
    END IF;
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
      MESSAGE = 'La reversión supera el saldo disponible del ingreso original.';
  END IF;

  RETURN NEW;
END;
$function$;
