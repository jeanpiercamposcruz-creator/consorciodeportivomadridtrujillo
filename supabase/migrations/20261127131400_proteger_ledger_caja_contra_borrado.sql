-- Ledger append-only: las operaciones reales se corrigen mediante reversión.
-- Las excepciones de borrado solo funcionan para fixtures exactos y sesión ADM.
CREATE OR REPLACE FUNCTION public.fn_bloquear_eliminacion_caja_historica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN OLD;
  END IF;

  IF public.rol_actual() = 'ADM' AND (
    (
      OLD.id ~ '^QA-PERSIST-CAJA-[A-Za-z0-9-]+$'
      AND OLD.tipo = 'I'
      AND OLD.concepto = 'Matrícula / mensualidad'
      AND OLD.detalle = 'QA-ABONO'
      AND OLD.monto = 230
      AND OLD.origen LIKE 'matricula:QA-ABONO|aplicacion:%'
    )
    OR
    (
      OLD.detalle ~ '^QA-DOBLE-CAJA-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      AND OLD.tipo = 'E'
      AND OLD.concepto = 'Otros'
      AND OLD.monto = 1.23
    )
    OR
    (
      OLD.detalle LIKE 'QA-ATT-%'
      AND EXISTS (
        SELECT 1 FROM public.alumnos a
        WHERE a.id = OLD.detalle
          AND a.nombres = 'QA'
          AND a.apellidos = 'Asistencia Temporal'
          AND length(a.dni) = 8
          AND a.horario_id IS NOT NULL
          AND a.sede_id IS NOT NULL
          AND a.deporte_id IS NOT NULL
      )
      AND (
        (
          OLD.tipo = 'I' AND OLD.concepto = 'Pago de campo'
          AND OLD.origen LIKE 'campo|%'
          AND split_part(OLD.origen,'|',3) = OLD.detalle
          AND array_length(string_to_array(OLD.origen,'|'),1) = 5
          AND split_part(OLD.origen,'|',5) = OLD.id
        )
        OR
        (
          OLD.tipo = 'E' AND OLD.concepto = 'Reversión de pago de campo'
          AND OLD.origen LIKE 'reversion-campo:%'
        )
      )
    )
    OR
    (
      OLD.origen = 'kit|' || split_part(OLD.origen,'|',2)
      AND OLD.origen LIKE 'kit|QA-KIT-%'
      AND OLD.tipo = 'I'
      AND OLD.concepto = 'Indumentaria'
      AND EXISTS (
        SELECT 1 FROM public.kits_ventas k
        WHERE k.id = split_part(OLD.origen,'|',2)
          AND k.id ~ '^QA-KIT-[0-9]{13}$'
          AND k.estado = 'Anulada'
          AND k.alumno_id = OLD.detalle
          AND k.sede_id = OLD.sede_id
          AND abs(k.precio_publico - OLD.monto) < 0.01
      )
    )
    OR
    (
      OLD.origen LIKE 'reversion-kit|QA-KIT-%'
      AND OLD.tipo = 'E'
      AND OLD.concepto = 'Reversión de indumentaria'
      AND EXISTS (
        SELECT 1 FROM public.kits_ventas k
        WHERE k.id = split_part(OLD.origen,'|',2)
          AND k.id ~ '^QA-KIT-[0-9]{13}$'
          AND k.estado = 'Anulada'
          AND k.alumno_id = OLD.detalle
          AND k.sede_id = OLD.sede_id
          AND abs(k.precio_publico - OLD.monto) < 0.01
      )
    )
    OR
    (
      OLD.tipo IN ('I','E')
      AND OLD.concepto IN ('Matrícula / mensualidad','Reversión de pago de matrícula')
      AND EXISTS (
        SELECT 1 FROM public.alumnos a
        WHERE a.id = OLD.detalle
          AND a.id ~ '^[0-9]{6}$'
          AND a.nombres = 'QA'
          AND a.apellidos = 'Persistencia'
          AND a.dni ~ '^[0-9]{8}$'
      )
    )
  ) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'Los movimientos reales de Caja no se eliminan. Registra una reversión para conservar la trazabilidad.';
END;
$function$;

DROP TRIGGER IF EXISTS trg_bloquear_eliminacion_caja_historica ON public.caja_movimientos;
CREATE TRIGGER trg_bloquear_eliminacion_caja_historica
BEFORE DELETE ON public.caja_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.fn_bloquear_eliminacion_caja_historica();

REVOKE ALL ON FUNCTION public.fn_bloquear_eliminacion_caja_historica() FROM PUBLIC, anon, authenticated;
