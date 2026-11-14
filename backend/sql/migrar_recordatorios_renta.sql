-- PREPARADO, NO EJECUTADO. Ejecutar una sola vez, después de revisar el esquema.
-- No cambia estados de cuenta, pagos ni fechas de vencimiento.
-- Los avisos anteriores conservan sus datos: las tres columnas nuevas quedan NULL.

BEGIN;

ALTER TABLE public.inquilinos
  ADD COLUMN recordatorio_renta_dias SMALLINT NOT NULL DEFAULT 5;

ALTER TABLE public.inquilinos
  ADD CONSTRAINT inquilinos_recordatorio_renta_dias_ck
  CHECK (recordatorio_renta_dias BETWEEN 1 AND 31);

-- Igualar el tipo de la clave foránea al tipo real de la clave primaria.
DO $$
DECLARE
  tipo_id_estado_cuenta TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO tipo_id_estado_cuenta
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.estados_de_cuenta'::regclass
    AND a.attname = 'id_estado_cuenta'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF tipo_id_estado_cuenta IS NULL THEN
    RAISE EXCEPTION 'No se encontró public.estados_de_cuenta.id_estado_cuenta';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.notificaciones ADD COLUMN id_estado_cuenta %s',
    tipo_id_estado_cuenta
  );
END $$;

ALTER TABLE public.notificaciones
  ADD COLUMN fecha_limite_recordatorio DATE,
  ADD COLUMN dias_anticipacion SMALLINT;

ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_recordatorio_renta_fk
    FOREIGN KEY (id_estado_cuenta)
    REFERENCES public.estados_de_cuenta(id_estado_cuenta),
  ADD CONSTRAINT notificaciones_recordatorio_renta_consistencia_ck CHECK (
    (
      id_estado_cuenta IS NULL
      AND fecha_limite_recordatorio IS NULL
      AND dias_anticipacion IS NULL
    )
    OR (
      id_estado_cuenta IS NOT NULL
      AND fecha_limite_recordatorio IS NOT NULL
      AND dias_anticipacion IS NOT NULL
      AND dias_anticipacion BETWEEN 1 AND 31
      AND tipo IS NOT DISTINCT FROM 'pago'
      AND accion_tipo IS NULL
      AND id_cita IS NULL
    )
  );

-- La fecha y la anticipación son instantáneas de la configuración usada.
-- ON CONFLICT DO NOTHING podrá hacer idempotente la tarea diaria, aun si se
-- ejecuta más de una vez o en procesos simultáneos.
CREATE UNIQUE INDEX notificaciones_recordatorio_renta_unico_idx
  ON public.notificaciones
    (id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion)
  WHERE id_estado_cuenta IS NOT NULL;

COMMIT;
