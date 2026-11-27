-- Serializa los cobros de campo por asistencia y evita dos ingresos activos
-- cuando dos sesiones intentan cobrar simultáneamente al mismo alumno/horario/día.
CREATE OR REPLACE FUNCTION public.fn_validar_ingreso_pago_campo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_partes text[];
  v_fecha date;
  v_base text;
  v_asistencia_id text;
  v_pagos_activos integer;
BEGIN
  IF NEW.origen IS NULL OR NEW.origen NOT LIKE 'campo|%' THEN
    RETURN NEW;
  END IF;

  v_partes := string_to_array(NEW.origen, '|');
  IF NEW.tipo IS DISTINCT FROM 'I'
     OR NEW.concepto IS DISTINCT FROM 'Pago de campo'
     OR array_length(v_partes, 1) IS DISTINCT FROM 5
     OR v_partes[5] IS DISTINCT FROM NEW.id
     OR v_partes[2] !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El ingreso de campo debe identificar un pago único y válido.';
  END IF;

  v_fecha := v_partes[2]::date;
  v_base := 'campo|' || v_fecha::text || '|' || v_partes[3] || '|' || v_partes[4];

  -- El bloqueo de la fila de asistencia serializa intentos concurrentes.
  SELECT a.id
    INTO v_asistencia_id
    FROM public.asistencias a
    JOIN public.horarios h ON h.id = a.horario_id
   WHERE a.pago_campo_movimiento_id = NEW.id
     AND a.pago_campo IS TRUE
     AND a.tipo = 'A'
     AND a.fecha = v_fecha
     AND a.alumno_id = v_partes[3]
     AND a.horario_id = v_partes[4]
     AND h.sede_id = NEW.sede_id
   FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El ingreso de campo no coincide con la asistencia que lo registra.';
  END IF;

  -- Tras obtener el bloqueo, una segunda sesión verá el ingreso confirmado
  -- por la primera. Se permite volver a pagar solo si el anterior fue revertido
  -- por completo; el historial permanece intacto.
  SELECT count(*)
    INTO v_pagos_activos
    FROM public.caja_movimientos c
   WHERE c.id IS DISTINCT FROM NEW.id
     AND c.tipo = 'I'
     AND c.concepto = 'Pago de campo'
     AND (c.origen = v_base OR c.origen LIKE v_base || '|%')
     AND round(
       c.monto - coalesce((
         SELECT sum(r.monto)
           FROM public.caja_movimientos r
          WHERE r.tipo = 'E'
            AND r.origen = 'reversion-campo:' || c.id
       ), 0),
       2
     ) > 0;

  IF v_pagos_activos > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Esta asistencia ya tiene un pago de campo activo. Revierte el ingreso anterior antes de volver a cobrar.';
  END IF;

  RETURN NEW;
END;
$function$;
