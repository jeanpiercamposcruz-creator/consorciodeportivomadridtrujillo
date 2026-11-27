-- Homologa los límites monetarios de la base de datos con el validador del ERP.
-- El análisis previo confirmó que los registros actuales cumplen estos rangos.
ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_importes_maximos_check
  CHECK (
    (costo_matricula IS NULL OR costo_matricula <= 99999)
    AND (costo_mensualidad IS NULL OR costo_mensualidad <= 99999)
    AND (monto_pagado IS NULL OR monto_pagado <= 99999)
    AND (monto_pagar_hoy IS NULL OR monto_pagar_hoy <= 99999)
  );

ALTER TABLE public.personal
  ADD CONSTRAINT personal_importes_maximos_y_precision_check
  CHECK (
    (precio_hora IS NULL OR (precio_hora <= 99999 AND precio_hora = round(precio_hora, 2)))
    AND (sueldo_fijo IS NULL OR (sueldo_fijo <= 99999 AND sueldo_fijo = round(sueldo_fijo, 2)))
  );

ALTER TABLE public.sedes
  ADD CONSTRAINT sedes_costo_mensual_valido_check
  CHECK (
    costo_mensual IS NULL
    OR (costo_mensual >= 0 AND costo_mensual <= 99999 AND costo_mensual = round(costo_mensual, 2))
  );

ALTER TABLE public.caja_movimientos
  ADD CONSTRAINT caja_movimientos_monto_maximo_check
  CHECK (monto <= 99999);

ALTER TABLE public.cronograma_cuotas
  ADD CONSTRAINT cronograma_cuotas_importes_maximos_y_precision_check
  CHECK (
    monto <= 99999
    AND monto = round(monto, 2)
    AND monto_abonado <= 99999
    AND monto_abonado = round(monto_abonado, 2)
    AND saldo_pendiente <= 99999
    AND saldo_pendiente = round(saldo_pendiente, 2)
  );

ALTER TABLE public.contratos_alquiler
  ADD CONSTRAINT contratos_alquiler_monto_maximo_y_precision_check
  CHECK (monto_mensual <= 99999 AND monto_mensual = round(monto_mensual, 2));
