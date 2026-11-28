-- Evita DNI duplicados cuando dos usuarios registran al mismo alumno simultáneamente.
-- Se omiten valores nulos/vacíos para conservar matrículas históricas incompletas.
create unique index if not exists alumnos_dni_normalizado_uidx
  on public.alumnos (btrim(dni))
  where dni is not null and btrim(dni) <> '';
