const pool = require('../config/db');

// Crear una notificación para un inquilino
const crearNotificacion = async ({
  idInquilino,
  titulo,
  mensaje,
  tipo = 'general',
}) => {
  if (!idInquilino || !titulo || !mensaje) {
    throw new Error(
      'Faltan datos para crear la notificación'
    );
  }

  const resultado = await pool.query(
    `INSERT INTO notificaciones (
      id_inquilino,
      titulo,
      mensaje,
      tipo
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id_notificacion,
      id_inquilino,
      titulo,
      mensaje,
      tipo,
      leida,
      fecha_creacion`,
    [
      idInquilino,
      titulo,
      mensaje,
      tipo,
    ]
  );

  return resultado.rows[0];
};

const crearNotificacionSegura = async (datos) => {
  try {
    return await crearNotificacion(datos);
  } catch (error) {
    console.error(
      'No se pudo generar la notificación:',
      error.message
    );

    return null;
  }
};

module.exports = {
  crearNotificacion,
  crearNotificacionSegura,
};