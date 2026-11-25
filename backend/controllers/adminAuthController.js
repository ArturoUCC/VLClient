const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { consumirLimite } = require('../services/limiteRecuperacionService');

const hashFicticio = bcrypt.hash('acceso-administrativo-no-registrado', 12);

const loginAdministrador = async (req, res) => {
  const { correo, password } = req.body || {};
  if (typeof correo !== 'string' || typeof password !== 'string' ||
      !correo.trim() || !password || correo.length > 254) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }
  try {
    if (!process.env.ADMIN_JWT_SECRET ||
        Buffer.byteLength(process.env.ADMIN_JWT_SECRET, 'utf8') < 32 ||
        process.env.ADMIN_JWT_SECRET === process.env.JWT_SECRET) {
      throw new Error('Configuración incompleta');
    }
    const normalizado = correo.trim().toLowerCase();
    const ipPermitida = await consumirLimite('admin-login-ip', req.ip, 20, 15);
    const correoPermitido = await consumirLimite('admin-login-correo', normalizado, 5, 15);
    if (!ipPermitida || !correoPermitido) {
      return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta más tarde' });
    }
    const resultado = await pool.query(
      `SELECT id_administrador, nombre, apellido, correo, password_hash,
              activo, sesion_version FROM administradores
       WHERE lower(correo) = $1 LIMIT 1`, [normalizado]);
    const admin = resultado.rows[0];
    const valido = await bcrypt.compare(password,
      admin?.activo ? admin.password_hash : await hashFicticio);
    if (!admin?.activo || !valido) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }
    const token = jwt.sign({ rol: 'administrador',
      id_administrador: admin.id_administrador,
      sesion_version: admin.sesion_version }, process.env.ADMIN_JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m', algorithm: 'HS256' });
    return res.json({ token, administrador: {
      id_administrador: admin.id_administrador,
      nombre: admin.nombre, apellido: admin.apellido, correo: admin.correo,
      rol: 'administrador',
    } });
  } catch (_) {
    console.error('Error al iniciar sesión administrativa');
    return res.status(503).json({ mensaje: 'Servicio temporalmente no disponible' });
  }
};

const perfilAdministrador = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id_administrador, nombre, apellido, correo, fecha_registro
       FROM administradores WHERE id_administrador = $1 AND activo = TRUE`,
      [req.administrador.id_administrador]);
    return res.json({ administrador: resultado.rows[0] });
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudo consultar el perfil' });
  }
};

const logoutAdministrador = async (req, res) => {
  try {
    await pool.query(
      `UPDATE administradores SET sesion_version = sesion_version + 1
       WHERE id_administrador = $1 AND activo = TRUE`,
      [req.administrador.id_administrador]);
    return res.status(204).end();
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudo cerrar la sesión' });
  }
};

module.exports = { loginAdministrador, perfilAdministrador, logoutAdministrador };
