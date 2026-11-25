-- Revisar primero diagnosticar_actualizacion.sql. Ejecutar manualmente en Neon.
-- No altera inquilinos ni sus sesiones. Reversión: detener las rutas administrativas,
-- respaldar bitácora y administradores, y eliminar estas tablas en orden inverso.
BEGIN;

CREATE TABLE IF NOT EXISTS public.administradores (
  id_administrador INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 100),
  apellido TEXT NOT NULL CHECK (length(trim(apellido)) BETWEEN 1 AND 100),
  correo TEXT NOT NULL CHECK (length(correo) <= 254),
  password_hash TEXT NOT NULL CHECK (
    length(password_hash)=60 AND
    substring(password_hash FROM 1 FOR 4) IN ('$2a$','$2b$','$2y$')
  ),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  sesion_version INTEGER NOT NULL DEFAULT 0 CHECK (sesion_version >= 0),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS administradores_correo_unico_idx
  ON public.administradores (lower(correo));

CREATE TABLE IF NOT EXISTS public.bitacora_administrativa (
  id_bitacora BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_administrador INTEGER NOT NULL
    REFERENCES public.administradores(id_administrador),
  accion TEXT NOT NULL CHECK (length(accion) BETWEEN 1 AND 80),
  entidad TEXT NOT NULL CHECK (length(entidad) BETWEEN 1 AND 80),
  entidad_id INTEGER,
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bitacora_administrativa_fecha_idx
  ON public.bitacora_administrativa (fecha DESC, id_bitacora DESC);
CREATE INDEX IF NOT EXISTS bitacora_administrativa_actor_idx
  ON public.bitacora_administrativa (id_administrador, fecha DESC);

COMMIT;
