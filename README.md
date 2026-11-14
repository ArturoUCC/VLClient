# VLClient

Aplicación para inquilinos de Inmobiliaria Vives Lara. La app móvil utiliza React Native con Expo y React Navigation; la API utiliza Node.js, Express y PostgreSQL en Neon.

En la primera versión, las **notificaciones internas** están disponibles. Las **push remotas** se posponen: se conserva su infraestructura, pero el registro móvil y el envío del procesador permanecen desactivados. [PUSH.md](PUSH.md) documenta la activación futura.

La documentación operativa del servidor está en [backend/README.md](backend/README.md).

**Decisión pendiente de Vives Lara:** la pantalla de estado de cuenta consulta la mensualidad más reciente del contrato activo; no hay historial de estados de cuenta en la app. El historial de pagos sí está disponible.

## Borradores de reportes

Desde **Mis reportes → Ver borradores guardados** se pueden crear, editar y eliminar borradores en el dispositivo. El texto se guarda mientras se escribe y las fotos seleccionadas se copian al directorio persistente de la app. Los borradores se consultan únicamente después de iniciar sesión con el mismo inquilino. Si se cierra la app sin conexión, el borrador permanece guardado, pero será necesario volver a iniciar sesión cuando haya red; la app no conserva un JWT para acceso sin conexión.

La sincronización idempotente está implementada localmente. Se reintenta al recuperar la conexión mientras la app está abierta, al iniciar sesión y al volver al primer plano. La migración de claves ya fue aplicada manualmente en Neon; faltan el despliegue y una prueba real en Expo Go antes de considerar terminada la función. [REPORTES.md](REPORTES.md) detalla el flujo y la prueba con dos inquilinos.

## Recordatorios de renta y automatización futura

Los recordatorios de vencimiento aparecen como notificaciones de tipo `pago` en VLClient. Cada inquilino tiene una anticipación predeterminada de **5 días** y puede elegir de **1 a 31 días** en su perfil. El generador considera la fecha local de `America/Mexico_City`, las cuentas pendientes y el saldo restante después de pagos parciales. La clave única de cuenta, vencimiento y anticipación evita avisos duplicados.

**Decisión actual:** la generación se ejecuta manualmente desde CMD, en la carpeta `backend`. No se generan recordatorios automáticamente mientras no se configure una tarea programada.

```cmd
cd backend
node jobs/generarRecordatoriosRenta.js --dry-run
node jobs/generarRecordatoriosRenta.js
```

Ejecuta primero `--dry-run` y revisa los identificadores de cuenta e inquilino, la fecha límite, los días de anticipación y el saldo pendiente. La simulación solo consulta Neon. Después de una ejecución real, verifica el número de avisos creados y su aparición en la app. Repetir el trabajo con los mismos datos debe crear **0** avisos: PostgreSQL aplica un índice único y el trabajo usa `ON CONFLICT DO NOTHING`. Un cambio posterior de vencimiento o de preferencia constituye una configuración distinta y puede generar otro aviso.

La configuración prevista para un futuro Cron Job de Render, incluida la programación diaria a las 9:00 a. m. de Ciudad de México y la consideración de costos, se detalla en [backend/README.md](backend/README.md). **El Cron Job no está activado.**
