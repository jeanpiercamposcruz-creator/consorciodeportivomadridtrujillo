CREATE OR REPLACE FUNCTION public.fn_validar_reversion_pago_matricula()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_original_id text;
  v_original_monto numeric;
  v_original_tipo text;
  v_original_concepto text;
  v_original_detalle text;
  v_original_sede text;
  v_original_origen text;
  v_total_revertido numeric;
  v_es_campo boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_user = 'postgres' THEN
      RETURN OLD;
    END IF;

    -- Eliminar solo movimientos de fixtures QA-MAT exactos y bajo rol ADM.
    IF length(OLD.detalle)=6
       AND OLD.detalle ~ '^[0-9]{6}'
       AND public.rol_actual() = 'ADM'
       AND EXISTS (
         SELECT 1 FROM public.alumnos a
         WHERE a.id=OLD.detalle
           AND a.nombres='QA'
           AND a.apellidos='Persistencia'
           AND length(a.dni)=8
           AND a.dni ~ '^[0-9]{8}'
       )
       AND (
         (OLD.tipo='I' AND OLD.concepto='Matrícula / mensualidad')
         OR (OLD.tipo='E' AND OLD.concepto='Reversión de pago de matrícula'
             AND OLD.origen LIKE 'reversion:%')
       ) THEN
      RETURN OLD;
    END IF;

    -- La excepción QA-ATT replica las marcas y relaciones exactas de la
    -- guardia principal; ambas protecciones deben aprobar el mismo fixture.
    IF OLD.detalle ~ '^QA-ATT-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       AND public.rol_actual() = 'ADM'
       AND EXISTS (
         SELECT 1
         FROM public.alumnos a
         JOIN public.horarios h ON h.id = a.horario_id
         WHERE a.id = OLD.detalle
           AND a.nombres = 'QA'
           AND a.apellidos = 'Asistencia Temporal'
           AND a.dni ~ '^[0-9]{8}$'
           AND a.estado = 'Activo'
           AND a.fecha_nacimiento = make_date(h.categoria, 1, 1)
           AND a.sede_id = h.sede_id
           AND a.deporte_id = h.deporte_id
           AND a.costo_matricula = 0
           AND a.costo_mensualidad = 0
           AND a.meses = 0
           AND coalesce(a.monto_pagado, 0) = 0
           AND coalesce(a.monto_pagar_hoy, 0) = 0
       )
       AND (
         (
           OLD.tipo = 'I'
           AND OLD.concepto = 'Pago de campo'
           AND OLD.origen LIKE 'campo|%'
           AND array_length(string_to_array(OLD.origen, '|'), 1) = 5
           AND split_part(OLD.origen, '|', 2) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           AND OLD.fecha::text = split_part(OLD.origen, '|', 2)
           AND split_part(OLD.origen, '|', 3) = OLD.detalle
           AND split_part(OLD.origen, '|', 4) = (
             SELECT a.horario_id FROM public.alumnos a WHERE a.id = OLD.detalle
           )
           AND split_part(OLD.origen, '|', 5) = OLD.id
           AND OLD.sede_id = (
             SELECT a.sede_id FROM public.alumnos a WHERE a.id = OLD.detalle
           )
         )
         OR
         (
           OLD.tipo = 'E'
           AND OLD.concepto = 'Reversión de pago de campo'
           AND EXISTS (
             SELECT 1
             FROM public.caja_movimientos ingreso
             WHERE OLD.origen = 'reversion-campo:' || ingreso.id
               AND ingreso.tipo = 'I'
               AND ingreso.concepto = 'Pago de campo'
               AND ingreso.detalle = OLD.detalle
               AND ingreso.sede_id = OLD.sede_id
               AND ingreso.monto = OLD.monto
               AND ingreso.origen LIKE 'campo|%'
               AND array_length(string_to_array(ingreso.origen, '|'), 1) = 5
               AND split_part(ingreso.origen, '|', 2) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
               AND ingreso.fecha::text = split_part(ingreso.origen, '|', 2)
               AND split_part(ingreso.origen, '|', 3) = ingreso.detalle
               AND split_part(ingreso.origen, '|', 4) = (
                 SELECT a.horario_id FROM public.alumnos a WHERE a.id = OLD.detalle
               )
               AND split_part(ingreso.origen, '|', 5) = ingreso.id
           )
         )
       ) THEN
      RETURN OLD;
    END IF;

    IF OLD.origen LIKE 'reversion:%' OR OLD.origen LIKE 'reversion-campo:%' THEN
      RAISE EXCEPTION USING ERRCODE='23514',
        MESSAGE='No se puede eliminar una reversión; debe conservarse la auditoría.';
    END IF;

    SELECT COALESCE(SUM(c.monto),0) INTO v_total_revertido
    FROM public.caja_movimientos c
    WHERE c.tipo='E' AND c.origen IN ('reversion:'||OLD.id,'reversion-campo:'||OLD.id);
    IF v_total_revertido > 0 THEN
      RAISE EXCEPTION USING ERRCODE='23514',
        MESSAGE='No se puede eliminar un ingreso que ya tiene reversiones vinculadas.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.origen LIKE 'reversion:%' OR OLD.origen LIKE 'reversion-campo:%')
       AND (
         NEW.id IS DISTINCT FROM OLD.id OR NEW.origen IS DISTINCT FROM OLD.origen
         OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.concepto IS DISTINCT FROM OLD.concepto
         OR NEW.detalle IS DISTINCT FROM OLD.detalle OR NEW.sede_id IS DISTINCT FROM OLD.sede_id
         OR NEW.monto IS DISTINCT FROM OLD.monto
       ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='No se puede modificar una reversión registrada.';
    END IF;
    SELECT COALESCE(SUM(c.monto),0) INTO v_total_revertido
    FROM public.caja_movimientos c
    WHERE c.tipo='E' AND c.origen IN ('reversion:'||OLD.id,'reversion-campo:'||OLD.id);
    IF v_total_revertido > 0
       AND (
         NEW.id IS DISTINCT FROM OLD.id OR NEW.tipo IS DISTINCT FROM 'I'
         OR NEW.concepto IS DISTINCT FROM OLD.concepto
         OR NEW.detalle IS DISTINCT FROM OLD.detalle OR NEW.sede_id IS DISTINCT FROM OLD.sede_id
         OR NEW.origen IS DISTINCT FROM OLD.origen OR NEW.monto IS DISTINCT FROM OLD.monto
       ) THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='No se puede alterar un ingreso que ya tiene reversiones registradas.';
    END IF;
  END IF;

  IF NEW.origen LIKE 'reversion:%' THEN
    v_original_id := substring(NEW.origen FROM 11);
    v_es_campo := false;
  ELSIF NEW.origen LIKE 'reversion-campo:%' THEN
    v_original_id := substring(NEW.origen FROM char_length('reversion-campo:') + 1);
    v_es_campo := true;
  ELSE
    RETURN NEW;
  END IF;

  IF v_original_id = '' THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='La reversión no identifica el ingreso original de Caja.';
  END IF;
  IF NEW.tipo IS DISTINCT FROM 'E' OR NEW.monto IS NULL OR NEW.monto <= 0
     OR (v_es_campo AND NEW.concepto IS DISTINCT FROM 'Reversión de pago de campo')
     OR (NOT v_es_campo AND NEW.concepto IS DISTINCT FROM 'Reversión de pago de matrícula') THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='La reversión debe ser un egreso positivo con concepto válido.';
  END IF;

  SELECT c.monto,c.tipo,c.concepto,c.detalle,c.sede_id,c.origen
  INTO v_original_monto,v_original_tipo,v_original_concepto,v_original_detalle,v_original_sede,v_original_origen
  FROM public.caja_movimientos c WHERE c.id=v_original_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='No existe el ingreso original de Caja que se intenta revertir.';
  END IF;

  IF v_es_campo THEN
    IF v_original_tipo IS DISTINCT FROM 'I' OR v_original_concepto IS DISTINCT FROM 'Pago de campo'
       OR v_original_detalle IS DISTINCT FROM NEW.detalle OR v_original_sede IS DISTINCT FROM NEW.sede_id
       OR v_original_origen NOT LIKE 'campo|%' THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='La reversión no corresponde a un ingreso de campo del mismo alumno y sede.';
    END IF;
  ELSE
    IF v_original_tipo IS DISTINCT FROM 'I' OR v_original_concepto IS DISTINCT FROM 'Matrícula / mensualidad'
       OR v_original_detalle IS DISTINCT FROM NEW.detalle THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='La reversión no corresponde a un ingreso de matrícula del mismo alumno.';
    END IF;
  END IF;

  SELECT COALESCE(SUM(c.monto),0) INTO v_total_revertido
  FROM public.caja_movimientos c
  WHERE c.origen=NEW.origen AND c.tipo='E' AND c.id IS DISTINCT FROM NEW.id;
  IF ROUND(v_total_revertido + NEW.monto,2) > ROUND(v_original_monto,2) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='La reversión supera el saldo disponible del ingreso original.';
  END IF;
  RETURN NEW;
END;
$function$
