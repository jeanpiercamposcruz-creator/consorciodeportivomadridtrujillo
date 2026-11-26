DROP POLICY IF EXISTS pre_insert ON public.preregistros;
CREATE POLICY pre_insert ON public.preregistros
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    fecha_hora >= now() - interval '5 minutes'
    AND fecha_hora <= now() + interval '5 minutes'
  );
GRANT INSERT ON TABLE public.preregistros TO anon;
