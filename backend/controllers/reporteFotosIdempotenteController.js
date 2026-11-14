const { createHash } = require('node:crypto');
const path = require('node:path');
const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const { claveValida } = require('../utils/idempotencia');
const { imagenValida } = require('../utils/validarImagen');

const nombreSeguro = (archivo) =>
  path.posix.basename(String(archivo.originalname || 'fotografia').replace(/\\/g, '/')).slice(0, 150);
const identificadorCloudinary = (idReporte, clave, buffer) =>
  `vlclient/reportes/${idReporte}/${clave.toLowerCase()}-${createHash('sha256').update(buffer).digest('hex')}`;
const coincideFoto = (fila, identificador, nombre) => {
  try {
    const url = new URL(fila.url_foto);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
      url.pathname.includes(`/${identificador}.`) && fila.nombre_archivo === nombre;
  } catch (_) {
    return false;
  }
};

const subirORecuperar = async (archivo, identificador) => {
  try {
    const resultado = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        public_id: identificador,
        resource_type: 'image',
        overwrite: false,
        unique_filename: false,
      }, (error, imagen) => error ? reject(error) : resolve(imagen));
      stream.end(archivo.buffer);
    });
    if (resultado?.public_id !== identificador || !resultado.secure_url) {
      throw new Error('Resultado de imagen no verificable');
    }
    return resultado;
  } catch (error) {
    // El upload pudo completarse aunque la respuesta se perdiera. El mismo
    // public_id identifica exactamente los mismos bytes en un reintento.
    try {
      const recuperada = await cloudinary.api.resource(identificador, {
        resource_type: 'image',
      });
      if (recuperada?.public_id === identificador && recuperada.secure_url) {
        return recuperada;
      }
    } catch (_) { /* Conservar el fallo original; un reintento puede recuperar. */ }
    throw error;
  }
};

const subirFotoIdempotente = async (req, res) => {
  const idReporte = Number(req.params.idReporte);
  const clave = req.body?.clave_idempotencia;
  const archivo = req.files?.[0];
  if (!Number.isSafeInteger(idReporte) || idReporte <= 0 || !claveValida(clave) ||
      req.files?.length !== 1 || !imagenValida(archivo)) {
    return res.status(400).json({ mensaje: 'Fotografía o clave inválida' });
  }
  const nombre = nombreSeguro(archivo);
  const identificador = identificadorCloudinary(idReporte, clave, archivo.buffer);
  const propietario = req.usuario.id_inquilino;
  let cliente;
  let transaccion = false;
  try {
    // Comprobar propiedad antes de leer la clave o contactar a Cloudinary.
    const reporte = await pool.query(
      `SELECT r.id_reporte FROM reportes r
       JOIN contratos c ON c.id_contrato = r.id_contrato
       WHERE r.id_reporte = $1 AND c.id_inquilino = $2`,
      [idReporte, propietario]
    );
    if (!reporte.rows.length) {
      return res.status(404).json({ mensaje: 'Reporte no encontrado' });
    }
    const previa = await pool.query(
      `SELECT * FROM reporte_fotos
       WHERE id_reporte = $1 AND clave_idempotencia = $2`, [idReporte, clave]
    );
    if (previa.rows.length) {
      if (!coincideFoto(previa.rows[0], identificador, nombre)) {
        return res.status(409).json({ mensaje: 'La clave de fotografía ya fue utilizada' });
      }
      return res.status(200).json({ foto: previa.rows[0], reutilizada: true });
    }

    const imagen = await subirORecuperar(archivo, identificador);
    cliente = await pool.connect();
    await cliente.query('BEGIN');
    transaccion = true;
    // La transacción empieza después de Cloudinary. El bloqueo serializa
    // la cuenta de fotos y la inserción frente a cargas simultáneas.
    const bloqueado = await cliente.query(
      `SELECT r.id_reporte FROM reportes r
       JOIN contratos c ON c.id_contrato = r.id_contrato
       WHERE r.id_reporte = $1 AND c.id_inquilino = $2 FOR UPDATE OF r`,
      [idReporte, propietario]
    );
    if (!bloqueado.rows.length) {
      await cliente.query('ROLLBACK'); transaccion = false;
      return res.status(404).json({ mensaje: 'Reporte no encontrado' });
    }
    const existente = await cliente.query(
      `SELECT * FROM reporte_fotos
       WHERE id_reporte = $1 AND clave_idempotencia = $2`, [idReporte, clave]
    );
    if (existente.rows.length) {
      await cliente.query('COMMIT'); transaccion = false;
      if (!coincideFoto(existente.rows[0], identificador, nombre)) {
        return res.status(409).json({ mensaje: 'La clave de fotografía ya fue utilizada' });
      }
      return res.status(200).json({ foto: existente.rows[0], reutilizada: true });
    }
    const conteo = await cliente.query(
      'SELECT COUNT(*)::integer AS total FROM reporte_fotos WHERE id_reporte = $1',
      [idReporte]
    );
    if (conteo.rows[0].total >= 5) {
      await cliente.query('ROLLBACK'); transaccion = false;
      return res.status(409).json({ mensaje: 'El reporte ya tiene cinco fotografías' });
    }
    const insertada = await cliente.query(
      `INSERT INTO reporte_fotos
         (id_reporte, url_foto, nombre_archivo, clave_idempotencia)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_reporte, clave_idempotencia)
         WHERE clave_idempotencia IS NOT NULL DO NOTHING
       RETURNING *`,
      [idReporte, imagen.secure_url, nombre, clave]
    );
    await cliente.query('COMMIT'); transaccion = false;
    if (!insertada.rows.length) {
      // Normalmente el bloqueo del reporte impide llegar aquí. Conservar el
      // recurso estable en Cloudinary para recuperar el resultado al reintentar.
      return res.status(503).json({ mensaje: 'Reintenta la fotografía' });
    }
    return res.status(201).json({ foto: insertada.rows[0], reutilizada: false });
  } catch (_) {
    if (transaccion) {
      try { await cliente.query('ROLLBACK'); } catch (_) { /* fallo de conexión */ }
    }
    // No borrar el public_id estable: si Cloudinary confirmó y PostgreSQL
    // falló, el próximo intento recuperará el mismo recurso.
    return res.status(503).json({ mensaje: 'No se pudo confirmar la fotografía; reintenta' });
  } finally {
    if (cliente) cliente.release();
  }
};

module.exports = {
  subirFotoIdempotente, identificadorCloudinary, coincideFoto,
  subirORecuperar,
};
