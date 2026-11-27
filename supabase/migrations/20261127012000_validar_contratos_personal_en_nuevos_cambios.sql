-- Exige contrato completo al crear personal y al activar o modificar sus términos.
-- Conserva filas históricas incompletas cuando solo se editan campos ajenos al contrato.
CREATE OR REPLACE FUNCTION public.fn_validar_contrato_personal_en_cambios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_contrato_modificado boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_contrato_modificado :=
      NEW.tipo_contrato IS DISTINCT FROM OLD.tipo_contrato
      OR NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
      OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin
      OR NEW.precio_hora IS DISTINCT FROM OLD.precio_hora
      OR NEW.sueldo_fijo IS DISTINCT FROM OLD.sueldo_fijo
      OR NEW.jornada IS DISTINCT FROM OLD.jornada;

    -- No bloquear la edición de nombre, contacto, foto u otros campos
    -- de personal histórico cuyo contrato quedó incompleto.
    IF NOT v_contrato_modificado
       AND NEW.activo IS NOT DISTINCT FROM OLD.activo THEN
      RETURN NEW;
    END IF;

    -- Permitir desactivar personal histórico sin obligar a reconstruir su contrato.
    IF NEW.activo = 0 AND NOT v_contrato_modificado THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.tipo_contrato IS NULL OR NEW.fecha_inicio IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'personal_contrato_completo_check',
      MESSAGE = 'El tipo de contrato y la fecha de inicio son obligatorios para crear o modificar un contrato.';
  END IF;

  IF NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < NEW.fecha_inicio THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'personal_fechas_contrato_validas_check',
      MESSAGE = 'La fecha de fin no puede ser anterior a la fecha de inicio.';
  END IF;

  IF NEW.activo = 1 AND NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < CURRENT_DATE THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'personal_contrato_activo_no_vencido_check',
      MESSAGE = 'No se puede crear, modificar o activar personal con un contrato vencido.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_contrato_personal_en_cambios ON public.personal;
CREATE TRIGGER trg_validar_contrato_personal_en_cambios
BEFORE INSERT OR UPDATE OF activo, tipo_contrato, fecha_inicio, fecha_fin, precio_hora, sueldo_fijo, jornada
ON public.personal
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_contrato_personal_en_cambios();
