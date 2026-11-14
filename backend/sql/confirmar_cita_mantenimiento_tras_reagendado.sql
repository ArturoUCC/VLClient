-- Sustituye al script de confirmación anterior DESPUÉS de aplicar la migración.
-- Mantiene la confirmación existente y evita confirmar una cita que está
-- esperando que el inquilino elija un nuevo horario.
-- Sustituye AMBOS valores 0 por id_cita e id_inquilino verificados.

WITH objetivo AS (
  SELECT ci.id_cita, c.id_inquilino
  FROM public.citas AS ci
  JOIN public.reportes AS r ON r.id_reporte = ci.id_reporte
  JOIN public.contratos AS c ON c.id_contrato = r.id_contrato
  WHERE ci.id_cita = 0                -- Reemplazar por id_cita
    AND c.id_inquilino = 0           -- Reemplazar por id_inquilino
    AND ci.estado = 'programada'
    AND ci.reagendado_estado <> 'solicitado'
),
cita_confirmada AS (
  UPDATE public.citas AS ci
  SET estado = 'confirmada'
  FROM objetivo AS o
  WHERE ci.id_cita = o.id_cita
    AND ci.estado = 'programada'
    AND ci.reagendado_estado <> 'solicitado'
  RETURNING ci.id_cita, ci.id_reporte, ci.fecha_cita, ci.hora_cita
),
aviso AS (
  INSERT INTO public.notificaciones (id_inquilino, titulo, mensaje, tipo)
  SELECT
    o.id_inquilino,
    'Cita de mantenimiento confirmada',
    'Tu cita #' || cc.id_cita || ' para el reporte #' || cc.id_reporte ||
      ' fue confirmada para el ' || TO_CHAR(cc.fecha_cita, 'DD/MM/YYYY') ||
      ' a las ' || TO_CHAR(cc.hora_cita, 'HH24:MI') || '.',
    'cita'
  FROM cita_confirmada AS cc
  JOIN objetivo AS o ON o.id_cita = cc.id_cita
  RETURNING id_notificacion
)
SELECT cc.id_cita, cc.id_reporte, o.id_inquilino,
       cc.fecha_cita, cc.hora_cita,
       (SELECT id_notificacion FROM aviso) AS id_notificacion
FROM cita_confirmada AS cc
JOIN objetivo AS o ON o.id_cita = cc.id_cita;
