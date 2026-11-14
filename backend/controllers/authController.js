const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes, createHash } = require('node:crypto');
const { enviarRecuperacion } = require('../services/correoRecuperacionService');
const { consumirLimite } = require('../services/limiteRecuperacionService');

const RESPUESTA_SOLICITUD = {
  mensaje: 'Si existe una cuenta asociada, recibirás instrucciones por correo.'
};
const ERROR_TOKEN = { mensaje: 'El enlace es inválido o ha expirado.' };
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const responderSolicitud = async (res, inicio) => {
  // Reduce diferencias observables entre correos registrados y desconocidos.
  const espera = Math.max(0, 500 - (Date.now() - inicio));
  if (espera) await new Promise((resolve) => setTimeout(resolve, espera));
  return res.status(202).json(RESPUESTA_SOLICITUD);
};

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
        activo,
        sesion_version
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
        rol: 'inquilino',
        sesion_version: inquilino.sesion_version
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

const solicitarRecuperacion = async (req, res) => {
  const inicio = Date.now();
  const correo = req.body?.correo;
  if (typeof correo !== 'string' || correo.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
    return res.status(400).json({ mensaje: 'Correo inválido' });
  }

  const correoNormalizado = correo.trim().toLowerCase();
  try {
    const ipPermitida = await consumirLimite('solicitud-ip', req.ip, 10, 60);
    if (!ipPermitida) {
      return responderSolicitud(res, inicio);
    }
    const correoPermitido = await consumirLimite('solicitud-correo', correoNormalizado, 3, 60);
    if (!correoPermitido) {
      return responderSolicitud(res, inicio);
    }

    const cliente = await pool.connect();
    let destinatario;
    let token;
    let idRecuperacion;
    try {
      await cliente.query('BEGIN');
      const cuenta = await cliente.query(
        `SELECT id_inquilino, correo FROM inquilinos
         WHERE LOWER(correo) = $1 AND activo = TRUE
         LIMIT 1 FOR UPDATE`,
        [correoNormalizado]
      );
      if (cuenta.rows.length) {
        destinatario = cuenta.rows[0].correo;
        token = randomBytes(32).toString('hex');
        await cliente.query(
          `UPDATE recuperaciones_password SET fecha_uso = NOW()
           WHERE id_inquilino = $1 AND fecha_uso IS NULL`,
          [cuenta.rows[0].id_inquilino]
        );
        const creado = await cliente.query(
          `INSERT INTO recuperaciones_password
           (id_inquilino, token_hash, fecha_creacion, fecha_expiracion)
           VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 minutes')
           RETURNING id_recuperacion`,
          [cuenta.rows[0].id_inquilino, hashToken(token)]
        );
        idRecuperacion = creado.rows[0].id_recuperacion;
      }
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }

    if (destinatario) {
      // El proveedor no afecta el tiempo ni la respuesta pública de la solicitud.
      void enviarRecuperacion(destinatario, token).catch(async () => {
        console.error('No se pudo enviar el correo de recuperación');
        try {
          await pool.query(
            `UPDATE recuperaciones_password SET fecha_uso = NOW()
             WHERE id_recuperacion = $1 AND fecha_uso IS NULL`,
            [idRecuperacion]
          );
        } catch (_) {
          console.error('No se pudo invalidar el enlace no enviado');
        }
      });
    }
    return responderSolicitud(res, inicio);
  } catch (error) {
    console.error('Error al solicitar recuperación de contraseña');
    return res.status(503).json({ mensaje: 'Servicio temporalmente no disponible' });
  }
};

const restablecerPassword = async (req, res) => {
  const { token, nuevaPassword } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) ||
      typeof nuevaPassword !== 'string' || nuevaPassword.length < 12 ||
      Buffer.byteLength(nuevaPassword, 'utf8') > 72) {
    return res.status(400).json({ mensaje: 'Enlace o contraseña inválidos' });
  }

  try {
    const ipPermitida = await consumirLimite('restablecer-ip', req.ip, 10, 60);
    if (!ipPermitida) {
      return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta más tarde.' });
    }
    const tokenPermitido = await consumirLimite('restablecer-token', hashToken(token), 5, 60);
    if (!tokenPermitido) {
      return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta más tarde.' });
    }

    const nuevoHash = await bcrypt.hash(nuevaPassword, 12);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const recuperacion = await cliente.query(
        `SELECT id_inquilino FROM recuperaciones_password WHERE token_hash = $1`,
        [hashToken(token)]
      );
      if (!recuperacion.rows.length) {
        await cliente.query('ROLLBACK');
        return res.status(400).json(ERROR_TOKEN);
      }
      const idInquilino = recuperacion.rows[0].id_inquilino;
      const cuenta = await cliente.query(
        `SELECT id_inquilino FROM inquilinos
         WHERE id_inquilino = $1 AND activo = TRUE FOR UPDATE`,
        [idInquilino]
      );
      const vigente = await cliente.query(
        `SELECT id_recuperacion FROM recuperaciones_password
         WHERE token_hash = $1 AND fecha_uso IS NULL
           AND fecha_expiracion > NOW() FOR UPDATE`,
        [hashToken(token)]
      );
      if (!cuenta.rows.length || !vigente.rows.length) {
        await cliente.query('ROLLBACK');
        return res.status(400).json(ERROR_TOKEN);
      }
      await cliente.query(
        `UPDATE inquilinos SET password_hash = $1,
         sesion_version = sesion_version + 1 WHERE id_inquilino = $2`,
        [nuevoHash, idInquilino]
      );
      await cliente.query(
        `UPDATE recuperaciones_password SET fecha_uso = NOW()
         WHERE id_inquilino = $1 AND fecha_uso IS NULL`,
        [idInquilino]
      );
      await cliente.query('COMMIT');
      return res.json({ mensaje: 'Contraseña actualizada. Inicia sesión de nuevo.' });
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  } catch (error) {
    console.error('Error al restablecer contraseña');
    return res.status(503).json({ mensaje: 'Servicio temporalmente no disponible' });
  }
};

module.exports = { iniciarSesion, solicitarRecuperacion, restablecerPassword };
