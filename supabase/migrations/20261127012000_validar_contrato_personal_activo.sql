-- Refuerza en base de datos los requisitos mínimos del contrato al activar personal.
-- Los registros históricos incompletos pueden seguir consultándose y editándose en campos
-- ajenos al contrato; el trigger solo valida cuando se crea/activa o cambia el contrato.
CREATE OR REPLACE FUNCTION public.fn_validar_contrato_personal_activo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_revisar boolean := false;
  v_hoy_peru date := (now() AT TIME ZONE 'America/Lima')::date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_revisar := coalesce(NEW.activo, 0) = 1;
  ELSE
    v_revisar :=
      NEW.activo IS DISTINCT FROM OLD.activo
      OR NEW.tipo_contrato IS DISTINCT FROM OLD.tipo_contrato
      OR NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
      OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin;
  END IF;

  IF v_revisar AND coalesce(NEW.activo, 0) = 1 THEN
    IF NEW.tipo_contrato IS NULL
       OR NEW.tipo_contrato NOT IN ('Planilla', 'Locación de servicios', 'Por horas')
       OR NEW.fecha_inicio IS NULL
       OR (NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < NEW.fecha_inicio)
       OR (NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < v_hoy_peru) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'personal_contrato_activo_valido',
        MESSAGE = 'Para activar personal se requiere un tipo de contrato válido, fecha de inicio y fecha de fin vigente y coherente.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_contrato_personal_activo ON public.personal;
CREATE TRIGGER trg_validar_contrato_personal_activo
BEFORE INSERT OR UPDATE OF activo, tipo_contrato, fecha_inicio, fecha_fin
ON public.personal
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_contrato_personal_activo();
