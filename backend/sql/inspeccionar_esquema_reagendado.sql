-- Solo lectura. Revisar el resultado en Neon antes de aplicar la migración.
-- Confirma tipos, valores predeterminados y restricciones existentes.

SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('citas', 'notificaciones', 'reportes', 'contratos', 'inquilinos')
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS tabla, conname AS restriccion, contype AS tipo,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid IN (
  'public.citas'::regclass,
  'public.notificaciones'::regclass,
  'public.reportes'::regclass,
  'public.contratos'::regclass,
  'public.inquilinos'::regclass
)
ORDER BY tabla, restriccion;

SELECT estado, COUNT(*) AS citas
FROM public.citas
GROUP BY estado
ORDER BY estado;
