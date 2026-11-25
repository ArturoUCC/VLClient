const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verificarAdministrador = async (req, res, next) => {
  const cabecera = req.headers.authorization;
  if (typeof cabecera !== 'string' || !cabecera.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Sesión administrativa requerida' });
  }
  try {
    if (!process.env.ADMIN_JWT_SECRET ||
        Buffer.byteLength(process.env.ADMIN_JWT_SECRET, 'utf8') < 32 ||
        process.env.ADMIN_JWT_SECRET === process.env.JWT_SECRET) {
      throw new Error('Configuración incompleta');
    }
    const datos = jwt.verify(cabecera.slice(7).trim(), process.env.ADMIN_JWT_SECRET,
      { algorithms: ['HS256'] });
    if (datos.rol !== 'administrador' ||
        !Number.isSafeInteger(datos.id_administrador) ||
        !Number.isSafeInteger(datos.sesion_version)) {
      return res.status(403).json({ mensaje: 'Acceso no autorizado' });
    }
    const resultado = await pool.query(
      `SELECT id_administrador, sesion_version FROM administradores
       WHERE id_administrador = $1 AND activo = TRUE`, [datos.id_administrador]);
    if (resultado.rows.length !== 1 ||
        resultado.rows[0].sesion_version !== datos.sesion_version) {
      return res.status(401).json({ mensaje: 'Sesión administrativa inválida' });
    }
    req.administrador = { id_administrador: datos.id_administrador };
    return next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ mensaje: 'Sesión administrativa inválida' });
    }
    console.error('Error al verificar sesión administrativa');
    return res.status(503).json({ mensaje: 'Servicio temporalmente no disponible' });
  }
};

module.exports = { verificarAdministrador };
