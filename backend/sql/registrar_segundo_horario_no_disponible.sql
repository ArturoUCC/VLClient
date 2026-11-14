-- PREPARADO, NO EJECUTADO. Requiere migrar_segundo_horario_no_disponible.sql.
-- Sustituir AMBOS valores 0 por id_cita e id_inquilino verificados.
-- Ejecutar la operación completa. Cero filas significa que no se emitió aviso.
-- No cambia fecha_cita, hora_cita, estado ni la oportunidad de reagendado.

BEGIN;

WITH objetivo AS (
  SELECT ci.id_cita, c.id_inquilino
  FROM public.citas AS ci
  JOIN public.reportes AS r ON r.id_reporte = ci.id_reporte
  JOIN public.contratos AS c ON c.id_contrato = r.id_contrato
  WHERE ci.id_cita = 0                 -- Reemplazar por id_cita
    AND c.id_inquilino = 0            -- Reemplazar por id_inquilino
    AND ci.estado = 'programada'
    AND ci.reagendado_estado = 'utilizado'
    AND ci.reagendado_usado_at IS NOT NULL
    AND ci.segundo_horario_no_disponible_at IS NULL
),
registro AS (
  UPDATE public.citas AS ci
  SET segundo_horario_no_disponible_at = NOW()
  FROM objetivo AS o
  WHERE ci.id_cita = o.id_cita
    AND ci.estado = 'programada'
    AND ci.reagendado_estado = 'utilizado'
    AND ci.reagendado_usado_at IS NOT NULL
    AND ci.segundo_horario_no_disponible_at IS NULL
  RETURNING ci.id_cita, ci.fecha_cita, ci.hora_cita,
            ci.segundo_horario_no_disponible_at
),
aviso AS (
  INSERT INTO public.notificaciones
    (id_inquilino, titulo, mensaje, tipo, accion_tipo, id_cita)
  SELECT
    o.id_inquilino,
    'Horario de cita no disponible',
    'El nuevo horario de tu cita #' || rg.id_cita ||
      ' (' || TO_CHAR(rg.fecha_cita, 'DD/MM/YYYY') ||
      ' a las ' || TO_CHAR(rg.hora_cita, 'HH24:MI') ||
      ') tampoco está disponible. La inmobiliaria se pondrá en contacto contigo para resolver el horario.',
    'cita',
    NULL,
    NULL
  FROM registro AS rg
  JOIN objetivo AS o ON o.id_cita = rg.id_cita
  RETURNING id_notificacion
)
SELECT rg.id_cita, o.id_inquilino, rg.fecha_cita, rg.hora_cita,
       rg.segundo_horario_no_disponible_at,
       (SELECT id_notificacion FROM aviso) AS id_notificacion
FROM registro AS rg
JOIN objetivo AS o ON o.id_cita = rg.id_cita;

COMMIT;
