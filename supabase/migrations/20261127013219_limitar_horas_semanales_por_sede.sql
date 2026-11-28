-- Horas semanales por sede: rango físico máximo de 168 horas y precisión de centésimas.
ALTER TABLE public.personal_sedes
  ADD CONSTRAINT personal_sedes_horas_semanales_validas_check
  CHECK (
    horas_semanales IS NULL
    OR (
      horas_semanales >= 0
      AND horas_semanales <= 168
      AND horas_semanales = round(horas_semanales, 2)
    )
  );
