-- PREPARADO, NO EJECUTADO. Revisar diagnosticar_actualizacion.sql primero.
-- Requiere citas.fecha_cita DATE, citas.hora_cita TIME WITHOUT TIME ZONE,
-- citas.id_cita e id_reporte INTEGER y la restricción UNIQUE(fecha_cita,hora_cita).
-- Conserva fechas y horas históricas; enlaza cada cita a su horario.
-- Reversión documentada en backend/ACTUALIZACION_ADMIN.md; no restaurar
-- uq_cita_horario si un horario histórico fue reutilizado.
BEGIN;
LOCK TABLE public.citas IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.citas
    WHERE estado IN ('programada','confirmada')
    GROUP BY fecha_cita, hora_cita HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Hay citas activas duplicadas; revisar diagnóstico'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.citas
    WHERE estado IN ('programada','confirmada')
    GROUP BY id_reporte HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Hay reportes con varias citas activas'; END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='citas'
        AND column_name='fecha_cita') <> 'date'
     OR (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='citas'
        AND column_name='hora_cita') <> 'time without time zone' THEN
    RAISE EXCEPTION 'Tipos de fecha/hora no confirmados';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.fechas_citas (
  fecha DATE PRIMARY KEY,
  habilitada BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS public.horarios_citas (
  id_horario INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha DATE NOT NULL REFERENCES public.fechas_citas(fecha),
  hora TIME WITHOUT TIME ZONE NOT NULL,
  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT horarios_citas_fecha_hora_unico UNIQUE (fecha, hora),
  CONSTRAINT horarios_citas_identidad_fecha_hora_unico
    UNIQUE (id_horario, fecha, hora)
);

-- Los horarios históricos quedan vinculados pero cerrados. Un administrador
-- debe habilitar explícitamente fecha y horario antes de nuevas reservas.
INSERT INTO public.fechas_citas(fecha, habilitada)
SELECT fecha_cita, FALSE
FROM public.citas GROUP BY fecha_cita ON CONFLICT (fecha) DO NOTHING;
INSERT INTO public.horarios_citas(fecha, hora, habilitado)
SELECT fecha_cita, hora_cita, FALSE
FROM public.citas GROUP BY fecha_cita, hora_cita
ON CONFLICT (fecha, hora) DO NOTHING;

ALTER TABLE public.citas ADD COLUMN IF NOT EXISTS id_horario INTEGER;
UPDATE public.citas c SET id_horario = h.id_horario
FROM public.horarios_citas h
WHERE c.id_horario IS NULL AND h.fecha = c.fecha_cita AND h.hora = c.hora_cita;
ALTER TABLE public.citas ALTER COLUMN id_horario SET NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.citas WHERE id_horario IS NULL) THEN
    RAISE EXCEPTION 'Quedaron citas sin horario vinculado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.citas'::regclass
      AND conname='citas_horario_fecha_hora_fk') THEN
    ALTER TABLE public.citas ADD CONSTRAINT citas_horario_fecha_hora_fk
      FOREIGN KEY (id_horario, fecha_cita, hora_cita)
      REFERENCES public.horarios_citas(id_horario, fecha, hora);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reservas_citas (
  id_cita INTEGER PRIMARY KEY REFERENCES public.citas(id_cita),
  id_horario INTEGER NOT NULL UNIQUE REFERENCES public.horarios_citas(id_horario),
  fecha_reserva TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.reservas_citas(id_cita, id_horario)
SELECT id_cita, id_horario FROM public.citas
WHERE estado IN ('programada','confirmada')
ON CONFLICT (id_cita) DO NOTHING;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.citas c
    LEFT JOIN public.reservas_citas r ON r.id_cita=c.id_cita
    WHERE c.estado IN ('programada','confirmada')
      AND (r.id_cita IS NULL OR r.id_horario<>c.id_horario)
  ) OR EXISTS (
    SELECT 1 FROM public.reservas_citas r
    JOIN public.citas c ON c.id_cita=r.id_cita
    WHERE c.estado NOT IN ('programada','confirmada')
  ) THEN RAISE EXCEPTION 'Las reservas históricas requieren revisión'; END IF;
END $$;

-- Mantiene las reservas incluso ante operaciones administrativas directas
-- sobre citas y las libera al completar o cancelar una cita.
CREATE OR REPLACE FUNCTION public.sincronizar_reserva_cita_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado IN ('programada','confirmada') THEN
    INSERT INTO public.reservas_citas(id_cita,id_horario)
    VALUES(NEW.id_cita,NEW.id_horario)
    ON CONFLICT(id_cita) DO UPDATE SET
      id_horario=EXCLUDED.id_horario,fecha_reserva=NOW();
  ELSE
    DELETE FROM public.reservas_citas WHERE id_cita=NEW.id_cita;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS citas_sincronizar_reserva_trg ON public.citas;
CREATE TRIGGER citas_sincronizar_reserva_trg
AFTER INSERT OR UPDATE OF id_horario,estado ON public.citas
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_reserva_cita_fn();

CREATE UNIQUE INDEX IF NOT EXISTS citas_horario_activo_unico_idx
  ON public.citas(id_horario) WHERE estado IN ('programada','confirmada');
CREATE UNIQUE INDEX IF NOT EXISTS citas_reporte_activo_unico_idx
  ON public.citas(id_reporte) WHERE estado IN ('programada','confirmada');
CREATE INDEX IF NOT EXISTS horarios_citas_fecha_disponible_idx
  ON public.horarios_citas(fecha, habilitado, hora);

-- La restricción antigua también bloquea horarios de citas completadas o
-- canceladas. Se reemplaza por la unicidad parcial de las activas.
DO $$
DECLARE nombre TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.citas
    WHERE estado IN ('programada','confirmada')
    GROUP BY fecha_cita,hora_cita HAVING COUNT(*)>1) THEN
    RAISE EXCEPTION 'Se detectaron horarios activos duplicados antes del reemplazo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.citas
    WHERE estado IN ('programada','confirmada')
    GROUP BY id_reporte HAVING COUNT(*)>1) THEN
    RAISE EXCEPTION 'Se detectaron reportes con varias citas activas';
  END IF;
  SELECT con.conname INTO nombre FROM pg_constraint con
  WHERE con.conrelid = 'public.citas'::regclass AND con.contype = 'u'
    AND (SELECT array_agg(a.attname ORDER BY a.attname)
         FROM unnest(con.conkey) AS k(numero)
         JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=k.numero)
      = ARRAY['fecha_cita','hora_cita']::name[];
  IF nombre IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.citas DROP CONSTRAINT %I', nombre);
  ELSIF NOT EXISTS (SELECT 1 FROM pg_class
    WHERE relname='citas_fecha_hora_activas_unico_idx'
      AND relnamespace='public'::regnamespace) THEN
    RAISE EXCEPTION 'No se encontró la restricción UNIQUE histórica de fecha/hora';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS citas_fecha_hora_activas_unico_idx
  ON public.citas(fecha_cita, hora_cita)
  WHERE estado IN ('programada','confirmada');

COMMIT;
