-- Solo el administrador puede retirar fixtures QA-KIT, después de anularlos
-- y eliminar primero todos sus movimientos vinculados de Caja.
CREATE OR REPLACE FUNCTION public.fn_auditar_anulacion_kit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.id ~ '^QA-KIT-[0-9]{13}$'
       AND public.rol_actual() = 'ADM'
       AND OLD.estado = 'Anulada'
       AND NOT EXISTS (
         SELECT 1 FROM public.caja_movimientos c
         WHERE c.origen IN ('kit|' || OLD.id, 'reversion-kit|' || OLD.id)
       ) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='No se puede borrar una venta de indumentaria; debe anularse y conservarse su auditoría de Caja.';
  END IF;

  IF OLD.estado = 'Anulada' THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION USING ERRCODE='23514',
        MESSAGE='Una venta anulada no se puede modificar ni reactivar.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estado = 'Anulada' AND OLD.estado IS DISTINCT FROM NEW.estado THEN
    SELECT count(*) INTO v_count
    FROM public.caja_movimientos c
    WHERE c.origen = 'kit|' || OLD.id
      AND c.tipo = 'I'
      AND c.concepto = 'Indumentaria'
      AND c.sede_id = OLD.sede_id
      AND c.detalle = OLD.alumno_id
      AND abs(c.monto - OLD.precio_publico) < 0.01;

    IF v_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE='23514',
        MESSAGE='No se puede anular la venta: no existe un ingreso único y conciliado en Caja.';
    END IF;

    INSERT INTO public.caja_movimientos
      (id, fecha, sede_id, tipo, concepto, detalle, monto, origen)
    VALUES
      ('REV-KIT-' || OLD.id, current_date, OLD.sede_id, 'E',
       'Reversión de indumentaria', OLD.alumno_id, OLD.precio_publico,
       'reversion-kit|' || OLD.id)
    ON CONFLICT (origen) WHERE origen LIKE 'reversion-kit|%' DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_auditar_anulacion_kit() FROM PUBLIC, anon, authenticated;
