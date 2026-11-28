-- Cierre en profundidad de los RPC del ERP: ADM es el único rol funcional.
-- Las funciones ya consultan rol_actual(), pero conservaban listas heredadas
-- REC/ENT. Se endurecen también sus comprobaciones locales para evitar regresiones
-- si en el futuro cambia el helper central.

BEGIN;

DO $migration$
DECLARE
  v_def text;
  v_old text;
BEGIN
  v_def := pg_get_functiondef('public.erp_obtener_lote()'::regprocedure);
  v_old := 'IF coalesce(v_rol, '''') NOT IN (''ADM'',''REC'',''ENT'') THEN';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontró la comprobación heredada de roles en erp_obtener_lote().';
  END IF;
  EXECUTE replace(v_def, v_old, 'IF v_rol IS DISTINCT FROM ''ADM'' THEN');

  v_def := pg_get_functiondef('public.erp_persistir_lote(jsonb)'::regprocedure);
  v_old := 'IF coalesce(public.rol_actual(), '''') NOT IN (''ADM'', ''REC'', ''ENT'') THEN';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontró la comprobación heredada de roles en erp_persistir_lote(jsonb).';
  END IF;
  EXECUTE replace(v_def, v_old, 'IF public.rol_actual() IS DISTINCT FROM ''ADM'' THEN');

  v_def := pg_get_functiondef('public.siguiente_id_matricula(smallint)'::regprocedure);
  v_old := 'if coalesce(public.rol_actual(), '''') not in (''ADM'', ''REC'') then';
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'No se encontró la comprobación heredada de roles en siguiente_id_matricula(smallint).';
  END IF;
  EXECUTE replace(v_def, v_old, 'if public.rol_actual() is distinct from ''ADM'' then');
END
$migration$;

COMMENT ON FUNCTION public.erp_obtener_lote() IS
  'Carga el lote del ERP exclusivamente para el rol ADM.';
COMMENT ON FUNCTION public.erp_persistir_lote(jsonb) IS
  'Persiste lotes ERP exclusivamente para el rol ADM; conserva validaciones de snapshot financiero y transacción atómica.';
COMMENT ON FUNCTION public.siguiente_id_matricula(smallint) IS
  'Genera IDs de matrícula exclusivamente para el rol ADM.';

COMMIT;
