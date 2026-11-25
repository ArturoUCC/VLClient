-- SOLO LECTURA. Ejecutar antes de cualquier migración de esta actualización.
-- No selecciona hashes, JWT, tokens ni datos personales.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN
  ('inquilinos','administradores','bitacora_administrativa','propiedades',
   'contratos','citas','reportes','reporte_fotos','notificaciones',
   'estados_de_cuenta','pagos','fechas_citas','horarios_citas','reservas_citas')
ORDER BY table_name;

SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN
  ('inquilinos','propiedades','contratos','citas','reportes','reporte_fotos',
   'notificaciones','estados_de_cuenta','pagos')
ORDER BY table_name, ordinal_position;

SELECT cls.relname AS tabla, con.conname AS restriccion,
       con.contype AS tipo, pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint con
JOIN pg_class cls ON cls.oid=con.conrelid
WHERE con.connamespace = 'public'::regnamespace
  AND cls.relname IN
    ('inquilinos','propiedades','contratos','citas','reportes',
     'reporte_fotos','notificaciones','estados_de_cuenta','pagos')
ORDER BY tabla, restriccion;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN
  ('inquilinos','propiedades','contratos','citas','reportes',
   'reporte_fotos','notificaciones','estados_de_cuenta','pagos')
ORDER BY tablename, indexname;

SELECT estado, COUNT(*) AS cantidad FROM public.citas GROUP BY estado ORDER BY estado;
SELECT reagendado_estado, COUNT(*) AS cantidad FROM public.citas
GROUP BY reagendado_estado ORDER BY reagendado_estado;
SELECT estado, COUNT(*) AS cantidad FROM public.contratos GROUP BY estado ORDER BY estado;
SELECT estado, COUNT(*) AS cantidad FROM public.reportes GROUP BY estado ORDER BY estado;
SELECT tipo, accion_tipo, COUNT(*) AS cantidad FROM public.notificaciones
GROUP BY tipo, accion_tipo ORDER BY tipo, accion_tipo;

SELECT fecha_cita, hora_cita, COUNT(*) AS cantidad
FROM public.citas WHERE estado IN ('programada','confirmada')
GROUP BY fecha_cita, hora_cita HAVING COUNT(*) > 1;
SELECT id_reporte, COUNT(*) AS citas_activas FROM public.citas
WHERE estado IN ('programada','confirmada')
GROUP BY id_reporte HAVING COUNT(*) > 1;
SELECT id_propiedad, COUNT(*) AS contratos_activos FROM public.contratos
WHERE estado = 'activo' GROUP BY id_propiedad HAVING COUNT(*) > 1;
SELECT COUNT(*) AS grupos_correo_duplicado FROM (
  SELECT 1 FROM public.inquilinos GROUP BY lower(correo) HAVING COUNT(*) > 1
) duplicados;
-- La consulta siguiente permite revisar límites sin imprimir datos personales.
SELECT table_name,column_name,character_maximum_length,numeric_precision,numeric_scale
FROM information_schema.columns WHERE table_schema='public' AND
 ((table_name='inquilinos' AND column_name IN
   ('nombre','apellido','correo','telefono','password_hash')) OR
  (table_name='contratos' AND column_name='renta_acordada'))
ORDER BY table_name,column_name;
SELECT COUNT(*) AS propiedades_totales FROM public.propiedades;
-- Guardar estos totales antes de migrar y compararlos con verificar_actualizacion.sql.
SELECT (SELECT COUNT(*) FROM public.inquilinos) AS inquilinos_totales,
       (SELECT COUNT(*) FROM public.propiedades) AS propiedades_totales,
       (SELECT COUNT(*) FROM public.reportes) AS reportes_totales,
       (SELECT COUNT(*) FROM public.reporte_fotos) AS fotografias_totales,
       (SELECT COUNT(*) FROM public.estados_de_cuenta) AS estados_cuenta_totales,
       (SELECT COUNT(*) FROM public.pagos) AS pagos_totales,
       (SELECT COUNT(*) FROM public.citas) AS citas_totales,
       (SELECT COUNT(*) FROM public.contratos) AS contratos_totales,
       (SELECT COUNT(*) FROM public.notificaciones) AS notificaciones_totales;
SELECT COUNT(DISTINCT p.id_propiedad) AS propiedades_sin_contrato_activo
FROM public.propiedades p LEFT JOIN public.contratos c
  ON c.id_propiedad = p.id_propiedad AND c.estado = 'activo'
WHERE c.id_contrato IS NULL;
