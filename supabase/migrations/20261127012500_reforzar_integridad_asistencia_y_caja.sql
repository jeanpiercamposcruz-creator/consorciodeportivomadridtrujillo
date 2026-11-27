-- Refuerza los datos mínimos de asistencias y movimientos de Caja.
-- Los registros históricos se validan antes de crear las restricciones; no se modifican.
ALTER TABLE public.asistencias
  ADD CONSTRAINT asistencias_relacion_y_sesion_validas_check
  CHECK (
    fecha IS NOT NULL
    AND tipo IS NOT NULL
    AND horario_id IS NOT NULL
    AND btrim(horario_id) <> ''
    AND (
      (tipo = 'A' AND alumno_id IS NOT NULL AND personal_id IS NULL)
      OR
      (tipo = 'P' AND personal_id IS NOT NULL AND alumno_id IS NULL)
    )
  );

ALTER TABLE public.caja_movimientos
  ADD CONSTRAINT caja_movimientos_datos_obligatorios_check
  CHECK (
    fecha IS NOT NULL
    AND sede_id IS NOT NULL
    AND btrim(sede_id) <> ''
    AND tipo IS NOT NULL
    AND concepto IS NOT NULL
    AND btrim(concepto) <> ''
    AND monto > 0
  );
