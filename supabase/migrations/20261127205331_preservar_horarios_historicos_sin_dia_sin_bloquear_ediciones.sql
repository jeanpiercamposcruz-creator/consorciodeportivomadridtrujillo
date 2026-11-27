-- Los horarios históricos con día desconocido se conservan sin inferirlo.
-- El CHECK valida valores no nulos; el trigger exige día en altas y cambios,
-- pero permite editar otros campos sin reescribir el NULL histórico.
ALTER TABLE public.horarios
  DROP CONSTRAINT IF EXISTS horarios_dia_semana_valido_check;

ALTER TABLE public.horarios
  ADD CONSTRAINT horarios_dia_semana_valido_check
  CHECK (dia_semana IS NULL OR dia_semana ~ '^[1-7]$') NOT VALID;

ALTER TABLE public.horarios
  VALIDATE CONSTRAINT horarios_dia_semana_valido_check;

CREATE OR REPLACE FUNCTION public.fn_validar_dia_semana_horario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.dia_semana IS NULL
     AND NEW.dia_semana IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.dia_semana IS NULL OR NEW.dia_semana !~ '^[1-7]$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El día del horario debe ser un valor entre 1 y 7.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validar_dia_semana_horario ON public.horarios;
CREATE TRIGGER trg_validar_dia_semana_horario
BEFORE INSERT OR UPDATE OF dia_semana
ON public.horarios
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_dia_semana_horario();
