const pool = require('../config/db');

const {
  crearNotificacionSegura,
} = require('../services/notificacionesService');

const ZONA_HORARIA = 'America/Mexico_City';

// OBTENER FECHA Y HORA ACTUAL EN MÉXICO
const obtenerFechaHoraActual = () => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const obtener = (tipo) =>
    partes.find((parte) => parte.type === tipo)?.value;

  return {
    fecha:
      `${obtener('year')}-${obtener('month')}-${obtener('day')}`,
    hora:
      `${obtener('hour')}:${obtener('minute')}`,
  };
};

// VALIDAR FORMATO Y EXISTENCIA DE LA FECHA
const fechaValida = (valor) => {
  if (typeof valor !== 'string') return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
};

// CONSULTAR CITAS DEL INQUILINO
const obtenerMisCitas = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT
         ci.id_cita,
         ci.id_reporte,
         r.titulo AS titulo_reporte,
         TO_CHAR(ci.fecha_cita, 'YYYY-MM-DD') AS fecha_cita,
         TO_CHAR(ci.hora_cita, 'HH24:MI') AS hora_cita,
         ci.estado,
         ci.observaciones,
         ci.fecha_registro
       FROM citas ci
       INNER JOIN reportes r
         ON ci.id_reporte = r.id_reporte
       INNER JOIN contratos c
         ON r.id_contrato = c.id_contrato
       WHERE c.id_inquilino = $1
       ORDER BY ci.fecha_cita DESC, ci.hora_cita DESC`,
      [req.usuario.id_inquilino]
    );

    return res.status(200).json({
      total_registros: resultado.rows.length,
      citas: resultado.rows,
    });

  } catch (error) {
    console.error(
      'Error al consultar citas:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'No se pudieron consultar las citas',
    });
  }
};

// CREAR CITA ASOCIADA A UN REPORTE
const crearCita = async (req, res) => {
  const idInquilino = req.usuario.id_inquilino;
  const idReporte = Number(req.body?.id_reporte);

  const {
    fecha_cita,
    hora_cita,
    observaciones = '',
  } = req.body || {};

  // VALIDAR IDENTIFICADOR DEL REPORTE
  if (
    !Number.isSafeInteger(idReporte) ||
    idReporte <= 0
  ) {
    return res.status(400).json({
      mensaje: 'Selecciona un reporte válido',
    });
  }

  // VALIDAR FECHA
  if (!fechaValida(fecha_cita)) {
    return res.status(400).json({
      mensaje: 'La fecha debe tener el formato AAAA-MM-DD',
    });
  }

  // VALIDAR FORMATO DE HORA
  if (
    typeof hora_cita !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_cita)
  ) {
    return res.status(400).json({
      mensaje: 'La hora debe tener el formato HH:MM',
    });
  }

  // VALIDAR OBSERVACIONES
  if (
    typeof observaciones !== 'string' ||
    observaciones.length > 500
  ) {
    return res.status(400).json({
      mensaje: 'Las observaciones no pueden superar 500 caracteres',
    });
  }

  // VALIDAR FECHA Y HORA ACTUAL
  const ahora = obtenerFechaHoraActual();

  if (fecha_cita < ahora.fecha) {
    return res.status(400).json({
      mensaje: 'No puedes programar citas en fechas anteriores',
    });
  }

  // HORARIO PROVISIONAL DE MANTENIMIENTO
  if (
    hora_cita < '09:00' ||
    hora_cita > '17:00'
  ) {
    return res.status(400).json({
      mensaje: 'Selecciona un horario entre las 09:00 y las 17:00',
    });
  }

  // IMPEDIR HORAS PASADAS PARA EL DÍA ACTUAL
  if (
    fecha_cita === ahora.fecha &&
    hora_cita <= ahora.hora
  ) {
    return res.status(400).json({
      mensaje: 'No puedes solicitar una cita en un horario que ya pasó',
    });
  }

  try {
    // COMPROBAR QUE EL REPORTE PERTENECE AL INQUILINO
    const reporte = await pool.query(
      `SELECT r.id_reporte
       FROM reportes r
       INNER JOIN contratos c
         ON r.id_contrato = c.id_contrato
       WHERE r.id_reporte = $1
         AND c.id_inquilino = $2
         AND r.estado <> 'resuelto'`,
      [
        idReporte,
        idInquilino,
      ]
    );

    if (reporte.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró un reporte pendiente válido',
      });
    }

    // IMPEDIR UNA SEGUNDA CITA ACTIVA PARA EL MISMO REPORTE
    const citaExistente = await pool.query(
      `SELECT id_cita
       FROM citas
       WHERE id_reporte = $1
         AND estado IN ('programada', 'confirmada')
       LIMIT 1`,
      [idReporte]
    );

    if (citaExistente.rows.length > 0) {
      return res.status(409).json({
        mensaje: 'Este reporte ya tiene una cita activa',
      });
    }

    // GUARDAR LA CITA EN NEON
    const resultado = await pool.query(
      `INSERT INTO citas (
        id_reporte,
        fecha_cita,
        hora_cita,
        estado,
        observaciones
      )
      VALUES ($1, $2, $3, 'programada', $4)
      RETURNING
        id_cita,
        id_reporte,
        TO_CHAR(fecha_cita, 'YYYY-MM-DD') AS fecha_cita,
        TO_CHAR(hora_cita, 'HH24:MI') AS hora_cita,
        estado,
        observaciones`,
      [
        idReporte,
        fecha_cita,
        hora_cita,
        observaciones.trim(),
      ]
    );

    const citaCreada = resultado.rows[0];

    // GENERAR NOTIFICACIÓN AUTOMÁTICA
    // La cita ya quedó almacenada en Neon.
    await crearNotificacionSegura({
      idInquilino,
      titulo: 'Cita de mantenimiento solicitada',
      mensaje:
        `Tu solicitud de cita #${citaCreada.id_cita} ` +
        `para el reporte #${idReporte} fue registrada ` +
        `para el ${fecha_cita} a las ${hora_cita}. ` +
        'La visita está pendiente de confirmación.',
      tipo: 'cita',
    });

    // RESPONDER A REACT NATIVE
    return res.status(201).json({
      mensaje: 'Solicitud de cita registrada correctamente',
      cita: citaCreada,
    });

  } catch (error) {

    // HORARIO OCUPADO
    if (error.code === '23505') {
      return res.status(409).json({
        mensaje: 'El horario seleccionado ya está ocupado',
      });
    }

    console.error(
      'Error al crear cita:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'No se pudo registrar la cita',
    });
  }
};

module.exports = {
  obtenerMisCitas,
  crearCita,
};
