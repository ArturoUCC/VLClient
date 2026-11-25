const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { evaluarPassword } = require('../utils/passwordPolicy');

const crearAdministrador = async (req, res) => {
  const { nombre, apellido, correo, password, confirmacion } = req.body || {};
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100 ||
      typeof apellido !== 'string' || !apellido.trim() || apellido.length > 100 ||
      typeof correo !== 'string' || correo.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||
      !evaluarPassword(password).valida || password !== confirmacion) {
    return res.status(400).json({ mensaje: 'Datos o contraseña inválidos' });
  }
  let client;
  let transaccion = false;
  try {
    const hash = await bcrypt.hash(password, 12);
    client = await pool.connect();
    await client.query('BEGIN'); transaccion = true;
    const resultado = await client.query(
      `INSERT INTO administradores(nombre,apellido,correo,password_hash)
       VALUES($1,$2,$3,$4)
       RETURNING id_administrador,nombre,apellido,correo,activo`,
      [nombre.trim(), apellido.trim(), correo.trim().toLowerCase(), hash]);
    await client.query(
      `INSERT INTO bitacora_administrativa
       (id_administrador,accion,entidad,entidad_id)
       VALUES($1,'crear_administrador','administradores',$2)`,
      [req.administrador.id_administrador, resultado.rows[0].id_administrador]);
    await client.query('COMMIT'); transaccion = false;
    return res.status(201).json({ administrador: resultado.rows[0] });
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'El correo ya está registrado' });
    }
    return res.status(503).json({ mensaje: 'No se pudo crear el administrador' });
  } finally { if (client) client.release(); }
};

const cambiarEstadoAdministrador = async (req, res) => {
  const id = Number(req.params.idAdministrador);
  const activo = req.body?.activo;
  if (!Number.isSafeInteger(id) || id <= 0 || typeof activo !== 'boolean' ||
      id === req.administrador.id_administrador && !activo) {
    return res.status(400).json({ mensaje: 'Cambio no permitido' });
  }
  let client;
  let transaccion = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN'); transaccion = true;
    const resultado = await client.query(
      `UPDATE administradores SET activo=$1,
         sesion_version=sesion_version+1 WHERE id_administrador=$2
       RETURNING id_administrador,activo`, [activo, id]);
    if (!resultado.rows.length) {
      await client.query('ROLLBACK'); transaccion = false;
      return res.status(404).json({ mensaje: 'Administrador no encontrado' });
    }
    await client.query(
      `INSERT INTO bitacora_administrativa
       (id_administrador,accion,entidad,entidad_id,detalles)
       VALUES($1,'cambiar_estado_administrador','administradores',$2,$3::jsonb)`,
      [req.administrador.id_administrador, id, JSON.stringify({ activo })]);
    await client.query('COMMIT'); transaccion = false;
    return res.json({ administrador: resultado.rows[0] });
  } catch (_) {
    if (transaccion) await client.query('ROLLBACK').catch(() => {});
    return res.status(503).json({ mensaje: 'No se pudo cambiar el estado' });
  } finally { if (client) client.release(); }
};

module.exports = { crearAdministrador, cambiarEstadoAdministrador };
