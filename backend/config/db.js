const { Pool } = require('pg');
if (process.env.VLCLIENT_TEST_MODE === '1') {
  require('./entornoPruebas').afirmarProcesoPruebas();
} else {
  require('dotenv').config();
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('error', (error) => {
  if (process.env.VLCLIENT_TEST_MODE === '1') {
    console.error('Error en conexión inactiva con PostgreSQL de pruebas');
  } else {
    console.error('Error en conexión inactiva con PostgreSQL:', error.message);
  }
});

module.exports = pool;
