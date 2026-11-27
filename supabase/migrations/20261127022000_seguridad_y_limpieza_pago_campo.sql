-- Las validaciones diferidas deben consultar Caja aunque el actor tenga RLS restringido.
CREATE OR REPLACE FUNCTION public.fn_validar_ingreso_pago_campo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_partes text[];
  v_fecha date;
BEGIN
  IF NEW.origen IS NULL OR NEW.origen NOT LIKE 'campo|%' THEN RETURN NEW; END IF;
  v_partes := string_to_array(NEW.origen, '|');
  IF NEW.tipo IS DISTINCT FROM 'I'
     OR NEW.concepto IS DISTINCT FROM 'Pago de campo'
     OR array_length(v_partes, 1) IS DISTINCT FROM 5
     OR v_partes[5] IS DISTINCT FROM NEW.id
     OR v_partes[2] !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='El ingreso de campo debe identificar un pago único y válido.';
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
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='El ingreso de campo no coincide con la asistencia que lo registra.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_validar_vinculo_pago_campo_asistencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
    -- Solo los fixtures temporales QA pueden limpiarse aunque una prueba haya fallado a mitad del flujo.
    IF OLD.alumno_id LIKE 'QA-ATT-%' THEN RETURN NULL; END IF;
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
