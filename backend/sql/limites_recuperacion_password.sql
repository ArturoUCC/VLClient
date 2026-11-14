-- Aplicar manualmente en Neon antes de habilitar los endpoints de recuperación.
CREATE TABLE IF NOT EXISTS public.limites_recuperacion_password (
  clave CHAR(64) PRIMARY KEY,
  ventana_inicio TIMESTAMPTZ NOT NULL,
  intentos INTEGER NOT NULL CHECK (intentos > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS recuperaciones_password_token_hash_uidx
  ON public.recuperaciones_password (token_hash);
