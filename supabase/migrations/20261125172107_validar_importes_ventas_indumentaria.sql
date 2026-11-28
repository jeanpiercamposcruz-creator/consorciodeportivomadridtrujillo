-- Match the ERP's monetary validation at the database boundary.
-- Zero is allowed for complimentary items; negative, null, over-limit and
-- sub-cent amounts are rejected.
alter table public.kits_ventas
  add constraint kits_ventas_precio_publico_valido_check
  check (precio_publico is not null and precio_publico between 0 and 99999 and precio_publico = round(precio_publico, 2)),
  add constraint kits_ventas_costo_confeccion_valido_check
  check (costo_confeccion is not null and costo_confeccion between 0 and 99999 and costo_confeccion = round(costo_confeccion, 2));
