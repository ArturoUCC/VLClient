-- PREPARADO, NO EJECUTADO. Aplicar solo después de la migración.
-- Reemplaza AMBOS valores 0 por los identificadores verificados de cita e
-- inquilino. Ejecuta la sentencia completa en Neon, nunca un UPDATE aislado.
-- Sirve para citas activas programadas o confirmadas. No funciona si la
-- oportunidad ya fue solicitada o utilizada. Si devuelve cero filas, no cambió
-- la cita ni se creó una notificación.

BEGIN;

WITH objetivo AS (
  SELECT ci.id_cita, c.id_inquilino
  FROM public.citas AS ci
  JOIN public.reportes AS r ON r.id_reporte = ci.id_reporte
  JOIN public.contratos AS c ON c.id_contrato = r.id_contrato
  WHERE ci.id_cita = 0                 -- Reemplazar por id_cita
    AND c.id_inquilino = 0            -- Reemplazar por id_inquilino
    AND ci.estado IN ('programada', 'confirmada')
    AND ci.reagendado_estado = 'sin_solicitud'
    AND ci.reagendado_usado_at IS NULL
),
solicitud AS (
  UPDATE public.citas AS ci
  SET reagendado_estado = 'solicitado',
      reagendado_solicitado_at = NOW()
  FROM objetivo AS o
  WHERE ci.id_cita = o.id_cita
    AND ci.estado IN ('programada', 'confirmada')
    AND ci.reagendado_estado = 'sin_solicitud'
    AND ci.reagendado_usado_at IS NULL
  RETURNING ci.id_cita, ci.id_reporte, ci.fecha_cita, ci.hora_cita,
            ci.reagendado_estado
),
aviso AS (
  INSERT INTO public.notificaciones
    (id_inquilino, id_cita, accion_tipo, titulo, mensaje, tipo)
  SELECT
    o.id_inquilino,
    s.id_cita,
    'reagendar_cita',
    'Reagenda tu cita de mantenimiento',
    'La fecha u hora de tu cita #' || s.id_cita ||
      ' para el reporte #' || s.id_reporte ||
      ' (' || TO_CHAR(s.fecha_cita, 'DD/MM/YYYY') ||
      ' a las ' || TO_CHAR(s.hora_cita, 'HH24:MI') ||
      ') no está disponible. Puedes elegir un nuevo horario una sola vez.',
    'cita'
  FROM solicitud AS s
  JOIN objetivo AS o ON o.id_cita = s.id_cita
  RETURNING id_notificacion
)
SELECT s.id_cita, o.id_inquilino, s.reagendado_estado,
       s.fecha_cita, s.hora_cita,
       (SELECT id_notificacion FROM aviso) AS id_notificacion
FROM solicitud AS s
JOIN objetivo AS o ON o.id_cita = s.id_cita;

COMMIT;
