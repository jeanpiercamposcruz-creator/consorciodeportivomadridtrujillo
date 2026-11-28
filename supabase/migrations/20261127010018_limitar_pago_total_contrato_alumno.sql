-- Impide que la ficha de un alumno registre pagos superiores al contrato
-- y limita la cantidad de mensualidades a la misma regla que aplica la interfaz.
-- Los NULL históricos se conservan; no se actualizan registros existentes.
ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_meses_contratados_rango_check
  CHECK (meses IS NULL OR meses BETWEEN 0 AND 36);

ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_monto_pagado_no_supera_contrato_check
  CHECK (
    monto_pagado IS NULL
    OR monto_pagado <= round(
      coalesce(costo_matricula, 0)
      + coalesce(costo_mensualidad, 0) * coalesce(meses, 0),
      2
    )
  );
