-- Índices para columnas FK activas que se consultan y actualizan con frecuencia.
-- No altera filas; mejora joins y evita escaneos al borrar/actualizar padres.

create index if not exists alumnos_deporte_id_idx on public.alumnos (deporte_id);
create index if not exists alumnos_horario_id_idx on public.alumnos (horario_id);
create index if not exists alumnos_sede_id_idx on public.alumnos (sede_id);

create index if not exists asistencias_alumno_id_idx on public.asistencias (alumno_id);
create index if not exists asistencias_horario_id_idx on public.asistencias (horario_id);
create index if not exists asistencias_personal_id_idx on public.asistencias (personal_id);

create index if not exists caja_movimientos_sede_id_idx on public.caja_movimientos (sede_id);
create index if not exists contratos_alquiler_sede_id_idx on public.contratos_alquiler (sede_id);
create index if not exists cronograma_cuotas_alumno_id_idx on public.cronograma_cuotas (alumno_id);

-- horario_id ya es la primera columna del índice único horario_personal.
create index if not exists horario_profesores_personal_id_idx on public.horario_profesores (personal_id);

create index if not exists horarios_deporte_id_idx on public.horarios (deporte_id);
create index if not exists horarios_sede_id_idx on public.horarios (sede_id);

create index if not exists kits_ventas_alumno_id_idx on public.kits_ventas (alumno_id);
create index if not exists kits_ventas_sede_id_idx on public.kits_ventas (sede_id);

create index if not exists perfiles_personal_id_idx on public.perfiles (personal_id);
create index if not exists personal_certificaciones_personal_id_idx on public.personal_certificaciones (personal_id);
create index if not exists personal_sedes_sede_id_idx on public.personal_sedes (sede_id);

create index if not exists preregistros_deporte_id_idx on public.preregistros (deporte_id);
create index if not exists preregistros_sede_id_idx on public.preregistros (sede_id);
create index if not exists sedes_centro_costo_id_idx on public.sedes (centro_costo_id);
