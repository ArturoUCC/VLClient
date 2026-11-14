-- PREPARADO, NO EJECUTADO. Aplicar una sola vez tras verificar tipos y permisos.
-- Conserva notificaciones existentes: no las actualiza ni las encola.
-- Los avisos nuevos, incluidos los insertados por SQL administrativo, se
-- registrarán en una bandeja de salida dentro de su misma transacción.

BEGIN;

CREATE TABLE public.push_dispositivos (
  id_push_dispositivo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instalacion_id UUID NOT NULL,
  expo_push_token TEXT NOT NULL,
  expo_project_id UUID NOT NULL,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('android', 'ios')),
  sesion_version_registro INTEGER NOT NULL CHECK (sesion_version_registro >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desactivado_at TIMESTAMPTZ,
  ultimo_error_codigo TEXT,
  CONSTRAINT push_dispositivos_token_longitud_ck
    CHECK (LENGTH(expo_push_token) BETWEEN 1 AND 512),
  CONSTRAINT push_dispositivos_activo_ck
    CHECK ((activo AND desactivado_at IS NULL)
       OR (NOT activo AND desactivado_at IS NOT NULL))
);

CREATE TABLE public.push_notificaciones_outbox (
  encolado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  distribuido_at TIMESTAMPTZ
);

CREATE TABLE public.push_envios (
  id_push_envio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_push_dispositivo BIGINT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_proceso', 'aceptado',
                     'entregado', 'reintentar', 'fallido')),
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  proximo_intento_at TIMESTAMPTZ,
  bloqueo_hasta TIMESTAMPTZ,
  expo_ticket_id TEXT,
  enviado_at TIMESTAMPTZ,
  recibo_verificado_at TIMESTAMPTZ,
  ultimo_error_codigo TEXT,
  creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usa los tipos reales de las claves existentes para las referencias nuevas.
DO $$
DECLARE
  tipo_inquilino TEXT;
  tipo_notificacion TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_inquilino
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.inquilinos'::regclass
    AND a.attname = 'id_inquilino' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_notificacion
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.notificaciones'::regclass
    AND a.attname = 'id_notificacion' AND a.attnum > 0 AND NOT a.attisdropped;

  IF tipo_inquilino IS NULL OR tipo_notificacion IS NULL THEN
    RAISE EXCEPTION 'No se encontraron las claves de inquilinos/notificaciones';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.push_dispositivos ADD COLUMN id_inquilino %s NOT NULL REFERENCES public.inquilinos(id_inquilino)',
    tipo_inquilino
  );
  EXECUTE format(
    'ALTER TABLE public.push_notificaciones_outbox ADD COLUMN id_notificacion %s PRIMARY KEY REFERENCES public.notificaciones(id_notificacion) ON DELETE CASCADE',
    tipo_notificacion
  );
  EXECUTE format(
    'ALTER TABLE public.push_envios ADD COLUMN id_notificacion %s NOT NULL',
    tipo_notificacion
  );
  EXECUTE format(
    'ALTER TABLE public.push_envios ADD COLUMN id_inquilino %s NOT NULL',
    tipo_inquilino
  );
END $$;

-- Una instalación y un token solo pueden estar activos para un inquilino.
-- Las filas desactivadas se conservan para diagnóstico y rotación de tokens.
CREATE UNIQUE INDEX push_dispositivos_instalacion_activa_idx
  ON public.push_dispositivos(instalacion_id) WHERE activo;
CREATE UNIQUE INDEX push_dispositivos_token_activo_idx
  ON public.push_dispositivos(expo_push_token) WHERE activo;
CREATE INDEX push_dispositivos_inquilino_activo_idx
  ON public.push_dispositivos(id_inquilino) WHERE activo;

-- Las claves compuestas impiden enlazar un envío con el dispositivo de otro
-- inquilino. El índice sobre notificaciones no cambia ninguna fila anterior.
ALTER TABLE public.push_dispositivos
  ADD CONSTRAINT push_dispositivos_id_propietario_unico
    UNIQUE (id_push_dispositivo, id_inquilino);
ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_push_id_propietario_unico
    UNIQUE (id_notificacion, id_inquilino);
ALTER TABLE public.push_envios
  ADD CONSTRAINT push_envios_dispositivo_propietario_fk
    FOREIGN KEY (id_push_dispositivo, id_inquilino)
    REFERENCES public.push_dispositivos (id_push_dispositivo, id_inquilino),
  ADD CONSTRAINT push_envios_notificacion_propietario_fk
    FOREIGN KEY (id_notificacion, id_inquilino)
    REFERENCES public.notificaciones (id_notificacion, id_inquilino)
    ON DELETE CASCADE;

ALTER TABLE public.push_envios
  ADD CONSTRAINT push_envios_unico_por_dispositivo
    UNIQUE (id_notificacion, id_push_dispositivo);
CREATE UNIQUE INDEX push_envios_ticket_unico_idx
  ON public.push_envios(expo_ticket_id)
  WHERE expo_ticket_id IS NOT NULL;
CREATE INDEX push_envios_pendientes_idx
  ON public.push_envios(estado, proximo_intento_at, id_push_envio)
  WHERE estado IN ('pendiente', 'reintentar', 'en_proceso');
CREATE INDEX push_outbox_sin_distribuir_idx
  ON public.push_notificaciones_outbox(encolado_at, id_notificacion)
  WHERE distribuido_at IS NULL;

CREATE FUNCTION public.encolar_notificacion_push_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.push_notificaciones_outbox (id_notificacion)
  VALUES (NEW.id_notificacion)
  ON CONFLICT (id_notificacion) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notificaciones_encolar_push_trg
AFTER INSERT ON public.notificaciones
FOR EACH ROW EXECUTE FUNCTION public.encolar_notificacion_push_v1();

COMMIT;
