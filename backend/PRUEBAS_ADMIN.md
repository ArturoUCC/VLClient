# Entorno local de pruebas administrativas

La rama aislada de Neon ya tiene las tres migraciones y sus comprobaciones.
Este procedimiento **no** ejecuta migraciones ni usa el `.env` normal. El
archivo `backend/.env.pruebas` está ignorado por Git y contiene únicamente
`DATABASE_URL` y tres secretos generados localmente: `JWT_SECRET`,
`ADMIN_JWT_SECRET` y `RECOVERY_RATE_LIMIT_SECRET`. No copiar a este archivo
claves de Resend, Cloudinary, Firebase ni Expo.

## Comprobación inicial desde CMD

```cmd
cd /d "C:\Users\Arturo\OneDrive\Documentos\Clases\7mo Sem\Prof Guillermo\VLCLIENT\backend"
npm run dev:pruebas -- --check
```

El comando valida el hostname **exacto** de la rama autorizada y la presencia
de secretos distintos, sin conectarse a la base ni mostrar sus valores. Si la
URL cambia, el arranque falla cerrado. `scripts/prepararSecretosPruebas.js`
añade los tres secretos si faltan; no es necesario volver a ejecutarlo ahora.
El lanzador usa `sslmode=verify-full` en la conexión efectiva, incluso si la
URL privada copiada de Neon contenía `sslmode=require`; el `.env.pruebas` y la
conexión de producción no se reescriben. Para comprobar TLS y autenticación
sin modificar datos, ejecutar `npm run dev:pruebas -- --check-db`.
No usar `npm run dev`, `npm start` ni el script normal del generador de hash
para este entorno.

## Iniciar el backend

En la misma carpeta, en una ventana CMD dedicada:

```cmd
npm run dev:pruebas
```

Express escucha en el puerto **3000**. El lanzador crea un proceso hijo con
una lista corta de variables de sistema y las cuatro variables permitidas del
archivo de pruebas; descarta credenciales externas heredadas. `server.js` y
`config/db.js` omiten `.env` normal en este modo y vuelven a verificar el host
antes de iniciar. Comprobar salud desde otra ventana:

```cmd
curl http://127.0.0.1:3000/api
```

La solicitud de correo de recuperación y los POST de fotografías devuelven
**503** en este modo. Resend, Cloudinary y Expo Push tampoco hacen llamadas
externas si se invocan directamente. La capacidad de sincronizar fotografías
se anuncia como deshabilitada; ningún resultado se presenta como carga o envío
exitoso. Las notificaciones internas, login, citas y consultas siguen usando
la rama aislada. Las miniaturas remotas de Cloudinary no se descargan en la
app de pruebas.

## Crear el primer administrador solo en la rama de pruebas

Después de iniciar o verificar el backend, abrir **otra** ventana CMD:

```cmd
cd /d "C:\Users\Arturo\OneDrive\Documentos\Clases\7mo Sem\Prof Guillermo\VLCLIENT\backend"
npm run dev:pruebas -- --crear-admin
```

El programa pide nombre, apellido, correo y contraseña en la terminal. La
contraseña y su confirmación se introducen ocultas. Valida la política,
genera bcrypt con costo 12 y, dentro de una transacción, comprueba que no
exista otro administrador, inserta la cuenta y registra la bitácora. No
imprime ni guarda contraseña, hash, JWT ni cadena de conexión. Si la cuenta
inicial ya existe, no crea otra. **Este comando modifica únicamente la rama
aislada**; no ejecutarlo hasta que se quiera crear esa cuenta de prueba.

## Expo Go con backend local

Conectar teléfono y PC a la misma red Wi-Fi. La IP Wi-Fi observada al preparar
esta guía fue `192.168.100.16`; comprobar si sigue vigente con `ipconfig`.
Desde otra ventana CMD:

```cmd
cd /d "C:\Users\Arturo\OneDrive\Documentos\Clases\7mo Sem\Prof Guillermo\VLCLIENT\VLCLIENT"
npm run start:pruebas -- --check 192.168.100.16
npm run start:pruebas -- 192.168.100.16
```

Sustituir la IP si cambió. El comando exige una IPv4 privada y construye
`http://<IP_DEL_PC>:3000/api`. Expo SDK 58 carga normalmente variables de
archivos `.env`; este lanzador usa `EXPO_NO_DOTENV=1` y entrega solo las
variables públicas de la API de pruebas. Fuera de este modo, la app conserva
la URL de Render. Las URL públicas de Expo no contienen credenciales. Si el
teléfono no llega a la API, revisar que el firewall de Windows permita el
puerto 3000 en la red privada y que ambos estén en la misma Wi-Fi.

No publicar una compilación con la API local. No activar push remotas, Cron
Jobs ni servicios externos durante este ensayo.

## Seguridad y cierre

Desde la raíz del repositorio:

```cmd
git check-ignore --no-index -v backend/.env.pruebas
git ls-files -- backend/.env.pruebas
```

El primer comando debe mostrar la regla de exclusión; el segundo no debe
mostrar nada. Detener backend y Expo con `Ctrl+C`. Mantener `.env.pruebas`
fuera de capturas, adjuntos y Git. Las pruebas automatizadas validan host,
aislamiento del entorno, bloqueo de servicios externos y conservación de la
URL normal de Render; no sustituyen una prueba manual en Expo Go.
