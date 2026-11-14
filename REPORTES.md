# Borradores y sincronización de reportes

## Estado local

VLClient guarda el texto del borrador en SQLite y copia las fotografías al directorio persistente privado de la aplicación. Cada borrador tiene un UUID estable y pertenece a un `id_inquilino`. Cada foto tiene otro UUID estable. La app no conserva el JWT entre reinicios: el propietario debe volver a iniciar sesión para reanudar el envío.

Los estados son `borrador`, `pendiente_sincronizacion`, `sincronizando_idempotente`, `enviado`, `error_reintentar`, `error` y `error_ambiguo`. Los dos últimos pueden corresponder a borradores creados antes de la idempotencia y requieren revisión manual. Una sincronización idempotente interrumpida vuelve a pendiente al iniciar el motor. Los archivos locales permanecen hasta que el usuario elimine el borrador; una foto ya confirmada no vuelve a enviarse.

## Envío

Al tocar **Enviar reporte**, el borrador pasa a pendiente. Mientras la app está abierta, el motor usa `expo-network` y comprueba que la API publique `GET /api/reportes/capacidades` con soporte para ambos pasos idempotentes. Una API antigua deja el borrador pendiente sin crear un reporte parcial. También intenta sincronizar al iniciar sesión, al recuperar la red y al volver la app al primer plano. No hay ejecución garantizada con la app cerrada. Un JWT vencido detiene la cola hasta iniciar sesión de nuevo con el mismo propietario.

El motor envía primero `POST /api/reportes/crear` con `clave_idempotencia` igual al UUID del borrador. Después envía cada fotografía a `POST /api/reporte-fotos/:idReporte/sincronizar` con su UUID propio. El reporte queda `enviado` solamente después de confirmar todas las fotos. Si se pierde una respuesta, se reintenta con las mismas claves. El backend verifica la propiedad en cada solicitud, utiliza los índices únicos de Neon y rechaza una clave reutilizada con otros datos. Para las fotos usa un identificador estable en Cloudinary que permite recuperar un upload confirmado cuya respuesta se perdió.

La migración `backend/sql/migrar_idempotencia_reportes.sql` ya fue ejecutada y verificada manualmente en Neon según los resultados proporcionados para Sprint 5. No se ejecutó desde este trabajo. La implementación local todavía requiere despliegue y prueba real en dispositivo.

Los metadatos y fotos locales están dentro del contenedor de la app, sin cifrado adicional. Las fotos enviadas a Cloudinary tienen URL públicas. Revisar respaldo y retención antes de tratar imágenes sensibles.

## Prueba pendiente en Expo Go

1. Iniciar sesión como inquilino A, desconectar internet, redactar un reporte y adjuntar dos fotos. Tocar **Enviar reporte** y comprobar **Pendiente de sincronización**. Cerrar y abrir la app; iniciar sesión nuevamente como A y comprobar que el texto, las fotos y el estado persisten.
2. Antes de reanudar con A, iniciar sesión como inquilino B. Comprobar que B no ve los borradores de A. Confirmar en la API que B tampoco puede consultar ni adjuntar fotos al reporte de A.
3. Volver a A y recuperar la conexión con la app abierta. Comprobar que pasa a **Sincronizando** y luego **Enviado**, que existe exactamente un reporte y una fila por foto, y que se puede continuar a la cita.
4. Repetir con interrupción de red durante el envío del reporte y durante una foto. Reabrir la app o usar **Reintentar envío**; confirmar que no se duplican filas. Repetir con JWT vencido y volver a iniciar sesión como A.
5. Comprobar que un archivo local faltante produce un error visible y que los archivos no se eliminan antes de la confirmación. Eliminar un borrador ya enviado y verificar que únicamente se borren sus archivos locales.

Hasta completar estas pruebas en un dispositivo real y revisar el resultado en Neon, la función sin conexión no se considera terminada.
