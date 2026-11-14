-- CONSULTAS DE SOLO LECTURA. Ejecutar únicamente después de la migración.
-- No insertan ni actualizan datos.

-- 1. Comprobar columnas, tipos, valores predeterminados y nulabilidad.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'inquilinos' AND column_name = 'recordatorio_renta_dias')
    OR (table_name = 'notificaciones' AND column_name IN
      ('id_estado_cuenta', 'fecha_limite_recordatorio', 'dias_anticipacion'))
  )
ORDER BY table_name, column_name;

-- 2. Comprobar restricciones y el índice único parcial.
SELECT conname, contype, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid IN ('public.inquilinos'::regclass,
                   'public.notificaciones'::regclass)
  AND conname IN (
    'inquilinos_recordatorio_renta_dias_ck',
    'notificaciones_recordatorio_renta_fk',
    'notificaciones_recordatorio_renta_consistencia_ck'
  )
ORDER BY conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'notificaciones'
  AND indexname = 'notificaciones_recordatorio_renta_unico_idx';

-- 3. Después de migrar, todos los inquilinos previos deben tener 5 días.
SELECT recordatorio_renta_dias, COUNT(*) AS inquilinos
FROM public.inquilinos
GROUP BY recordatorio_renta_dias
ORDER BY recordatorio_renta_dias;

-- 4. Los avisos anteriores deben conservar sus tipos y no tener datos de renta.
SELECT tipo, accion_tipo, COUNT(*) AS notificaciones,
       COUNT(*) FILTER (WHERE id_estado_cuenta IS NOT NULL) AS recordatorios
FROM public.notificaciones
GROUP BY tipo, accion_tipo
ORDER BY tipo, accion_tipo;

-- 5. Debe devolver cero filas si la restricción de consistencia se cumple.
SELECT id_notificacion
FROM public.notificaciones
WHERE (
  (id_estado_cuenta IS NULL AND fecha_limite_recordatorio IS NULL
    AND dias_anticipacion IS NULL)
  OR (id_estado_cuenta IS NOT NULL AND fecha_limite_recordatorio IS NOT NULL
    AND dias_anticipacion BETWEEN 1 AND 31
    AND tipo IS NOT DISTINCT FROM 'pago'
    AND accion_tipo IS NULL AND id_cita IS NULL)
) IS NOT TRUE;

-- 6. Debe devolver cero filas si no hay recordatorios duplicados.
SELECT id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion,
       COUNT(*) AS veces
FROM public.notificaciones
WHERE id_estado_cuenta IS NOT NULL
GROUP BY id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion
HAVING COUNT(*) > 1;

-- 7. Caso de prueba: confirmar propietario, vencimiento y saldo calculado.
-- Un pago parcial no equivale por sí solo a un estado de cuenta pagado.
SELECT ec.id_estado_cuenta, c.id_inquilino, ec.fecha_limite,
       ec.estado, ec.total,
       COALESCE(SUM(p.monto), 0) AS total_pagado_calculado,
       ec.total - COALESCE(SUM(p.monto), 0) AS saldo_calculado,
       i.recordatorio_renta_dias
FROM public.estados_de_cuenta AS ec
JOIN public.contratos AS c ON c.id_contrato = ec.id_contrato
JOIN public.inquilinos AS i ON i.id_inquilino = c.id_inquilino
LEFT JOIN public.pagos AS p ON p.id_estado_cuenta = ec.id_estado_cuenta
WHERE ec.id_estado_cuenta = 8 AND c.id_inquilino = 2
GROUP BY ec.id_estado_cuenta, c.id_inquilino, ec.fecha_limite,
         ec.estado, ec.total, i.recordatorio_renta_dias;
