const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const iniciarSesion = async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (
      typeof correo !== 'string' ||
      typeof password !== 'string' ||
      !correo.trim() ||
      !password
    ) {
      return res.status(400).json({
        mensaje: 'Correo y contraseña son obligatorios'
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET no está configurado');

      return res.status(500).json({
        mensaje: 'Error de configuración del servidor'
      });
    }

    const resultado = await pool.query(
      `SELECT
        id_inquilino,
        nombre,
        apellido,
        correo,
        password_hash,
        activo
      FROM inquilinos
      WHERE LOWER(correo) = LOWER($1)
      LIMIT 1`,
      [correo.trim()]
    );

    const inquilino = resultado.rows[0];

    if (!inquilino || !inquilino.activo) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    const passwordValido = await bcrypt.compare(
      password,
      inquilino.password_hash
    );

    if (!passwordValido) {
      return res.status(401).json({
        mensaje: 'Credenciales incorrectas'
      });
    }

    const token = jwt.sign(
      {
        id_inquilino: inquilino.id_inquilino,
        rol: 'inquilino'
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        algorithm: 'HS256'
      }
    );

    return res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      inquilino: {
        id_inquilino: inquilino.id_inquilino,
        nombre: inquilino.nombre,
        apellido: inquilino.apellido,
        correo: inquilino.correo
      }
    });

  } catch (error) {
    console.error('Error de autenticación:', error.message);

    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = { iniciarSesion };
