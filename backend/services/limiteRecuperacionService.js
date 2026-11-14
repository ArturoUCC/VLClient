const { createHmac } = require('node:crypto');
const pool = require('../config/db');

const consumirLimite = async (tipo, valor, maximo, minutos) => {
  const secreto = process.env.RECOVERY_RATE_LIMIT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error('Configuración del limitador incompleta');
  }
  const clave = createHmac('sha256', secreto)
    .update(`${tipo}:${valor || 'sin-ip'}`)
    .digest('hex');
  const resultado = await pool.query(
    `INSERT INTO limites_recuperacion_password
       (clave, ventana_inicio, intentos)
     VALUES ($1, NOW(), 1)
     ON CONFLICT (clave) DO UPDATE SET
       intentos = CASE
         WHEN limites_recuperacion_password.ventana_inicio <= NOW() - ($2 * INTERVAL '1 minute')
         THEN 1 ELSE limites_recuperacion_password.intentos + 1 END,
       ventana_inicio = CASE
         WHEN limites_recuperacion_password.ventana_inicio <= NOW() - ($2 * INTERVAL '1 minute')
         THEN NOW() ELSE limites_recuperacion_password.ventana_inicio END
     RETURNING intentos`,
    [clave, minutos]
  );
  return resultado.rows[0].intentos <= maximo;
};

module.exports = { consumirLimite };
