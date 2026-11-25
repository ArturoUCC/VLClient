const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { consumirLimite } = require('../services/limiteRecuperacionService');

const hashFicticio = bcrypt.hash('cuenta-no-registrada', 12);
const respuestaInvalida = { mensaje: 'Credenciales incorrectas' };

const iniciarSesionUnificada = async (req, res) => {
  const { correo, password } = req.body || {};
  if (typeof correo !== 'string' || typeof password !== 'string' ||
      !correo.trim() || !password || correo.length > 254) {
    return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
  }
  try {
    const secretoAdmin = process.env.ADMIN_JWT_SECRET;
    const secretoInquilino = process.env.JWT_SECRET;
    if (!secretoAdmin || Buffer.byteLength(secretoAdmin, 'utf8') < 32 ||
        !secretoInquilino || secretoAdmin === secretoInquilino) {
      throw new Error('Configuración de autenticación incompleta');
    }
    const normalizado = correo.trim().toLowerCase();
    const [ipPermitida, correoPermitido] = await Promise.all([
      consumirLimite('login-unificado-ip', req.ip, 20, 15),
      consumirLimite('login-unificado-correo', normalizado, 5, 15),
    ]);
    if (!ipPermitida || !correoPermitido) {
      return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta más tarde' });
    }
    const [administradores, inquilinos] = await Promise.all([
      pool.query(`SELECT id_administrador,nombre,apellido,correo,password_hash,
          activo,sesion_version FROM administradores
        WHERE lower(correo)=$1 LIMIT 1`, [normalizado]),
      pool.query(`SELECT id_inquilino,nombre,apellido,correo,password_hash,
          activo,sesion_version FROM inquilinos
        WHERE lower(correo)=$1 LIMIT 1`, [normalizado]),
    ]);
    const admin = administradores.rows[0];
    const inquilino = inquilinos.rows[0];
    // La coincidencia entre tablas es ambigua incluso si solo una contraseña coincide.
    const [adminValido, inquilinoValido] = await Promise.all([
      bcrypt.compare(password, admin?.activo ? admin.password_hash : await hashFicticio),
      bcrypt.compare(password, inquilino?.activo ? inquilino.password_hash : await hashFicticio),
    ]);
    if ((admin && inquilino) || (!adminValido && !inquilinoValido)) {
      return res.status(401).json(respuestaInvalida);
    }
    const esAdmin = Boolean(admin?.activo && adminValido);
    const cuenta = esAdmin ? admin : inquilino;
    if (!cuenta?.activo || !(esAdmin ? adminValido : inquilinoValido)) {
      return res.status(401).json(respuestaInvalida);
    }
    const rol = esAdmin ? 'administrador' : 'inquilino';
    const identificador = esAdmin ? 'id_administrador' : 'id_inquilino';
    const token = jwt.sign({ rol, [identificador]: cuenta[identificador],
      sesion_version: cuenta.sesion_version },
    esAdmin ? secretoAdmin : secretoInquilino,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m', algorithm: 'HS256' });
    return res.json({ token, rol, [esAdmin ? 'administrador' : 'inquilino']: {
      [identificador]: cuenta[identificador], nombre: cuenta.nombre,
      apellido: cuenta.apellido, correo: cuenta.correo,
    } });
  } catch (_) {
    console.error('Error en inicio de sesión unificado');
    return res.status(503).json({ mensaje: 'Servicio temporalmente no disponible' });
  }
};

module.exports = { iniciarSesionUnificada };
