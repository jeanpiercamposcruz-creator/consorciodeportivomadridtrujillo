-- La restricción UNIQUE alumnos_qr_token_key ya cubre todos los valores
-- no nulos y permite múltiples NULL. El índice parcial duplicado no añade
-- integridad ni mejora la búsqueda por igualdad; se elimina para reducir
-- escrituras y mantenimiento de índices.
DROP INDEX IF EXISTS public.alumnos_qr_token_uidx;
