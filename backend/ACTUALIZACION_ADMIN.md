# Actualización administrativa y agenda: preparación local

**Estado:** código y SQL preparados localmente contra el esquema informado de
Neon. No se ejecutaron migraciones ni se desplegó el código. Los diagnósticos
manuales reportaron cero horarios duplicados, cero reportes con varias citas
activas, cero propiedades con varios contratos activos y cero correos
normalizados duplicados. Los límites de columnas también se confirmaron.
La integración real
queda pendiente de migrar, desplegar y probar con una propiedad disponible.

## Orden manual de integración

1. Ejecutar de nuevo en Neon **solo lectura**:
   [`sql/diagnosticar_actualizacion.sql`](sql/diagnosticar_actualizacion.sql).
   Verificar de nuevo los tres conjuntos de conflictos y los correos duplicados
   sin distinguir mayúsculas. Los tres conjuntos deben devolver cero filas y
   `grupos_correo_duplicado` debe ser 0. Los metadatos de columnas ya fueron
   confirmados y se registran abajo.
2. Programar una ventana breve de mantenimiento para creación y reagendamiento
   de citas: el backend nuevo requiere las tablas nuevas y el backend anterior
   no conoce `citas.id_horario`.
3. Dentro de la ventana, después de un respaldo, ejecutar **con cambios** y en
   este orden: [`sql/migrar_administradores.sql`](sql/migrar_administradores.sql),
   [`sql/migrar_disponibilidad_citas.sql`](sql/migrar_disponibilidad_citas.sql),
   [`sql/migrar_restricciones_contratos.sql`](sql/migrar_restricciones_contratos.sql).
   Ejecutar cada archivo completo, con su `BEGIN` y `COMMIT`. La columna
   `segundo_horario_no_disponible_at` ya existe: **no** volver a ejecutar su
   migración. La migración de citas bloquea `citas`, comprueba de nuevo horarios
   y reportes, vincula las 11 citas históricas, crea índices únicos para citas
   activas y reservas antes de quitar `uq_cita_horario`. Las fechas y horarios
   históricos quedan deshabilitados hasta que el administrador los habilite.
   La migración de contratos bloquea sus tablas y comprueba de nuevo contratos
   activos y correos antes de crear los índices únicos. Ninguna de estas
   migraciones borra registros.
4. Ejecutar **solo lectura**
   [`sql/verificar_actualizacion.sql`](sql/verificar_actualizacion.sql). Los
   contadores de citas sin horario, reservas faltantes y horarios incongruentes
   deben ser cero. Inmediatamente después de la migración, `citas_totales`
   debe seguir en **11**, los históricos habilitados en **0** y
   `restricciones_horario_antiguas` en **0**. Confirmar cinco tablas nuevas,
   el trigger de reserva y ambos índices de contratos/correo. Las **26**
   notificaciones y los **2** contratos existentes deben conservarse hasta
   realizar acciones nuevas.
5. Crear el primer administrador como se indica abajo. Configurar en Render
   `ADMIN_JWT_SECRET` con un valor aleatorio distinto de `JWT_SECRET`. El login
   administrativo usa además el limitador HMAC existente, que requiere
   `RECOVERY_RATE_LIMIT_SECRET`.
6. Desplegar backend y app de forma coordinada. Probar primero el alta en una
   base aislada; [`sql/ejemplo_propiedad_prueba_aislada.sql`](sql/ejemplo_propiedad_prueba_aislada.sql)
   crea una propiedad ficticia opcional solo allí. En Neon actualmente no hay
   propiedades disponibles; el formulario debe mostrar el estado vacío. No
   finalizar contratos ni liberar propiedades existentes para probar.

## Primer administrador

1. Después de verificar `migrar_administradores.sql`, comprobar en Neon que
   `SELECT COUNT(*) FROM public.administradores;` devuelve **0**. No usar una
   cuenta ni contraseña de ejemplo.
2. En una terminal interactiva local, desde `backend`, ejecutar:

```cmd
node scripts/generarHashAdministrador.js
```

3. El comando pide y confirma la contraseña sin mostrarla y valida la política.
   Copiar el hash bcrypt de 60 caracteres a una consulta temporal en el SQL
   Editor de Neon. No guardar la contraseña ni el hash en archivos versionados,
   capturas, tickets o conversaciones. Usar el correo electrónico normalizado
   (sin espacios y en minúsculas). Sustituir los cuatro marcadores siguientes
   únicamente en el editor y ejecutar **una sola vez** la transacción completa:

```sql
BEGIN;
LOCK TABLE public.administradores IN SHARE ROW EXCLUSIVE MODE;
WITH creado AS (
  INSERT INTO public.administradores
    (nombre, apellido, correo, password_hash)
  SELECT 'NOMBRE', 'APELLIDO', 'correo@ejemplo.test', 'HASH_BCRYPT_GENERADO'
  WHERE NOT EXISTS (SELECT 1 FROM public.administradores)
  RETURNING id_administrador, nombre, apellido, correo, activo
), auditoria AS (
  INSERT INTO public.bitacora_administrativa
    (id_administrador, accion, entidad, entidad_id)
  SELECT id_administrador, 'crear_administrador_inicial',
         'administradores', id_administrador FROM creado
)
SELECT id_administrador, nombre, apellido, correo, activo FROM creado;
COMMIT;
```

4. Debe devolver **una fila**. Si devuelve cero, ya existe una cuenta: revisar
   antes de intentar otra inserción. Comprobar mediante lectura que hay un
   administrador activo y una entrada de bitácora sin datos sensibles. Borrar
   el borrador de la consulta del editor si este lo conserva y cerrar la
   terminal que mostró el hash. Iniciar sesión con la cuenta en un entorno de
   prueba; no capturar JWT ni contraseñas en registros.

La aplicación no contiene contraseñas administrativas predeterminadas. El rol
se emite y verifica en el backend. El cierre de sesión incrementa
`sesion_version`, por lo que revoca las demás sesiones de esa cuenta.

## Endpoints preparados

Las rutas bajo `/api/admin` exigen JWT administrativo salvo `POST /auth/login`,
que usa el mismo inicio de sesión unificado de `POST /api/auth/login`. El backend
decide el rol; los correos que coinciden entre ambas tablas se rechazan con el
mismo mensaje genérico de credenciales incorrectas hasta resolver la colisión.
Incluyen `GET /resumen`, `GET /inquilinos`, `GET /inquilinos/:idInquilino`,
`POST /inquilinos`, `GET /propiedades`, `GET /citas`,
`POST /citas/:idCita/:accion`, `GET /disponibilidad`,
`PUT /disponibilidad/fechas/:fecha`,
`PUT /disponibilidad/fechas/:fecha/horarios/:hora`, `GET /auth/perfil`,
`POST /auth/logout`, `POST /administradores` y
`PATCH /administradores/:idAdministrador/activo`.

Los inquilinos consultan `GET /api/citas/disponibilidad` y siguen usando las
rutas existentes para crear y reagendar. Cada cita activa ocupa un horario en
`reservas_citas`; el trigger de PostgreSQL mantiene esa reserva al crear,
reagendar, confirmar, completar o cancelar. El backend no inserta otra reserva
después del trigger. La confirmación mantiene la reserva; los cambios de estado
controlados a `completada` o `cancelada` la liberan. No hay rutas de cancelación
ni finalización para inquilinos en esta actualización. La notificación y el
cambio de cita se guardan en una transacción. Las operaciones administrativas
también registran bitácora.

## Metadatos confirmados en Neon

`inquilinos`: `nombre VARCHAR(100)`, `apellido VARCHAR(150)`,
`correo VARCHAR(150)`, `password_hash VARCHAR(255)` y
`telefono VARCHAR(20)`. `contratos`: `renta_acordada NUMERIC(12,2)` y
`estado VARCHAR(20)`. `propiedades`: `nombre VARCHAR(150)`,
`direccion VARCHAR(255)`, `edificio VARCHAR(100)`,
`numero_departamento VARCHAR(20)`, `tipo_propiedad VARCHAR(50)`,
`descripcion TEXT`, `renta_mensual NUMERIC(12,2)` y `estado VARCHAR(30)`.
Ninguna de estas columnas es generada. El alta valida longitudes del inquilino
y recibe la renta como texto decimal entre `0` y `9999999999.99`, con máximo
dos decimales; no convierte a `Number` ni permite redondeos de PostgreSQL.
El hash bcrypt de 60 caracteres cabe en `VARCHAR(255)`. El formulario no crea
ni modifica propiedades distintas de marcar como `rentada` la seleccionada.

## Limitaciones pendientes

- El endpoint `POST /api/admin/inquilinos` crea inquilino y contrato en una
  transacción con bloqueo de la propiedad, hash bcrypt, bitácora y estado
  `rentada`. Rechaza correo duplicado sin distinguir mayúsculas, propiedad en
  mantenimiento/ocupada, fechas inválidas y contraseña fuera de política.
  No crea estados de cuenta. Su índice de correo normalizado y el índice parcial
  de contrato activo son obligatorios antes de usarlo.
- Las migraciones no se han ejecutado; los endpoints nuevos que las requieren
  responderán error hasta que se aplique y verifique el esquema.
- La agenda, el drawer y la optimización de reportes necesitan pruebas en
  dispositivo real y medición con Render y Neon activos. El objetivo de unos
  seis segundos no se considera comprobado por las pruebas locales.
- `PERF_DIAGNOSTICS=1` es opcional en backend: registra duración HTTP por patrón
  de ruta y tiempo de la consulta agrupada de reportes, sin cabeceras, tokens ni
  cuerpos. En Expo, los tiempos de consulta y miniaturas se registran solo en
  desarrollo. Comparar servidor activo y arranque en frío antes de atribuir
  latencia a Render, Neon o Cloudinary.

## Coordinación con Render y reversión

1. **Antes de la ventana:** conservar una copia recuperable de Neon y comprobar
   su restauración en una base aislada. Guardar los totales y los resultados de
   [`sql/diagnosticar_actualizacion.sql`](sql/diagnosticar_actualizacion.sql),
   además de las definiciones de restricciones e índices. Preparar la versión
   nueva del backend y conservar la referencia de la versión desplegada. Tener
   listo `ADMIN_JWT_SECRET` en la configuración privada de Render, distinto de
   `JWT_SECRET`, sin escribirlo en Git ni en el procedimiento.
2. **Inicio de mantenimiento:** comunicar la interrupción y bloquear las
   escrituras de citas y altas durante la ventana; esperar a que terminen las
   solicitudes en curso. El backend anterior no puede crear citas después de
   que `citas.id_horario` sea obligatorio. Si no se puede impedir tráfico de
   escritura, posponer la migración.
3. **Neon:** repetir el diagnóstico y abortar si los tres conjuntos de
   conflictos o los correos normalizados duplicados ya no son cero. Ejecutar
   completos y en orden `migrar_administradores.sql`,
   `migrar_disponibilidad_citas.sql` y
   `migrar_restricciones_contratos.sql`. Cada archivo tiene su propia
   transacción. Ejecutar `verificar_actualizacion.sql` antes de permitir
   escrituras: totales conservados, reservas iguales a citas activas, cero
   inconsistencias, índices válidos y trigger habilitado.
4. **Render:** configurar el secreto privado, desplegar la versión nueva del
   backend y verificar salud, login de inquilino, lectura de citas y
   disponibilidad. Crear el primer administrador con el procedimiento de
   arriba. Comprobar login administrativo, agenda y una reserva ficticia en un
   entorno aislado antes de levantar mantenimiento. Publicar la versión móvil
   nueva solo después de confirmar que la API nueva funciona. Revisar logs
   sin cuerpos, contraseñas ni JWT.
5. **Si una migración falla antes de `COMMIT`:** la transacción revierte sus
   cambios. Mantener mantenimiento, diagnosticar y corregir; no iniciar el
   backend nuevo. Si una migración anterior ya se confirmó, no asumir que
   todas se revirtieron.
6. **Si falla después de confirmar la migración de citas:** mantener el
   servicio en mantenimiento. Priorizar una corrección hacia adelante sobre
   el esquema nuevo. El backend viejo no funciona con `id_horario NOT NULL`.
   Antes de contemplar restaurar `uq_cita_horario`, buscar duplicados de
   **todas** las citas, incluidos estados históricos:

```sql
SELECT fecha_cita, hora_cita, COUNT(*) AS cantidad
FROM public.citas GROUP BY fecha_cita, hora_cita HAVING COUNT(*) > 1;
```

   Si hay filas, reinstalar la restricción antigua fallaría y no debe hacerse
   eliminando citas. La otra vía es restaurar **la copia completa** previa a
   la migración y la versión anterior del backend de forma coordinada. Si hubo
   escrituras nuevas, conservarlas aparte y planear su reconciliación antes
   de restaurar; la copia anterior por sí sola no las contiene. No ejecutar
   un script destructivo improvisado ni eliminar administradores o bitácora.

## Pruebas manuales posteriores a la integración

Desde `VLCLIENT`, iniciar Expo Go con `npx expo start --clear` después de
aplicar las migraciones, desplegar el backend y configurar el secreto. Usar
cuentas de prueba; no capturar contraseñas ni JWT en registros.

1. Entrar como administrador desde el formulario único de inicio de sesión.
   Comprobar el drawer, el resumen y la consulta de inquilinos. El formulario de
   registro debe indicar que no hay propiedades disponibles. En base aislada,
   registrar una cuenta ficticia y comprobar contrato, propiedad `rentada` y
   bitácora; repetir correo y propiedad debe devolver conflicto sin filas nuevas.
   Cerrar sesión y
   comprobar que el botón Atrás no recupera el panel.
2. Habilitar una fecha futura y dos horarios libres. Entrar como inquilino y
   comprobar que solo se muestran esos horarios. Reservar uno y comprobar que
   desaparece de la disponibilidad del otro inquilino inmediatamente.
3. Confirmar la cita en Gestión de citas y comprobar una única notificación
   interna. Solicitar reagendamiento de otra cita elegible, elegir un horario
   libre, comprobar estado `programada` y `reagendado_estado='utilizado'`, y
   confirmar de nuevo desde el administrador.
4. Probar el aviso de segundo horario no disponible con una cita de prueba
   distinta. Comprobar que no aparece una segunda oportunidad.
5. Abrir Mis reportes con 12 o más registros; comprobar miniaturas, paginación,
   citas y borradores. Registrar tiempos observados con Render activo y tras
   arranque en frío. No interpretar las pruebas unitarias como medición física.

Los scripts SQL administrativos anteriores de confirmación, solicitud de
reagendamiento y segundo horario conservan su función de contingencia: no
cambian fecha u hora y el trigger mantiene la reserva cuando se confirma la
cita. Ejecutarlos solo tras verificar la migración y desde un acceso controlado.

## Git y despliegue futuro

Antes de preparar archivos, revisar `git status --short` y el diff, incluidos
archivos nuevos. Evitar `git add .`: hay archivos ajenos a esta actualización
en el árbol de trabajo. Confirmar que no se incluyan `.env`, credenciales
nativas, hashes del administrador ni `backend/generarHash.js` sin revisarlo.
Tras aprobar las migraciones y las pruebas, usar el proceso
habitual de Git del proyecto. En Render, mantener Root Directory `backend`,
Build Command `npm ci` y Start Command `npm start`; configurar
`ADMIN_JWT_SECRET` directamente en Render. Aplicar la migración antes de
desplegar el código nuevo, dentro de la ventana de mantenimiento de citas.
Después del despliegue, verificar `/api`, login administrativo, lectura de
resumen, disponibilidad y creación transaccional con cuentas de prueba. No
activar push remotas ni Cron Jobs en esta actualización.
