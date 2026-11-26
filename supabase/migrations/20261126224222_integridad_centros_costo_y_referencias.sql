ALTER TABLE public.centros_costo
  ADD CONSTRAINT centros_costo_codigo_valido_check
  CHECK (codigo = upper(btrim(codigo)) AND codigo ~ '^[A-Z0-9-]{2,12}$');

ALTER TABLE public.centros_costo
  ADD CONSTRAINT centros_costo_nombre_valido_check
  CHECK (length(btrim(nombre)) BETWEEN 1 AND 60);

CREATE UNIQUE INDEX centros_costo_codigo_uidx
  ON public.centros_costo (codigo);

ALTER TABLE public.sedes
  DROP CONSTRAINT IF EXISTS sedes_centro_costo_id_fkey;

ALTER TABLE public.sedes
  ADD CONSTRAINT sedes_centro_costo_id_fkey
  FOREIGN KEY (centro_costo_id)
  REFERENCES public.centros_costo(id)
  ON DELETE RESTRICT;
