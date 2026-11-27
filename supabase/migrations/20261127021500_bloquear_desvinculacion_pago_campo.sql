-- Impide desvincular o borrar una asistencia con un ingreso de campo sin revertir.
-- El constraint trigger es diferido porque el lote actualiza asistencia antes de insertar Caja.
CREATE OR REPLACE FUNCTION public.fn_validar_vinculo_pago_campo_asistencia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_old_id text;
  v_new_id text;
  v_original_monto numeric;
  v_total_revertido numeric;
  v_base text;
  v_legacy_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old_id := OLD.pago_campo_movimiento_id;

    IF v_old_id IS NOT NULL THEN
      SELECT c.monto INTO v_original_monto
      FROM public.caja_movimientos c
      WHERE c.id = v_old_id AND c.tipo = 'I' AND c.concepto = 'Pago de campo';

      SELECT COALESCE(SUM(r.monto),0) INTO v_total_revertido
      FROM public.caja_movimientos r
      WHERE r.origen = 'reversion-campo:' || v_old_id AND r.tipo = 'E';

      IF v_original_monto IS NULL OR v_total_revertido + 0.009 < v_original_monto THEN
        RAISE EXCEPTION USING ERRCODE='23514',
          MESSAGE='No se puede eliminar una asistencia con un pago de campo que no se haya revertido por completo.';
      END IF;
    ELSE
      v_base := 'campo|' || OLD.fecha::text || '|' || OLD.alumno_id || '|' || OLD.horario_id;
      SELECT c.id INTO v_legacy_id
      FROM public.caja_movimientos c
      WHERE c.tipo='I' AND c.concepto='Pago de campo'
        AND c.detalle=OLD.alumno_id AND c.fecha=OLD.fecha
        AND (c.origen=v_base OR c.origen LIKE v_base || '|%')
        AND NOT EXISTS (
          SELECT 1 FROM public.caja_movimientos r
          WHERE r.origen='reversion-campo:' || c.id AND r.tipo='E'
          HAVING COALESCE(SUM(r.monto),0) + 0.009 >= c.monto
        )
      LIMIT 1;

      IF v_legacy_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='23514',
          MESSAGE='No se puede eliminar una asistencia con un ingreso de campo histórico sin revertir.';
      END IF;
    END IF;

    RETURN NULL;
  END IF;

  v_old_id := OLD.pago_campo_movimiento_id;
  v_new_id := NEW.pago_campo_movimiento_id;

  IF v_old_id IS NOT NULL AND v_old_id IS DISTINCT FROM v_new_id THEN
    SELECT c.monto INTO v_original_monto
    FROM public.caja_movimientos c
    WHERE c.id = v_old_id AND c.tipo='I' AND c.concepto='Pago de campo';

    SELECT COALESCE(SUM(r.monto),0) INTO v_total_revertido
    FROM public.caja_movimientos r
    WHERE r.origen='reversion-campo:' || v_old_id AND r.tipo='E';

    IF v_original_monto IS NULL OR v_total_revertido + 0.009 < v_original_monto THEN
      RAISE EXCEPTION USING ERRCODE='23514',
        MESSAGE='Primero debes revertir por completo el ingreso de campo antes de cambiar su vínculo.';
    END IF;
  END IF;

  IF v_new_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.caja_movimientos c
    WHERE c.id=v_new_id
      AND c.tipo='I'
      AND c.concepto='Pago de campo'
      AND c.detalle=NEW.alumno_id
      AND c.fecha=NEW.fecha
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='El vínculo de pago de campo no corresponde a un ingreso válido de esta asistencia.';
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_vinculo_pago_campo_asistencia ON public.asistencias;
CREATE CONSTRAINT TRIGGER trg_validar_vinculo_pago_campo_asistencia
AFTER UPDATE OF pago_campo_movimiento_id OR DELETE ON public.asistencias
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_vinculo_pago_campo_asistencia();
