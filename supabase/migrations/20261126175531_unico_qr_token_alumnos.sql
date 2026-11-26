-- QA: asegurar que cada carnet QR identifica a un único alumno.
-- Los tokens existentes fueron auditados: 5 no nulos, todos base36 de 16 caracteres,
-- sin duplicados. Se conserva NULL para alumnos sin carnet generado.
CREATE UNIQUE INDEX IF NOT EXISTS alumnos_qr_token_uidx
  ON public.alumnos (qr_token)
  WHERE qr_token IS NOT NULL;

ALTER TABLE public.alumnos
  ADD CONSTRAINT alumnos_qr_token_formato_check
  CHECK (qr_token IS NULL OR qr_token ~ '^[a-z0-9]{16}$')
  NOT VALID;

ALTER TABLE public.alumnos
  VALIDATE CONSTRAINT alumnos_qr_token_formato_check;
