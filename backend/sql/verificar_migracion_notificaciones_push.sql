-- CONSULTAS DE SOLO LECTURA para ejecutar después de aplicar la migración.
-- No muestra el contenido de los Expo Push Tokens.

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('push_dispositivos', 'push_notificaciones_outbox',
                     'push_envios')
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS tabla, conname, contype,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid IN ('public.push_dispositivos'::regclass,
                   'public.push_notificaciones_outbox'::regclass,
                   'public.push_envios'::regclass,
                   'public.notificaciones'::regclass)
  AND (conrelid <> 'public.notificaciones'::regclass
       OR conname = 'notificaciones_push_id_propietario_unico')
ORDER BY tabla, conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('push_dispositivos', 'push_notificaciones_outbox',
                    'push_envios', 'notificaciones')
  AND (tablename <> 'notificaciones'
       OR indexname = 'notificaciones_push_id_propietario_unico')
ORDER BY tablename, indexname;

SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definicion
FROM pg_trigger
WHERE tgrelid = 'public.notificaciones'::regclass
  AND tgname = 'notificaciones_encolar_push_trg';

-- No se migran avisos históricos ni se crean tokens automáticamente.
SELECT (SELECT COUNT(*) FROM public.push_dispositivos) AS dispositivos,
       (SELECT COUNT(*) FROM public.push_notificaciones_outbox) AS en_cola,
       (SELECT COUNT(*) FROM public.push_envios) AS envios;
