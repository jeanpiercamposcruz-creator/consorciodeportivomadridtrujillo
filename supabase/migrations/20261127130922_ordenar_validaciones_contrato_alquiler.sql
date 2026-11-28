-- El orden alfabético de triggers BEFORE del mismo evento es significativo.
-- Validar solapamiento ANTES de que la regla de contrato vigente desactive al anterior.
DROP TRIGGER IF EXISTS trg_unico_contrato_vigente_por_sede ON public.contratos_alquiler;
DROP TRIGGER IF EXISTS trg_validar_solapamiento_contrato_alquiler ON public.contratos_alquiler;

CREATE TRIGGER trg_00_validar_solapamiento_contrato_alquiler
BEFORE INSERT OR UPDATE OF sede_id, fecha_inicio, fecha_fin, vigente
ON public.contratos_alquiler
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_solapamiento_contrato_alquiler();

CREATE TRIGGER trg_10_unico_contrato_vigente_por_sede
BEFORE INSERT OR UPDATE OF vigente, sede_id
ON public.contratos_alquiler
FOR EACH ROW
EXECUTE FUNCTION public.fn_unico_contrato_vigente_por_sede();
