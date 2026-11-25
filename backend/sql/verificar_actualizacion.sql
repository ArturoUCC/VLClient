-- SOLO LECTURA. Ejecutar después de las migraciones manuales.
-- No muestra hashes, tokens ni datos personales.
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
  ('administradores','bitacora_administrativa','fechas_citas',
   'horarios_citas','reservas_citas') ORDER BY table_name;

SELECT column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='citas'
  AND column_name IN ('id_horario','fecha_cita','hora_cita','estado')
ORDER BY ordinal_position;

SELECT con.conrelid::regclass AS tabla,con.conname,
       pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint con
WHERE con.conrelid IN ('public.administradores'::regclass,
  'public.bitacora_administrativa'::regclass,
  'public.fechas_citas'::regclass,'public.horarios_citas'::regclass,
  'public.reservas_citas'::regclass,'public.citas'::regclass)
ORDER BY tabla,con.conname;

SELECT tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN
  ('administradores','bitacora_administrativa','fechas_citas',
   'horarios_citas','reservas_citas','citas')
ORDER BY tablename,indexname;

-- Totales: comparar con los valores registrados inmediatamente ANTES de migrar.
-- En el diagnóstico compartido: 11 citas, 2 contratos y 26 notificaciones.
-- reservas_totales debe coincidir con citas_activas_totales (11 en ese corte).
SELECT (SELECT COUNT(*) FROM public.inquilinos) AS inquilinos_totales,
       (SELECT COUNT(*) FROM public.propiedades) AS propiedades_totales,
       (SELECT COUNT(*) FROM public.reportes) AS reportes_totales,
       (SELECT COUNT(*) FROM public.reporte_fotos) AS fotografias_totales,
       (SELECT COUNT(*) FROM public.estados_de_cuenta) AS estados_cuenta_totales,
       (SELECT COUNT(*) FROM public.pagos) AS pagos_totales;
SELECT COUNT(*) AS citas_totales FROM public.citas;
SELECT COUNT(*) AS citas_activas_totales FROM public.citas
WHERE estado IN ('programada','confirmada');
SELECT COUNT(*) AS reservas_totales FROM public.reservas_citas;
SELECT COUNT(*) AS contratos_totales FROM public.contratos;
SELECT COUNT(*) AS notificaciones_totales FROM public.notificaciones;

-- Cada comprobación de inconsistencia siguiente debe devolver 0 o cero filas.
SELECT COUNT(*) AS citas_sin_horario
FROM public.citas WHERE id_horario IS NULL;
SELECT COUNT(*) AS citas_con_horario_incongruente
FROM public.citas c JOIN public.horarios_citas h ON h.id_horario=c.id_horario
WHERE c.fecha_cita<>h.fecha OR c.hora_cita<>h.hora;
SELECT COUNT(*) AS citas_activas_sin_reserva
FROM public.citas c LEFT JOIN public.reservas_citas r ON r.id_cita=c.id_cita
WHERE c.estado IN ('programada','confirmada') AND r.id_cita IS NULL;
SELECT COUNT(*) AS reservas_sin_cita_activa
FROM public.reservas_citas r JOIN public.citas c ON c.id_cita=r.id_cita
WHERE c.estado NOT IN ('programada','confirmada') OR r.id_horario<>c.id_horario;
SELECT fecha_cita,hora_cita,COUNT(*) AS cantidad FROM public.citas
WHERE estado IN ('programada','confirmada')
GROUP BY fecha_cita,hora_cita HAVING COUNT(*)>1;
SELECT id_reporte,COUNT(*) AS citas_activas FROM public.citas
WHERE estado IN ('programada','confirmada')
GROUP BY id_reporte HAVING COUNT(*)>1;
-- Fin de comprobaciones de citas; los siguientes son totales y metadatos.

SELECT COUNT(*) AS administradores_total,
       COUNT(*) FILTER (WHERE activo) AS administradores_activos
FROM public.administradores;
SELECT tgname,tgenabled FROM pg_trigger
WHERE tgrelid='public.citas'::regclass AND tgname='citas_sincronizar_reserva_trg';
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'
  AND indexname IN ('contratos_propiedad_activa_uidx',
                    'inquilinos_correo_normalizado_uidx');
-- Cada índice esperado debe figurar como presente, único, válido y listo.
-- Revisar también definición de columnas y predicado en definicion.
WITH esperados(tabla,indice) AS (VALUES
  ('administradores','administradores_correo_unico_idx'),
  ('inquilinos','inquilinos_correo_normalizado_uidx'),
  ('contratos','contratos_propiedad_activa_uidx'),
  ('horarios_citas','horarios_citas_fecha_hora_unico'),
  ('horarios_citas','horarios_citas_identidad_fecha_hora_unico'),
  ('reservas_citas','reservas_citas_id_horario_key'),
  ('citas','citas_horario_activo_unico_idx'),
  ('citas','citas_reporte_activo_unico_idx'),
  ('citas','citas_fecha_hora_activas_unico_idx')
)
SELECT e.tabla,e.indice,
       COALESCE(i.indisunique,FALSE) AS unico,
       COALESCE(i.indisvalid,FALSE) AS valido,
       COALESCE(i.indisready,FALSE) AS listo,
       pg_get_indexdef(ci.oid) AS definicion
FROM esperados e
LEFT JOIN pg_class ct ON ct.relname=e.tabla
  AND ct.relnamespace='public'::regnamespace
LEFT JOIN pg_class ci ON ci.relname=e.indice
  AND ci.relnamespace='public'::regnamespace
LEFT JOIN pg_index i ON i.indexrelid=ci.oid AND i.indrelid=ct.oid
ORDER BY e.tabla,e.indice;
-- La reserva por horario debe tener su propia restricción UNIQUE válida.
SELECT COUNT(*) AS restricciones_reserva_horario_validas
FROM pg_constraint con
WHERE con.conrelid='public.reservas_citas'::regclass
  AND con.contype='u' AND con.convalidated
  AND con.conkey=ARRAY[(SELECT attnum FROM pg_attribute
    WHERE attrelid='public.reservas_citas'::regclass
      AND attname='id_horario')]::smallint[];
SELECT id_propiedad,COUNT(*) AS cantidad FROM public.contratos
WHERE estado='activo' GROUP BY id_propiedad HAVING COUNT(*)>1;
SELECT COUNT(*) AS grupos_correo_duplicado FROM (
  SELECT 1 FROM public.inquilinos GROUP BY lower(correo) HAVING COUNT(*)>1
) duplicados;
SELECT COUNT(*) AS fechas_historicas_habilitadas
FROM public.fechas_citas f WHERE f.habilitada AND EXISTS
 (SELECT 1 FROM public.citas c WHERE c.fecha_cita=f.fecha);
SELECT COUNT(*) AS horarios_historicos_habilitados
FROM public.horarios_citas h WHERE h.habilitado AND EXISTS
 (SELECT 1 FROM public.citas c WHERE c.fecha_cita=h.fecha AND c.hora_cita=h.hora);
SELECT COUNT(*) AS restricciones_horario_antiguas
FROM pg_constraint WHERE conrelid='public.citas'::regclass
  AND conname='uq_cita_horario';
