const pool = require('../config/db');

// OBTENER TODAS LAS NOTIFICACIONES DEL INQUILINO
const obtenerMisNotificaciones = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const resultado = await pool.query(
      `SELECT
        id_notificacion,
        titulo,
        mensaje,
        tipo,
        leida,
        fecha_creacion,
        fecha_lectura
       FROM notificaciones
       WHERE id_inquilino = $1
       ORDER BY fecha_creacion DESC, id_notificacion DESC`,
      [idInquilino]
    );

    const noLeidas = resultado.rows.filter(
      (notificacion) => !notificacion.leida
    ).length;

    return res.status(200).json({
      mensaje: 'Notificaciones consultadas correctamente',
      total: resultado.rows.length,
      no_leidas: noLeidas,
      notificaciones: resultado.rows,
    });

  } catch (error) {
    console.error(
      'Error al obtener notificaciones:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'No se pudieron obtener las notificaciones',
    });
  }
};

// MARCAR UNA NOTIFICACIÓN COMO LEÍDA
const marcarComoLeida = async (req, res) => {
  const idNotificacion = Number(req.params.idNotificacion);
  const idInquilino = req.usuario.id_inquilino;

  if (
    !Number.isSafeInteger(idNotificacion) ||
    idNotificacion <= 0
  ) {
    return res.status(400).json({
      mensaje: 'Identificador de notificación inválido',
    });
  }

  try {
    const resultado = await pool.query(
      `UPDATE notificaciones
       SET
         leida = true,
         fecha_lectura = COALESCE(
           fecha_lectura,
           CURRENT_TIMESTAMP
         )
       WHERE id_notificacion = $1
         AND id_inquilino = $2
       RETURNING
         id_notificacion,
         titulo,
         mensaje,
         tipo,
         leida,
         fecha_creacion,
         fecha_lectura`,
      [idNotificacion, idInquilino]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'Notificación no encontrada',
      });
    }

    return res.status(200).json({
      mensaje: 'Notificación marcada como leída',
      notificacion: resultado.rows[0],
    });

  } catch (error) {
    console.error(
      'Error al marcar notificación:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'No se pudo actualizar la notificación',
    });
  }
};

// MARCAR TODAS LAS NOTIFICACIONES COMO LEÍDAS
const marcarTodasComoLeidas = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const resultado = await pool.query(
      `UPDATE notificaciones
       SET
         leida = true,
         fecha_lectura = COALESCE(
           fecha_lectura,
           CURRENT_TIMESTAMP
         )
       WHERE id_inquilino = $1
         AND leida = false
       RETURNING id_notificacion`,
      [idInquilino]
    );

    return res.status(200).json({
      mensaje: 'Notificaciones marcadas como leídas',
      actualizadas: resultado.rowCount,
    });

  } catch (error) {
    console.error(
      'Error al marcar todas las notificaciones:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'No se pudieron actualizar las notificaciones',
    });
  }
};

module.exports = {
  obtenerMisNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
};
