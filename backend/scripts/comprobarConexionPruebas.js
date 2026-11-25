// Consulta de solo lectura en la rama autorizada, sin imprimir metadatos privados.
if (process.env.VLCLIENT_TEST_MODE !== '1') {
  console.error('El modo de pruebas no está activo');
  process.exitCode = 1;
} else {
  const pool = require('../config/db');
  pool.query('SELECT 1').then(() => {
    console.log('Conexión de pruebas verificada con TLS y hostname validado');
  }).catch(() => {
    console.error('No se pudo verificar la conexión de pruebas');
    process.exitCode = 1;
  }).finally(() => pool.end());
}
