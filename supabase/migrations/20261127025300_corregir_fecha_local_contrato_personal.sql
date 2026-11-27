-- Corrige la comparación de vencimiento para usar la fecha civil de Perú,
-- igual que la interfaz y la validación contractual previa.
CREATE OR REPLACE FUNCTION public.fn_validar_contrato_personal_en_cambios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_contrato_modificado boolean := false;
  v_hoy_peru date := (now() AT TIME ZONE 'America/Lima')::date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_contrato_modificado :=
      NEW.tipo_contrato IS DISTINCT FROM OLD.tipo_contrato
      OR NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio
      OR NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin
      OR NEW.precio_hora IS DISTINCT FROM OLD.precio_hora
      OR NEW.sueldo_fijo IS DISTINCT FROM OLD.sueldo_fijo
      OR NEW.jornada IS DISTINCT FROM OLD.jornada;
    IF NOT v_contrato_modificado
       AND NEW.activo IS NOT DISTINCT FROM OLD.activo THEN
      RETURN NEW;
    END IF;
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
  IF NEW.activo = 1 AND NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < v_hoy_peru THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'personal_contrato_activo_no_vencido_check',
      MESSAGE = 'No se puede crear, modificar o activar personal con un contrato vencido.';
  END IF;
  RETURN NEW;
END;
$function$;