-- Permitir que el UPSERT conserve contratos históricos incompletos si no cambia
-- ningún campo contractual. Las altas nuevas, cambios contractuales y reactivaciones
-- siguen sujetos a validación estricta. No se modifican filas existentes.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_validar_contrato_personal_activo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_revisar boolean := false;
  v_existente record;
  v_hoy_peru date := (now() AT TIME ZONE 'America/Lima')::date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- INSERT ... ON CONFLICT ejecuta BEFORE INSERT antes de resolver el conflicto.
    -- Si el id ya existe y los campos del contrato son idénticos, se trata de
    -- conservar un legado, no de activar ni modificar un contrato.
    SELECT p.activo, p.tipo_contrato, p.fecha_inicio, p.fecha_fin
      INTO v_existente
      FROM public.personal p
     WHERE p.id = NEW.id;

    IF FOUND THEN
      v_revisar :=
        NEW.activo IS DISTINCT FROM v_existente.activo
        OR NEW.tipo_contrato IS DISTINCT FROM v_existente.tipo_contrato
        OR NEW.fecha_inicio IS DISTINCT FROM v_existente.fecha_inicio
        OR NEW.fecha_fin IS DISTINCT FROM v_existente.fecha_fin;
    ELSE
      v_revisar := coalesce(NEW.activo, 0) = 1;
    END IF;
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

CREATE OR REPLACE FUNCTION public.fn_validar_contrato_personal_en_cambios()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_contrato_modificado boolean := false;
  v_existente record;
  v_hoy_peru date := (now() AT TIME ZONE 'America/Lima')::date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- En un UPSERT, permitir la fila candidata solo si coincide exactamente
    -- con el contrato existente. Los cambios reales sí pasan por validación.
    SELECT p.activo, p.tipo_contrato, p.fecha_inicio, p.fecha_fin,
           p.precio_hora, p.sueldo_fijo, p.jornada
      INTO v_existente
      FROM public.personal p
     WHERE p.id = NEW.id;

    IF FOUND THEN
      v_contrato_modificado :=
        NEW.activo IS DISTINCT FROM v_existente.activo
        OR NEW.tipo_contrato IS DISTINCT FROM v_existente.tipo_contrato
        OR NEW.fecha_inicio IS DISTINCT FROM v_existente.fecha_inicio
        OR NEW.fecha_fin IS DISTINCT FROM v_existente.fecha_fin
        OR NEW.precio_hora IS DISTINCT FROM v_existente.precio_hora
        OR NEW.sueldo_fijo IS DISTINCT FROM v_existente.sueldo_fijo
        OR NEW.jornada IS DISTINCT FROM v_existente.jornada;

      IF NOT v_contrato_modificado THEN
        RETURN NEW;
      END IF;
    END IF;
  ELSE
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

  -- Toda alta nueva o modificación contractual requiere datos completos,
  -- incluso si el registro queda inactivo. Un contrato vencido puede
  -- conservarse inactivo, pero no puede crearse/activarse como vigente.
  IF NEW.tipo_contrato IS NULL
     OR NEW.tipo_contrato NOT IN ('Planilla', 'Locación de servicios', 'Por horas')
     OR NEW.fecha_inicio IS NULL THEN
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

COMMENT ON FUNCTION public.fn_validar_contrato_personal_activo() IS
  'Valida altas y cambios de vigencia; permite UPSERT sin cambios de contrato sobre legados existentes.';
COMMENT ON FUNCTION public.fn_validar_contrato_personal_en_cambios() IS
  'Exige contrato completo en altas/cambios reales, pero conserva legados si el UPSERT no cambia campos contractuales.';

COMMIT;
