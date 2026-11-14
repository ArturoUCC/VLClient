-- Consultas de solo lectura posteriores a la migración manual.
-- Comparar los conteos con los obtenidos antes de aplicar la migración.
-- La migración no contiene INSERT, UPDATE ni DELETE.
SELECT to_regclass('public.reportes') AS tabla_reportes,
       to_regclass('public.reporte_fotos') AS tabla_fotos;

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'reportes' AND column_name = 'clave_idempotencia')
    OR (table_name = 'reporte_fotos' AND column_name = 'clave_idempotencia'))
ORDER BY table_name;

SELECT ix.relname AS indice, i.indisunique AS unico, i.indisvalid AS valido,
       pg_get_indexdef(ix.oid) AS definicion
FROM pg_class ix
JOIN pg_index i ON i.indexrelid = ix.oid
JOIN pg_namespace ns ON ns.oid = ix.relnamespace
WHERE ns.nspname = 'public'
  AND ix.relname IN ('reportes_clave_idempotencia_uidx',
                     'reporte_fotos_id_reporte_clave_uidx')
ORDER BY ix.relname;

SELECT COUNT(*) AS reportes_existentes,
       COUNT(*) FILTER (WHERE clave_idempotencia IS NOT NULL) AS reportes_con_clave
FROM public.reportes;

SELECT COUNT(*) AS fotos_existentes,
       COUNT(*) FILTER (WHERE clave_idempotencia IS NOT NULL) AS fotos_con_clave
FROM public.reporte_fotos;

-- Deben devolver cero filas; los índices únicos también impiden nuevas
-- duplicaciones de claves no nulas.
SELECT clave_idempotencia, COUNT(*) AS repeticiones
FROM public.reportes
WHERE clave_idempotencia IS NOT NULL
GROUP BY clave_idempotencia
HAVING COUNT(*) > 1;

SELECT id_reporte, clave_idempotencia, COUNT(*) AS repeticiones
FROM public.reporte_fotos
WHERE clave_idempotencia IS NOT NULL
GROUP BY id_reporte, clave_idempotencia
HAVING COUNT(*) > 1;
