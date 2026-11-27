CREATE OR REPLACE FUNCTION public.fn_validar_horario_alumno()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_horario public.horarios%rowtype;
BEGIN
  -- Los registros históricos sin horario pueden editar campos ajenos a la
  -- relación académica, pero no cambiar sede/deporte/categoría sin asignarlo.
  IF TG_OP = 'UPDATE'
     AND NEW.horario_id IS NOT DISTINCT FROM OLD.horario_id
     AND NEW.sede_id IS NOT DISTINCT FROM OLD.sede_id
     AND NEW.deporte_id IS NOT DISTINCT FROM OLD.deporte_id
     AND NEW.fecha_nacimiento IS NOT DISTINCT FROM OLD.fecha_nacimiento THEN
    RETURN NEW;
  END IF;

  IF NEW.horario_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Toda matrícula nueva o cambio de sede, deporte o categoría requiere un horario válido.';
  END IF;

  SELECT *
    INTO v_horario
    FROM public.horarios
   WHERE id = NEW.horario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'El horario seleccionado no existe.';
  END IF;

  IF coalesce(v_horario.estado, 'Activo') <> 'Activo' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'No se puede matricular al alumno en un horario inactivo.';
  END IF;

  IF NEW.sede_id IS DISTINCT FROM v_horario.sede_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La sede del alumno no coincide con la sede del horario.';
  END IF;

  IF NEW.deporte_id IS DISTINCT FROM v_horario.deporte_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'El deporte del alumno no coincide con el deporte del horario.';
  END IF;

  IF NEW.fecha_nacimiento IS NULL
     OR extract(year from NEW.fecha_nacimiento)::integer <> v_horario.categoria THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La categoría del horario no coincide con el año de nacimiento del alumno.';
  END IF;

  RETURN NEW;
END;
$function$;