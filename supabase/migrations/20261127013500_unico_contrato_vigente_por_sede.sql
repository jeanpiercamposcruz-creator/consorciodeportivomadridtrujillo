-- Una sede solo puede tener un contrato de alquiler marcado como vigente.
-- Al activar uno nuevo, se finalizan los anteriores en la misma transacción.
CREATE OR REPLACE FUNCTION public.fn_unico_contrato_vigente_por_sede()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.vigente IS TRUE THEN
    UPDATE public.contratos_alquiler
       SET vigente = false
     WHERE sede_id = NEW.sede_id
       AND vigente IS TRUE
       AND id IS DISTINCT FROM NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_unico_contrato_vigente_por_sede ON public.contratos_alquiler;
CREATE TRIGGER trg_unico_contrato_vigente_por_sede
BEFORE INSERT OR UPDATE OF vigente, sede_id
ON public.contratos_alquiler
FOR EACH ROW
EXECUTE FUNCTION public.fn_unico_contrato_vigente_por_sede();

CREATE UNIQUE INDEX IF NOT EXISTS contratos_alquiler_unico_vigente_por_sede_uidx
ON public.contratos_alquiler (sede_id)
WHERE vigente IS TRUE;
