-- La información salarial y contractual completa solo la pueden consultar administradores.
-- REC y ENT reciben un directorio público con datos mínimos a través de una vista.
create or replace view public.personal_publico
with (security_barrier = true)
as
select id, nombres, rol, especialidad, activo, foto
from public.personal;

revoke all on public.personal_publico from anon, public;
grant select on public.personal_publico to authenticated;

drop policy if exists lee_personal on public.personal;
create policy lee_personal
on public.personal
for select
to authenticated
using (
  public.rol_actual() = 'ADM'
  or (public.rol_actual() = 'ENT' and id = public.mi_personal())
);
