-- Caja es un ledger append-only para la aplicación: los movimientos reales
-- se corrigen mediante reversión, nunca eliminándolos. Solo los fixtures QA
-- con marcadores explícitos pueden retirarse durante la limpieza automatizada.
CREATE OR REPLACE FUNCTION public.fn_bloquear_eliminacion_caja_historica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN OLD;
  END IF;

  IF OLD.id LIKE 'QA-PERSIST-CAJA-%'
     OR OLD.detalle LIKE 'QA-ATT-%'
     OR OLD.detalle LIKE 'QA-DOBLE-CAJA-%'
     OR OLD.origen LIKE 'kit|QA-KIT-%'
     OR OLD.origen LIKE 'reversion-kit|QA-KIT-%'
     OR EXISTS (
       SELECT 1
         FROM public.alumnos a
        WHERE a.id = OLD.detalle
          AND a.nombres = 'QA'
          AND a.apellidos = 'Persistencia'
          AND a.dni ~ '^[0-9]{8}
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
