-- Evita importes negativos o con precision superior a dos decimales en alumnos.
-- Se permiten NULL para conservar compatibilidad con registros historicos opcionales.
ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_costo_matricula_valido_check
  CHECK (
    costo_matricula IS NULL
    OR (costo_matricula >= 0 AND costo_matricula = round(costo_matricula, 2))
  );

ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_costo_mensualidad_valido_check
  CHECK (
    costo_mensualidad IS NULL
    OR (costo_mensualidad >= 0 AND costo_mensualidad = round(costo_mensualidad, 2))
  );

ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_monto_pagado_valido_check
  CHECK (
    monto_pagado IS NULL
    OR (monto_pagado >= 0 AND monto_pagado = round(monto_pagado, 2))
  );

ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_monto_pagar_hoy_valido_check
  CHECK (
    monto_pagar_hoy IS NULL
    OR (monto_pagar_hoy >= 0 AND monto_pagar_hoy = round(monto_pagar_hoy, 2))
  );
