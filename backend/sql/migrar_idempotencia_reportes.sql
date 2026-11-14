-- REVISAR Y EJECUTAR MANUALMENTE EN NEON ANTES DE HABILITAR LA
-- SINCRONIZACIÓN AUTOMÁTICA DE BORRADORES.
-- Los valores NULL conservan todos los reportes y fotografías anteriores.
-- Si alguna columna o índice ya existe, se detiene la transacción para
-- revisar su definición; no se acepta silenciosamente un objeto distinto.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.reportes
  ADD COLUMN clave_idempotencia UUID;

ALTER TABLE public.reporte_fotos
  ADD COLUMN clave_idempotencia UUID;

-- Una clave de solicitud identifica un único reporte, incluso si cambia
-- el contrato activo entre intentos. La API siempre debe comprobar
-- propiedad antes de devolver una fila existente.
CREATE UNIQUE INDEX reportes_clave_idempotencia_uidx
  ON public.reportes (clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;

-- Cada fotografía tiene su propia clave estable para que un reintento no
-- inserte dos filas del mismo adjunto. La API debe usar la misma clave.
CREATE UNIQUE INDEX reporte_fotos_id_reporte_clave_uidx
  ON public.reporte_fotos (id_reporte, clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;

COMMIT;
