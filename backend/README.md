# Backend de VLClient

El registro de dispositivos y los comandos manuales de envío push están documentados en [PUSH.md](../PUSH.md). Para la primera versión, el envío remoto queda desactivado **en el código local**: el comando `--procesar` exige `PUSH_REMOTE_ENABLED=true`, que no debe configurarse hasta terminar las pruebas nativas y aprobar la activación. Este cambio no afecta todavía a la versión desplegada en Render. Las notificaciones internas siguen funcionando. No hay procesamiento automático ni Cron Job activo.

API Express de VLClient. El proceso web se inicia con `npm start`; los recordatorios de renta se ejecutan mediante un proceso Node independiente.

## Seguridad y borradores de reportes

El login limita intentos por IP y correo mediante la tabla existente `limites_recuperacion_password`. Las claves se guardan como HMAC usando `RECOVERY_RATE_LIMIT_SECRET`, que debe seguir configurado en Render; no se registra el correo en esa tabla. El límite se comparte entre instancias y reinicios. El JWT conserva su duración actual y la app vuelve a login ante un 401 autenticado. La baja push al cerrar sesión es de mejor esfuerzo: el procesador vuelve a comprobar `push_dispositivos.activo` y `sesion_version_registro` antes de enviar. Si un cierre sin conexión no llega al backend y la versión de sesión sigue vigente, el dispositivo puede continuar siendo elegible; esta limitación requiere una estrategia de revocación por instalación antes de ofrecer push en producción.

La API móvil nativa no necesita CORS. La página de recuperación usa el mismo origen; se retiró el CORS abierto y el diagnóstico público `/api/db-test`. Los archivos de reporte se comprueban por firma básica antes de enviarse a Cloudinary. Esto no sustituye la decodificación completa de imágenes. Las `secure_url` actuales de Cloudinary son enlaces públicos: la API protege la consulta de la URL, pero quien posea un enlace puede abrir la foto directamente. Revisar esta decisión de privacidad con la inmobiliaria.

La migración [sql/migrar_idempotencia_reportes.sql](sql/migrar_idempotencia_reportes.sql) ya fue ejecutada y verificada manualmente en Neon según los resultados del Sprint 5. `POST /api/reportes/crear` admite opcionalmente `clave_idempotencia` para conservar clientes anteriores. `POST /api/reporte-fotos/:idReporte/sincronizar` recibe una fotografía con su propia clave. Ambos verifican el inquilino del JWT y rechazan claves reutilizadas con datos incompatibles. `GET /api/reportes/capacidades` requiere JWT y permite que la app compruebe que ambos pasos están disponibles antes de enviar. El flujo local de sincronización requiere aún despliegue y prueba en Expo Go; no se ejecutó SQL ni se enviaron datos reales en esta implementación.

`npm audit --omit=dev` no reporta vulnerabilidades de producción tras resolver `body-parser@2.4.0`. La auditoría completa del backend aún muestra un aviso moderado en la cadena de `nodemon`, usada para desarrollo. La app móvil mantiene cinco avisos moderados en dependencias transitivas de Expo y `@expo/ngrok`; no se aplicó `npm audit fix --force` porque propone cambiar de SDK. Revisar nuevas versiones compatibles antes de la entrega.

## Recordatorios de renta y automatización futura

El generador [`jobs/generarRecordatoriosRenta.js`](jobs/generarRecordatoriosRenta.js) consulta `estados_de_cuenta → contratos → inquilinos` y suma los pagos relacionados con cada estado de cuenta. Solo crea notificaciones `pago` para cuentas `pendiente` con saldo positivo y vencimiento futuro, dentro de la anticipación del inquilino. La preferencia predeterminada es **5 días**; cada inquilino puede elegir **1 a 31 días** en su perfil. El cálculo utiliza días calendario y la fecha de `America/Mexico_City`.

### Operación manual actual

La generación **no es automática**. Mientras no haya una tarea programada, un operador debe ejecutar el trabajo desde CMD, dentro de `backend`, con acceso a `DATABASE_URL`. No guardes ni publiques el valor de esa variable.

```cmd
node jobs/generarRecordatoriosRenta.js --dry-run
```

`--dry-run` usa una transacción de solo lectura. Muestra la fecha local y, para cada aviso que se generaría, `id_estado_cuenta`, `id_inquilino`, fecha límite, días de anticipación y saldo pendiente. Omite las combinaciones para las que ya existe un recordatorio. No inserta registros.

Después de revisar los candidatos, la ejecución real es:

```cmd
node jobs/generarRecordatoriosRenta.js
```

El comando real muestra cuántas notificaciones creó. Para verificar la primera ejecución:

1. Confirma que cada candidato de la simulación pertenece al inquilino esperado, tiene saldo positivo y sigue pendiente, con vencimiento futuro y anticipación correcta.
2. Ejecuta el comando real y comprueba su contador de avisos creados.
3. Abre **Mis notificaciones** con el inquilino correspondiente y confirma el aviso de renta con su fecha límite y anticipación.
4. Repite `--dry-run`: si los datos no cambiaron, esos candidatos ya no deben aparecer. Una segunda ejecución real con los mismos datos debe informar **0** avisos nuevos.

El índice único parcial de `notificaciones` sobre `(id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion)` y `ON CONFLICT DO NOTHING` impiden duplicados incluso ante reintentos o ejecuciones simultáneas. Un vencimiento o una preferencia modificados pueden producir un aviso nuevo para esa combinación distinta. La simulación refleja una lectura puntual: vuelve a revisar antes de la ejecución real si cambiaron pagos, estados o preferencias.

### Automatización futura en Render

**Esta configuración está documentada para uso posterior; no existe un Cron Job activo.** Cuando se decida activarlo, crear un servicio nuevo con estos valores:

| Campo | Valor |
| --- | --- |
| Tipo | Cron Job |
| Nombre | `vlclient-recordatorios-renta` |
| Repositorio | `ArturoUCC/VLClient` |
| Rama | `main` |
| Root Directory | `backend` |
| Build Command | `npm ci` |
| Command | `node jobs/generarRecordatoriosRenta.js` |
| Schedule | `0 15 * * *` |
| Variable de entorno | `DATABASE_URL` |

Render interpreta el horario de Cron en **UTC**: `0 15 * * *` se ejecuta a las **15:00 UTC**, equivalentes a las **9:00 a. m. de Ciudad de México** con las reglas horarias actuales. El generador calcula por separado la fecha local `America/Mexico_City`. Si cambian las reglas de zona horaria, revisar la equivalencia del horario fijo en UTC. La variable `DATABASE_URL` debe configurarse en el servicio sin colocar su valor en el repositorio.

La activación de un Cron Job puede generar **costos adicionales** en Render. Consulta la [documentación de Cron Jobs de Render](https://render.com/docs/cronjobs) antes de crearlo. Tras la primera ejecución programada, revisar los registros de la tarea, su contador de avisos, las notificaciones en VLClient y la ausencia de duplicados mediante una nueva simulación.
