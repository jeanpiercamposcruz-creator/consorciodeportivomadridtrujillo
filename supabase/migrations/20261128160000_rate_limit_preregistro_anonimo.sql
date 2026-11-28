-- Reduce abuso automatizado del formulario público y de las cargas de documentos.
-- El límite se aplica en PostgreSQL, incluso si se omite por completo el JavaScript.
-- Supabase expone la IP del cliente en request.headers (cf-connecting-ip/x-forwarded-for).

BEGIN;

CREATE TABLE IF NOT EXISTS private.anon_rate_limits (
  client_ip inet NOT NULL,
  scope text NOT NULL CHECK (scope IN ('preregistro', 'archivo')),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  PRIMARY KEY (client_ip, scope, window_start)
);

ALTER TABLE private.anon_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.anon_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.limitar_pre_registro(
  p_scope text,
  p_limite integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_headers jsonb;
  v_ip_text text;
  v_ip inet;
  v_window timestamptz;
  v_intentos integer;
BEGIN
  -- Los administradores autenticados no pasan por el límite público.
  IF coalesce(auth.role(), '') <> 'anon' THEN
    RETURN;
  END IF;

  IF p_scope NOT IN ('preregistro', 'archivo')
     OR p_limite IS NULL OR p_limite < 1 THEN
    RAISE EXCEPTION USING errcode = '22023',
      message = 'Configuración de límite público inválida.';
  END IF;

  v_headers := coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
  v_ip_text := coalesce(
    nullif(v_headers->>'cf-connecting-ip', ''),
    nullif(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1), ''),
    nullif(v_headers->>'x-real-ip', '')
  );

  IF v_ip_text IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501',
      message = 'No se pudo verificar el origen de la solicitud pública.';
  END IF;

  BEGIN
    v_ip := v_ip_text::inet;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING errcode = '42501',
      message = 'El origen de la solicitud pública no es válido.';
  END;

  v_window := date_trunc('hour', clock_timestamp());

  INSERT INTO private.anon_rate_limits(client_ip, scope, window_start, attempts)
  VALUES (v_ip, p_scope, v_window, 1)
  ON CONFLICT (client_ip, scope, window_start)
  DO UPDATE SET attempts = private.anon_rate_limits.attempts + 1
  RETURNING attempts INTO v_intentos;

  -- Conservar solo siete días de historial por IP.
  IF v_intentos = 1 THEN
    DELETE FROM private.anon_rate_limits
    WHERE client_ip = v_ip
      AND window_start < clock_timestamp() - interval '7 days';
  END IF;

  IF v_intentos > p_limite THEN
    RAISE EXCEPTION USING errcode = 'P0001',
      message = CASE p_scope
        WHEN 'preregistro' THEN 'Se alcanzó el límite temporal de pre-registros desde esta conexión. Intenta más tarde.'
        ELSE 'Se alcanzó el límite temporal de archivos desde esta conexión. Intenta más tarde.'
      END;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION private.limitar_pre_registro(text, integer)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.trg_limitar_pre_registros()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  PERFORM private.limitar_pre_registro('preregistro', 10);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.trg_limitar_archivos_pre_registro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  IF NEW.bucket_id = 'documentos'
     AND NEW.name ~ '^preregistro/' THEN
    PERFORM private.limitar_pre_registro('archivo', 40);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.trg_limitar_pre_registros()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.trg_limitar_archivos_pre_registro()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_limitar_pre_registros ON public.preregistros;
CREATE TRIGGER trg_limitar_pre_registros
BEFORE INSERT ON public.preregistros
FOR EACH ROW EXECUTE FUNCTION private.trg_limitar_pre_registros();

DROP TRIGGER IF EXISTS trg_limitar_archivos_pre_registro ON storage.objects;
CREATE TRIGGER trg_limitar_archivos_pre_registro
BEFORE INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION private.trg_limitar_archivos_pre_registro();

COMMENT ON TABLE private.anon_rate_limits IS
  'Contadores privados de solicitudes anónimas por IP y ventana horaria para pre-registro y documentos.';

COMMIT;
