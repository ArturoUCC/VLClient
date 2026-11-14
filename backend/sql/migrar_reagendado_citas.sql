-- PREPARADO, NO EJECUTADO. Revisar primero inspeccionar_esquema_reagendado.sql.
-- La transacción revierte todas las modificaciones si una restricción no coincide.
-- Conserva las columnas y valores previos de las citas y notificaciones;
-- los nuevos campos quedan en sin_solicitud / NULL por defecto.

BEGIN;

ALTER TABLE public.citas
  ADD COLUMN reagendado_estado TEXT NOT NULL DEFAULT 'sin_solicitud',
  ADD COLUMN reagendado_solicitado_at TIMESTAMPTZ,
  ADD COLUMN reagendado_usado_at TIMESTAMPTZ;

ALTER TABLE public.citas
  ADD CONSTRAINT citas_reagendado_consistencia_ck CHECK (
    (reagendado_estado = 'sin_solicitud'
      AND reagendado_solicitado_at IS NULL
      AND reagendado_usado_at IS NULL)
    OR (reagendado_estado = 'solicitado'
      AND reagendado_solicitado_at IS NOT NULL
      AND reagendado_usado_at IS NULL)
    OR (reagendado_estado = 'utilizado'
      AND reagendado_solicitado_at IS NOT NULL
      AND reagendado_usado_at IS NOT NULL
      AND reagendado_usado_at >= reagendado_solicitado_at)
  );

ALTER TABLE public.notificaciones
  ADD COLUMN accion_tipo TEXT;

-- Usa exactamente el tipo real de citas.id_cita para la nueva referencia.
DO $$
DECLARE
  tipo_id_cita TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO tipo_id_cita
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.citas'::regclass
    AND a.attname = 'id_cita'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF tipo_id_cita IS NULL THEN
    RAISE EXCEPTION 'No se encontró public.citas.id_cita';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.notificaciones ADD COLUMN id_cita %s',
    tipo_id_cita
  );
END $$;

ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_reagendado_accion_ck CHECK (
    (accion_tipo IS NULL AND id_cita IS NULL)
    OR (accion_tipo IS NOT NULL
      AND accion_tipo = 'reagendar_cita'
      AND id_cita IS NOT NULL)
  ),
  ADD CONSTRAINT notificaciones_reagendado_cita_fk
    FOREIGN KEY (id_cita) REFERENCES public.citas(id_cita);

-- Solo una notificación accionable de reagendado por cita, incluso ante
-- intentos simultáneos o una ejecución accidental repetida del script.
CREATE UNIQUE INDEX notificaciones_reagendado_unico_idx
  ON public.notificaciones(id_cita)
  WHERE accion_tipo = 'reagendar_cita';

COMMIT;
