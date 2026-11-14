-- PREPARADO, NO EJECUTADO. Aplicar después de migrar_reagendado_citas.sql.
-- El campo nulo conserva todas las citas existentes sin modificarlas.
-- La marca persistente permite emitir un único aviso administrativo por cita,
-- aunque el script se ejecute varias veces o en sesiones simultáneas.

BEGIN;

ALTER TABLE public.citas
  ADD COLUMN segundo_horario_no_disponible_at TIMESTAMPTZ;

ALTER TABLE public.citas
  ADD CONSTRAINT citas_segundo_horario_no_disponible_ck CHECK (
    segundo_horario_no_disponible_at IS NULL
    OR (
      reagendado_estado = 'utilizado'
      AND reagendado_usado_at IS NOT NULL
      AND segundo_horario_no_disponible_at >= reagendado_usado_at
    )
  );

COMMIT;
