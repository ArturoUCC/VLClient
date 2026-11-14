const pool = require('../config/db');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPO_TOKEN = /^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{1,256}\]$/;
const CAMPOS = ['instalacion_id', 'expo_push_token', 'plataforma', 'expo_project_id'];

const validarRegistro = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== CAMPOS.length ||
      !CAMPOS.every((campo) => Object.hasOwn(body, campo))) return false;

  return typeof body.instalacion_id === 'string' && UUID.test(body.instalacion_id) &&
    typeof body.expo_push_token === 'string' &&
    body.expo_push_token.length <= 512 && EXPO_TOKEN.test(body.expo_push_token) &&
    ['android', 'ios'].includes(body.plataforma) &&
    typeof body.expo_project_id === 'string' && UUID.test(body.expo_project_id);
};

const registrarDispositivo = async (req, res) => {
  if (!validarRegistro(req.body)) {
    return res.status(400).json({ mensaje: 'Datos de dispositivo inválidos' });
  }
  const projectId = process.env.EXPO_PROJECT_ID;
  if (!projectId || !UUID.test(projectId)) {
    return res.status(503).json({ mensaje: 'Registro push no disponible' });
  }
  if (req.body.expo_project_id.toLowerCase() !== projectId.toLowerCase()) {
    return res.status(400).json({ mensaje: 'Proyecto Expo inválido' });
  }

  let cliente;
  try {
    cliente = await pool.connect();
    await cliente.query('BEGIN');
    const cuenta = await cliente.query(
      `SELECT sesion_version FROM inquilinos
       WHERE id_inquilino = $1 AND activo = TRUE FOR UPDATE`,
      [req.usuario.id_inquilino]
    );
    if (!cuenta.rows.length ||
        cuenta.rows[0].sesion_version !== req.usuario.sesion_version) {
      await cliente.query('ROLLBACK');
      return res.status(401).json({ mensaje: 'Sesión inválida o expirada' });
    }

    const resultado = await cliente.query(
      `INSERT INTO push_dispositivos
         (id_inquilino, instalacion_id, expo_push_token, expo_project_id,
          plataforma, sesion_version_registro)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (instalacion_id) WHERE activo
       DO UPDATE SET
         expo_push_token = EXCLUDED.expo_push_token,
         expo_project_id = EXCLUDED.expo_project_id,
         plataforma = EXCLUDED.plataforma,
         sesion_version_registro = EXCLUDED.sesion_version_registro,
         fecha_actualizacion = NOW(),
         ultimo_error_codigo = NULL
       WHERE push_dispositivos.id_inquilino = EXCLUDED.id_inquilino
       RETURNING id_push_dispositivo, instalacion_id, plataforma`,
      [req.usuario.id_inquilino, req.body.instalacion_id,
        req.body.expo_push_token, projectId, req.body.plataforma,
        cuenta.rows[0].sesion_version]
    );
    if (!resultado.rows.length) {
      await cliente.query('ROLLBACK');
      return res.status(409).json({ mensaje: 'Dispositivo ya registrado' });
    }
    await cliente.query('COMMIT');
    return res.status(200).json({
      mensaje: 'Dispositivo registrado',
      dispositivo: resultado.rows[0],
    });
  } catch (error) {
    if (cliente) {
      try { await cliente.query('ROLLBACK'); } catch (_) { /* conexión fallida */ }
    }
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Dispositivo ya registrado' });
    }
    console.error('No se pudo registrar el dispositivo push');
    return res.status(503).json({ mensaje: 'Registro push no disponible' });
  } finally {
    if (cliente) cliente.release();
  }
};

const desactivarDispositivo = async (req, res) => {
  const instalacionId = req.params.instalacionId;
  if (!UUID.test(instalacionId || '')) {
    return res.status(400).json({ mensaje: 'Instalación inválida' });
  }
  try {
    await pool.query(
      `UPDATE push_dispositivos
       SET activo = FALSE, desactivado_at = NOW(), fecha_actualizacion = NOW()
       WHERE instalacion_id = $1 AND id_inquilino = $2 AND activo = TRUE`,
      [instalacionId, req.usuario.id_inquilino]
    );
    return res.status(204).end();
  } catch (_) {
    console.error('No se pudo desactivar el dispositivo push');
    return res.status(503).json({ mensaje: 'Desactivación push no disponible' });
  }
};

module.exports = { registrarDispositivo, desactivarDispositivo };
