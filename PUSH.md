# Registro de dispositivos para push

La app registra su instalación al iniciar sesión, si el interruptor «Avisos push» del perfil está activo, hay permiso del sistema y se usa una compilación compatible. La preferencia del interruptor se guarda por instalación en SecureStore; apagarlo desactiva el dispositivo en la API. Al cerrar sesión también desactiva solo esa instalación; si la API no confirma la baja, mantiene la sesión para reintentar. Expo Go omite el registro remoto y las notificaciones internas siguen funcionando.

El proyecto EAS ya está vinculado: `extra.eas.projectId` es `adb5f587-2df0-49f7-9b40-c04c6bd4944e` y `EXPO_PROJECT_ID` está configurado en Render. Para una compilación de desarrollo faltan los identificadores nativos `android.package` e `ios.bundleIdentifier` definitivos y las credenciales FCM v1/APNs correspondientes. No se han creado compilaciones en esta etapa.

Las dependencias `expo-notifications`, `expo-constants`, `expo-crypto` y `expo-secure-store` se instalaron con `npx expo install` para SDK 58. La app guarda un identificador aleatorio de instalación en SecureStore; no imprime el Expo Push Token en logs ni en la interfaz. El backend almacena el token en Neon para futuros envíos y guarda `sesion_version_registro` para que una contraseña restablecida deje obsoleto el dispositivo al enviar avisos en el futuro.

La migración `backend/sql/migrar_notificaciones_push.sql` ya fue aplicada en Neon. El procesador manual de `backend/jobs/procesarNotificacionesPush.js` distribuye las notificaciones internas nuevas y envía un aviso genérico a Expo. Registrar un dispositivo por sí solo no produce una notificación remota.

## Endpoints

- `POST /api/push/dispositivos`: requiere JWT Bearer y JSON con `instalacion_id` (UUID), `expo_push_token`, `plataforma` (`android` o `ios`) y `expo_project_id` (UUID). El propietario se obtiene del JWT y la versión de sesión se vuelve a verificar dentro de la transacción. Responde 200 sin devolver el token. Repetir el registro de una instalación propia actualiza su token; una instalación o token activos de otra instalación producen 409.
- `DELETE /api/push/dispositivos/:instalacionId`: requiere JWT Bearer; desactiva únicamente la instalación activa del inquilino autenticado. Responde 204 incluso si ya estaba desactivada o no pertenece al usuario, sin revelar su propietario.

## Verificación posterior

1. En una compilación de desarrollo, inicia sesión y acepta los permisos. Consulta en Neon solamente `id_push_dispositivo`, `id_inquilino`, `instalacion_id`, `plataforma`, `activo`, `sesion_version_registro` y las fechas de `push_dispositivos`. No selecciones `expo_push_token`.
2. Repite el login con la misma instalación y comprueba que solo queda una fila activa. Si Expo rota el token, el listener actualiza esa fila.
3. Cierra sesión y comprueba `activo = FALSE`. Los otros dispositivos del inquilino deben seguir activos.
4. Con dos cuentas de prueba, comprueba que una no puede desactivar la instalación activa de la otra. Para pruebas locales sin Neon ejecuta `node --test test/pushDispositivos.test.js` desde `backend`.

Expo Go no permite esta prueba remota en SDK 58. Las pruebas push quedan para una compilación posterior.

## Procesador manual de push

Desde CMD, con `DATABASE_URL` disponible para el backend y `EXPO_PROJECT_ID=adb5f587-2df0-49f7-9b40-c04c6bd4944e` en el entorno local, entra a `backend` y usa estos comandos **por separado**:

```cmd
node jobs\procesarNotificacionesPush.js --dry-run
node jobs\procesarNotificacionesPush.js --procesar
node jobs\procesarNotificacionesPush.js --recibos
```

`--dry-run` abre una transacción de solo lectura, muestra identificadores de notificaciones y dispositivos elegibles y el número de recibos pendientes. No muestra tokens, no modifica Neon y no contacta a Expo. Es una lectura puntual: los dispositivos o estados pueden cambiar antes de procesar.

`--procesar` distribuye la bandeja de salida y envía los trabajos pendientes a Expo en lotes de hasta 100. La selección exige el mismo inquilino en notificación y dispositivo, dispositivo activo, Project ID esperado y `sesion_version` vigente. Cada ejecución procesa como máximo diez lotes de distribución y diez de envío; repite el comando si quedan pendientes. Los avisos internos se conservan aunque falle Expo. El payload visible en pantalla de bloqueo es genérico; el dato adjunto contiene solo `id_notificacion`.

`--recibos` consulta tickets aceptados después de 15 minutos y actualiza su estado según el recibo de Expo. Ejecútalo nuevamente mientras haya recibos pendientes, antes de que transcurran 24 horas. Un recibo `ok` significa que Expo lo entregó a FCM/APNs, no que el usuario lo vio. `DeviceNotRegistered` desactiva el token registrado. Un resultado ambiguo de envío se marca `fallido` para evitar un posible duplicado externo; requiere revisión manual, no reenvío automático.

La API de Expo se usa por HTTPS desde Node 22, con un tiempo de espera de 15 segundos. Si el proyecto habilita la seguridad adicional de Expo Push Service, configura `EXPO_ACCESS_TOKEN` **solo en el entorno del proceso**; no lo guardes en el repositorio. El código no imprime tokens, JWT ni respuestas completas del proveedor.

Los recordatorios de renta siguen generándose con su comando manual independiente. Mientras no haya una tarea programada o un servicio continuo que ejecute `--procesar` y `--recibos`, el push **no es automático**. No se creó un Cron Job ni se enviaron avisos reales durante la implementación.

## Apertura de avisos push en la app

Expo Notifications escucha las pulsaciones con la app abierta o en segundo plano y recupera la última respuesta cuando una pulsación inicia la app cerrada. VLClient solo lee `id_notificacion` del payload. Si no existe sesión, conserva esa referencia en memoria hasta el siguiente inicio de sesión; no guarda el JWT ni el aviso push en almacenamiento persistente. Antes de navegar, consulta `GET /api/notificaciones/mis-notificaciones` con el JWT y solo abre «Mis notificaciones» si la API devuelve ese identificador para el inquilino autenticado. La pantalla vuelve a consultar Neon y destaca el aviso. Una respuesta repetida de Expo no abre la pantalla dos veces.

Las seis versiones que `npx expo install --check` señalaba se ajustaron con `npx expo install --fix`: Expo `~58.0.25`, Expo Font `~58.0.12`, Expo Status Bar `~58.0.5`, React Native `0.88.1`, React Native Safe Area Context `~5.11.1` y React Native Screens `~4.30.1`. La comprobación posterior informa que las dependencias están actualizadas.

Antes de compilar, define `android.package` e `ios.bundleIdentifier` con identificadores definitivos y configura FCM v1 y APNs en Expo EAS. Confirma que `extra.eas.projectId` y `EXPO_PROJECT_ID` sigan siendo el mismo UUID. Prueba posteriormente pulsaciones con app abierta, en segundo plano y cerrada, tanto con sesión vigente como sin sesión, además de un identificador inexistente o de otra cuenta. La prueba remota requiere una compilación compatible; Expo Go no la sustituye en SDK 58.
