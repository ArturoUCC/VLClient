# Backend de VLClient

El registro de dispositivos y los comandos manuales de envío push están documentados en [PUSH.md](../PUSH.md). El procesamiento push automático aún no está activado.

API Express de VLClient. El proceso web se inicia con `npm start`; los recordatorios de renta se ejecutan mediante un proceso Node independiente.

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
