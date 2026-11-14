const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const path = require('node:path');
const { imagenValida } = require('../utils/validarImagen');

// Subir una imagen a Cloudinary desde memoria
const subirImagen = (archivo, idReporte) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `vlclient/reportes/${idReporte}`,
        resource_type: 'image',
      },
      (error, resultado) => {
        if (error) return reject(error);
        resolve(resultado);
      }
    );

    stream.end(archivo.buffer);
  });
};

// Eliminar imágenes subidas si ocurre un error
const limpiarImagenes = async (imagenes) => {
  await Promise.allSettled(
    imagenes.map((imagen) =>
      cloudinary.uploader.destroy(imagen.public_id)
    )
  );
};

// Subir fotografías de un reporte
const subirFotosReporte = async (req, res) => {
  const idReporte = Number(req.params.idReporte);
  const idInquilino = req.usuario.id_inquilino;
  const archivos = req.files || [];

  if (!Number.isSafeInteger(idReporte) || idReporte <= 0) {
    return res.status(400).json({
      mensaje: 'Identificador de reporte inválido',
    });
  }

  if (archivos.length === 0 || archivos.length > 5) {
    return res.status(400).json({
      mensaje: 'Debes seleccionar entre 1 y 5 fotografías',
    });
  }

  if (archivos.some((archivo) => !imagenValida(archivo))) {
    return res.status(400).json({ mensaje: 'Una fotografía tiene un formato inválido' });
  }

  const imagenesSubidas = [];
  let cliente;

  try {
    // Verificar que el reporte pertenece al inquilino
    const reporte = await pool.query(
      `SELECT r.id_reporte
       FROM reportes r
       INNER JOIN contratos c
         ON r.id_contrato = c.id_contrato
       WHERE r.id_reporte = $1
         AND c.id_inquilino = $2`,
      [idReporte, idInquilino]
    );

    if (reporte.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Reporte no encontrado',
      });
    }

    // Subir archivos al almacenamiento
    for (const archivo of archivos) {
      const imagen = await subirImagen(archivo, idReporte);
      imagenesSubidas.push(imagen);
    }

    cliente = await pool.connect();
    await cliente.query('BEGIN');

    // Bloquear este reporte para respetar el límite
    // cuando se reciban solicitudes simultáneas
    await cliente.query(
      'SELECT id_reporte FROM reportes WHERE id_reporte = $1 FOR UPDATE',
      [idReporte]
    );

    const conteo = await cliente.query(
      `SELECT COUNT(*)::integer AS total
       FROM reporte_fotos
       WHERE id_reporte = $1`,
      [idReporte]
    );

    if (conteo.rows[0].total + archivos.length > 5) {
      await cliente.query('ROLLBACK');
      await limpiarImagenes(imagenesSubidas);

      return res.status(400).json({
        mensaje: 'El reporte no puede tener más de 5 fotografías',
      });
    }

    const fotosGuardadas = [];

    for (let i = 0; i < archivos.length; i++) {
      const resultado = await cliente.query(
        `INSERT INTO reporte_fotos (
          id_reporte,
          url_foto,
          nombre_archivo
        )
        VALUES ($1, $2, $3)
        RETURNING *`,
        [
          idReporte,
          imagenesSubidas[i].secure_url,
          path.basename(archivos[i].originalname || 'fotografia').slice(0, 150),
        ]
      );

      fotosGuardadas.push(resultado.rows[0]);
    }

    await cliente.query('COMMIT');

    return res.status(201).json({
      mensaje: 'Fotografías guardadas correctamente',
      fotos: fotosGuardadas,
    });

  } catch (error) {
    if (cliente) {
      try {
        await cliente.query('ROLLBACK');
      } catch (_) {}
    }

    await limpiarImagenes(imagenesSubidas);

    console.error('Error al guardar fotografías:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudieron guardar las fotografías',
    });

  } finally {
    if (cliente) cliente.release();
  }
};

// Consultar fotos del reporte autenticado
const obtenerFotosReporte = async (req, res) => {
  const idReporte = Number(req.params.idReporte);

  if (!Number.isSafeInteger(idReporte) || idReporte <= 0) {
    return res.status(400).json({
      mensaje: 'Identificador inválido',
    });
  }

  try {
    const resultado = await pool.query(
      `SELECT
         rf.id_foto,
         rf.id_reporte,
         rf.url_foto,
         rf.nombre_archivo,
         rf.fecha_subida
       FROM reporte_fotos rf
       INNER JOIN reportes r
         ON rf.id_reporte = r.id_reporte
       INNER JOIN contratos c
         ON r.id_contrato = c.id_contrato
       WHERE rf.id_reporte = $1
         AND c.id_inquilino = $2
       ORDER BY rf.id_foto ASC`,
      [idReporte, req.usuario.id_inquilino]
    );

    return res.json({
      fotos: resultado.rows,
    });

  } catch (error) {
    console.error('Error al consultar fotografías:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar las fotografías',
    });
  }
};

module.exports = {
  subirFotosReporte,
  obtenerFotosReporte,
};
