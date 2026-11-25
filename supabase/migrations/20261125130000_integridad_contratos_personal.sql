-- Integridad de contratos de alquiler y condiciones del personal.
-- NOT VALID conserva datos históricos; las nuevas escrituras sí deben cumplir.
alter table public.contratos_alquiler
  add constraint contratos_alquiler_fechas_validas_check
  check (fecha_fin >= fecha_inicio) not valid;
alter table public.contratos_alquiler
  add constraint contratos_alquiler_monto_positivo_check
  check (monto_mensual > 0) not valid;
alter table public.contratos_alquiler
  add constraint contratos_alquiler_url_segura_check
  check (documento_url is null or btrim(documento_url) = '' or documento_url ~* '^https?://') not valid;

create or replace function public.fn_validar_solapamiento_contrato_alquiler()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.vigente is true then
    perform pg_advisory_xact_lock(hashtextextended('contrato-alquiler:' || new.sede_id, 0));
    if exists (
      select 1
        from public.contratos_alquiler c
       where c.sede_id = new.sede_id
         and c.id <> new.id
         and c.vigente is true
         and daterange(c.fecha_inicio, c.fecha_fin, '[]')
             && daterange(new.fecha_inicio, new.fecha_fin, '[]')
    ) then
      raise exception using errcode = '23P01',
        message = 'Ya existe un contrato vigente que se cruza con esas fechas para esta sede.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_solapamiento_contrato_alquiler on public.contratos_alquiler;
create trigger trg_validar_solapamiento_contrato_alquiler
before insert or update of sede_id, fecha_inicio, fecha_fin, vigente
on public.contratos_alquiler
for each row execute function public.fn_validar_solapamiento_contrato_alquiler();

alter table public.personal
  add constraint personal_fechas_contrato_validas_check
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio) not valid;
alter table public.personal
  add constraint personal_tarifas_no_negativas_check
  check (coalesce(precio_hora, 0) >= 0 and coalesce(sueldo_fijo, 0) >= 0) not valid;
alter table public.personal
  add constraint personal_tipo_contrato_valido_check
  check (tipo_contrato is null or tipo_contrato in ('Planilla','Locación de servicios','Por horas')) not valid;

create unique index if not exists personal_dni_normalizado_uidx
  on public.personal (btrim(dni))
  where dni is not null and btrim(dni) <> '';
