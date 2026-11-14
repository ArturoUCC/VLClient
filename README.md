# VLClient

Aplicación para inquilinos de Inmobiliaria Vives Lara. La app móvil utiliza React Native con Expo y React Navigation; la API utiliza Node.js, Express y PostgreSQL en Neon.

La documentación operativa del servidor está en [backend/README.md](backend/README.md).

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
