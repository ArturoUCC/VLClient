const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verificarToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      mensaje: 'Token de autenticación requerido'
    });
  }

  const token = authorization.slice(7).trim();

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });

    if (
      datos.rol !== 'inquilino' ||
      !Number.isInteger(datos.id_inquilino)
    ) {
      return res.status(403).json({
        mensaje: 'Acceso no autorizado'
      });
    }

    const resultado = await pool.query(
      `SELECT id_inquilino
       FROM inquilinos
       WHERE id_inquilino = $1 AND activo = TRUE`,
      [datos.id_inquilino]
    );

    if (resultado.rows.length === 0) {
      return res.status(403).json({
        mensaje: 'La cuenta no está activa'
      });
    }

    req.usuario = {
      id_inquilino: datos.id_inquilino,
      rol: datos.rol
    };

    next();

  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      return res.status(401).json({
        mensaje: 'Token inválido o expirado'
      });
    }

    console.error('Error de autenticación:', error.message);

    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = { verificarToken };
