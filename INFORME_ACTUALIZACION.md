# VLClient: informe de actualización local

**Estado:** implementación local preparada para el esquema informado, sin
migraciones aplicadas ni despliegue. La integración real sigue pendiente de
pruebas en Neon y dispositivo. El diagnóstico manual informó cero conflictos
en horarios, citas activas por reporte y contratos activos por propiedad, así
como cero correos normalizados duplicados. Longitudes y precisión de columnas
confirmadas y alineadas con el formulario y el backend.

## Implementado y probado localmente

- Política reutilizable para contraseñas nuevas: 8 caracteres, mayúscula,
  número, símbolo de la lista permitida, máximo 72 bytes y solo caracteres
  ASCII autorizados. Se aplica al restablecimiento web y a la creación de
  administradores; los inquilinos existentes siguen iniciando sesión con su
  contraseña previa. La página web muestra requisitos en tiempo real y
  controles de visibilidad independientes.
- Cuentas administrativas separadas, JWT con secreto propio, rol comprobado
  en backend, control de cuenta activa y `sesion_version`, cierre de sesión con
  revocación, límite de login y bitácora de cambios.
- Drawer administrativo con panel, inquilinos, calendario, citas, registro y
  perfil. El alta crea inquilino y contrato en una transacción, bloquea la
  propiedad, guarda bcrypt, actualiza el estado a `rentada` y audita. La lista
  muestra un estado vacío cuando no hay propiedades disponibles.
- La validación del alta respeta `nombre VARCHAR(100)`, `apellido VARCHAR(150)`,
  `correo VARCHAR(150)`, `telefono VARCHAR(20)` y
  `renta_acordada NUMERIC(12,2)`. La renta viaja como texto decimal exacto,
  admite de cero a `9999999999.99` con máximo dos decimales y rechaza valores
  que PostgreSQL redondearía. El hash bcrypt cabe en `VARCHAR(255)`.
- Dashboard con una consulta SQL de indicadores. Consulta paginada de
  inquilinos y citas; detalle del inquilino con contratos, estados de cuenta,
  pagos agregados, reportes, fotos y citas. El importe de renta contractual y
  fecha de alta del inquilino usan las columnas confirmadas.
- Disponibilidad global de horarios, ocupación transaccional y validación
  obligatoria en backend. La migración enlaza citas anteriores, crea reservas,
  sincroniza reservas con un trigger y reemplaza la unicidad histórica por
  índices parciales para citas activas. Las fechas y horarios históricos se
  vinculan pero quedan deshabilitados hasta autorización administrativa. Los
  inquilinos solo pueden solicitar horarios habilitados y libres. El
  reagendamiento conserva una sola
  oportunidad, mantiene la corrección de la fase 1 y vuelve a `programada`.
- Acciones administrativas de confirmar, solicitar reagendamiento y registrar
  segundo horario no disponible. Bloquean la fila de la cita, insertan la
  notificación y la bitácora en la misma transacción. Los reintentos no generan
  avisos duplicados según la simulación local.
- Reportes: consulta agrupada paginada, miniaturas de Cloudinary y lista
  virtualizada. Se eliminan las peticiones individuales de fotos por reporte
  en esa pantalla. Se añadieron tiempos de diagnóstico opcionales sin tokens.
- Dependencias alineadas con Expo SDK 58 y prueba de Android actualizada para
  el identificador provisional existente. Push remotas siguen desactivadas.

## Pendiente antes de integración

1. Ejecutar de nuevo solo lectura `backend/sql/diagnosticar_actualizacion.sql`.
   Los tres conflictos y los correos repetidos sin distinguir mayúsculas deben
   devolver cero filas y el contador de correos repetidos debe ser cero. Los
   metadatos de columnas ya se confirmaron; repetir la consulta antes de migrar
   sirve para detectar cambios posteriores del esquema.
2. Coordinar una ventana de mantenimiento de citas para migrar y desplegar sin
   incompatibilidad temporal entre la API anterior y `citas.id_horario`.
   Ejecutar, en orden, `backend/sql/migrar_administradores.sql`,
   `backend/sql/migrar_disponibilidad_citas.sql` y
   `backend/sql/migrar_restricciones_contratos.sql`. La columna del segundo
   horario ya existe; no ejecutar otra vez esa migración.
3. Aplicar las migraciones manualmente y verificar con
   `backend/sql/verificar_actualizacion.sql`. Crear el primer administrador
   mediante `backend/scripts/generarHashAdministrador.js` y configurar
   `ADMIN_JWT_SECRET` directamente en Render.
4. Probar el alta con propiedad ficticia en base aislada; el SQL opcional es
   `backend/sql/ejemplo_propiedad_prueba_aislada.sql`. Las dos propiedades
   existentes en Neon tienen contratos activos: no liberar ninguna para probar.
5. Probar el drawer, recuperación, reservas concurrentes, notificaciones,
   reportes y pagos en Expo Go con dos inquilinos y un administrador. Medir
   latencia real en un dispositivo Android, con Render activo y tras arranque
   en frío. El objetivo aproximado de seis segundos aún no está demostrado.

## Verificaciones locales

- Backend: 81/81 pruebas aprobadas con `node --test`.
- Móvil: 37/37 pruebas aprobadas con `node --test`.
- La revisión final confirma normalización `trim` y minúsculas en altas y
  login de ambos tipos de cuenta. Las entradas actuales de bitácora contienen
  identificadores, estados o disponibilidad; no contraseñas, hashes ni JWT.
- El backend no inserta reservas tras crear o reagendar: el trigger de citas
  las mantiene. Confirmación conserva reserva; actualización controlada a
  `completada` o `cancelada` la libera. No hay endpoints de cancelación o
  finalización para inquilinos en esta actualización.
- `diagnosticar_actualizacion.sql` y `verificar_actualizacion.sql` comparan
  totales históricos, reservas e índices, además de conflictos. La reversión
  posterior a la migración requiere una copia restaurable o corrección hacia
  adelante si se reutilizaron horarios históricos.
- `npx expo install --check`: dependencias al día.
- `npx expo-doctor`: 20/20 comprobaciones aprobadas.
- Auditoría móvil: cinco avisos moderados transitivos; la corrección automática
  propuesta cambia de SDK. No se aplicó.
- No hay mediciones físicas de rendimiento ni pruebas sobre Neon en esta tarea.
- No se pudieron ejecutar las migraciones en un PostgreSQL aislado: este equipo
  no tiene `psql`, `initdb`, Docker ni un servicio PostgreSQL local disponible.
  Las pruebas automatizadas simulan la base y no validan la migración real.

## Archivos de esta actualización

**Creados:** `VLCLIENT/src/admin/AdminArea.js`,
`VLCLIENT/src/admin/AdminScreens.js`,
`VLCLIENT/src/services/fechaCitas.js`,
`VLCLIENT/src/services/passwordPolicy.js`,
`VLCLIENT/src/services/validarRegistroInquilino.js`,
`VLCLIENT/test/adminApi.test.js`,
`VLCLIENT/test/fechaCitas.test.js`,
`VLCLIENT/test/passwordPolicy.test.js`,
`VLCLIENT/test/validarRegistroInquilino.test.js`,
`backend/ACTUALIZACION_ADMIN.md`,
`backend/controllers/adminAuthController.js`,
`backend/controllers/adminCitasController.js`,
`backend/controllers/adminCuentasController.js`,
`backend/controllers/adminDashboardController.js`,
`backend/controllers/adminInquilinosController.js`,
`backend/controllers/adminPropiedadesController.js`,
`backend/controllers/disponibilidadController.js`,
`backend/middleware/adminAuthMiddleware.js`,
`backend/middleware/medirSolicitud.js`,
`backend/routes/adminRoutes.js`,
`backend/scripts/generarHashAdministrador.js`,
`backend/sql/diagnosticar_actualizacion.sql`,
`backend/sql/migrar_administradores.sql`,
`backend/sql/migrar_disponibilidad_citas.sql`,
`backend/sql/migrar_restricciones_contratos.sql`,
`backend/sql/ejemplo_propiedad_prueba_aislada.sql`,
`backend/sql/verificar_actualizacion.sql`,
`backend/test/adminAuth.test.js`,
`backend/test/adminCitas.test.js`,
`backend/test/adminCuentas.test.js`,
`backend/test/adminRutas.test.js`,
`backend/test/adminRegistro.test.js`,
`backend/test/disponibilidadCitas.test.js`,
`backend/test/passwordPolicy.test.js`,
`backend/test/reportesResumen.test.js`,
`backend/utils/passwordPolicy.js` y este informe.

**Modificados:** `README.md`, `VLCLIENT/App.js`, `VLCLIENT/index.js`,
`VLCLIENT/package.json`, `VLCLIENT/package-lock.json`,
`VLCLIENT/src/context/SesionContext.js`,
`VLCLIENT/src/screens/LoginScreen.js`,
`VLCLIENT/src/screens/NuevaCitaScreen.js`,
`VLCLIENT/src/screens/ReagendarCitaScreen.js`,
`VLCLIENT/src/screens/ReportesScreen.js`,
`VLCLIENT/src/services/api.js`,
`VLCLIENT/test/pushHabilitacion.test.js`,
`backend/README.md`, `backend/controllers/authController.js`,
`backend/controllers/citasController.js`,
`backend/controllers/reportesController.js`,
`backend/public/recuperar-password/app.js`,
`backend/public/recuperar-password/estilos.css`,
`backend/public/recuperar-password/index.html`,
`backend/routes/citasRoutes.js`,
`backend/sql/confirmar_cita_mantenimiento.sql`,
`backend/routes/recuperacionPageRoutes.js`,
`backend/routes/reportesRoutes.js`, `backend/server.js`,
`backend/test/reagendadoCitas.test.js`,
`backend/test/recuperacion.test.js` y
`backend/test/recuperacionPage.test.js`.

**Preexistentes y conservados:** la modificación de `VLCLIENT/app.json` y los
archivos sin seguimiento `VLCLIENT/eas.json`, los dos documentos `.docx` y
`backend/generarHash.js`. Este último no se revisó ni se debe agregar a Git
sin inspección humana de credenciales.

## API y configuración

`/api/admin` añade login, perfil, logout, resumen, inquilinos, propiedades,
citas, administradores y disponibilidad. `GET /api/citas/disponibilidad`
y `GET /api/reportes/mis-reportes-resumen` son nuevos. Los POST existentes de
creación y reagendamiento de citas ahora requieren la migración de
disponibilidad. El restablecimiento de contraseña conserva su ruta y aplica la
nueva política. `ADMIN_JWT_SECRET` es obligatorio para el área administrativa;
`PERF_DIAGNOSTICS=1` es opcional. No se configuró ningún valor en Render.

Se añadieron `@react-navigation/drawer`, `react-native-gesture-handler`,
`react-native-reanimated` y `react-native-worklets`; se actualizaron los
parches de `expo`, `expo-file-system` y `expo-sqlite` dentro de SDK 58.

## SQL y operaciones manuales

Los archivos de diagnóstico, migración, verificación, orden de ejecución,
creación del primer administrador y reversión están explicados en
[`backend/ACTUALIZACION_ADMIN.md`](backend/ACTUALIZACION_ADMIN.md). Ningún
archivo SQL se ejecutó automáticamente. No se hicieron commits, pushes,
despliegues, builds ni cambios de credenciales.
