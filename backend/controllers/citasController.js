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
         ci.reagendado_estado,
         ci.reagendado_solicitado_at,
         ci.reagendado_usado_at,
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

// REAGENDAR LA MISMA CITA UNA SOLA VEZ, TRAS LA SOLICITUD ADMINISTRATIVA
const reagendarCita = async (req, res) => {
  const idCita = Number(req.params.idCita);
  const idNotificacion = Number(req.body?.id_notificacion);
  const { fecha_cita, hora_cita } = req.body || {};

  if (!Number.isSafeInteger(idCita) || idCita <= 0 ||
      !Number.isSafeInteger(idNotificacion) || idNotificacion <= 0) {
    return res.status(400).json({ mensaje: 'Identificador de cita o notificación inválido' });
  }
  if (!fechaValida(fecha_cita)) {
    return res.status(400).json({ mensaje: 'La fecha debe tener el formato AAAA-MM-DD' });
  }
  if (typeof hora_cita !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_cita)) {
    return res.status(400).json({ mensaje: 'La hora debe tener el formato HH:MM' });
  }
  const ahora = obtenerFechaHoraActual();
  if (fecha_cita < ahora.fecha ||
      (fecha_cita === ahora.fecha && hora_cita <= ahora.hora)) {
    return res.status(400).json({ mensaje: 'Selecciona una fecha y hora futuras' });
  }
  if (hora_cita < '09:00' || hora_cita > '17:00') {
    return res.status(400).json({ mensaje: 'Selecciona un horario entre las 09:00 y las 17:00' });
  }

  let client;
  let transaccion = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;

    // El bloqueo serializa los intentos simultáneos sobre la misma cita.
    const resultado = await client.query(
      `SELECT ci.id_cita, ci.reagendado_estado, ci.reagendado_usado_at,
              ci.estado, TO_CHAR(ci.fecha_cita, 'YYYY-MM-DD') AS fecha_cita,
              TO_CHAR(ci.hora_cita, 'HH24:MI') AS hora_cita
       FROM citas ci
       JOIN reportes r ON r.id_reporte = ci.id_reporte
       JOIN contratos c ON c.id_contrato = r.id_contrato
       JOIN notificaciones n ON n.id_cita = ci.id_cita
       WHERE ci.id_cita = $1 AND c.id_inquilino = $2
         AND n.id_notificacion = $3 AND n.id_inquilino = $2
         AND n.accion_tipo = 'reagendar_cita'
       FOR UPDATE OF ci`,
      [idCita, req.usuario.id_inquilino, idNotificacion]
    );

    if (resultado.rows.length === 0) {
      await client.query('ROLLBACK');
      transaccion = false;
      return res.status(404).json({ mensaje: 'Solicitud de reagendado no encontrada' });
    }

    const cita = resultado.rows[0];
    if (cita.reagendado_estado !== 'solicitado' || cita.reagendado_usado_at ||
        !['programada', 'confirmada'].includes(cita.estado)) {
      await client.query('ROLLBACK');
      transaccion = false;
      return res.status(409).json({ mensaje: 'Esta solicitud de reagendado ya no está disponible' });
    }
    if (cita.fecha_cita === fecha_cita && cita.hora_cita === hora_cita) {
      await client.query('ROLLBACK');
      transaccion = false;
      return res.status(400).json({ mensaje: 'Selecciona una fecha u hora diferente' });
    }

    const actualizada = await client.query(
      `UPDATE citas
       SET fecha_cita = $1, hora_cita = $2, estado = 'programada',
           reagendado_estado = 'utilizado', reagendado_usado_at = NOW()
       WHERE id_cita = $3 AND reagendado_estado = 'solicitado'
         AND reagendado_usado_at IS NULL
       RETURNING id_cita, id_reporte,
         TO_CHAR(fecha_cita, 'YYYY-MM-DD') AS fecha_cita,
         TO_CHAR(hora_cita, 'HH24:MI') AS hora_cita,
         estado, reagendado_estado, reagendado_usado_at`,
      [fecha_cita, hora_cita, idCita]
    );
    if (actualizada.rows.length !== 1) {
      throw new Error('La cita cambió durante el reagendado');
    }

    // El aviso y la nueva fecha se confirman o revierten juntos.
    await client.query(
      `INSERT INTO notificaciones
         (id_inquilino, titulo, mensaje, tipo, accion_tipo, id_cita)
       VALUES ($1, $2, $3, 'cita', NULL, NULL)`,
      [
        req.usuario.id_inquilino,
        'Cita reagendada correctamente',
        `Tu cita #${idCita} fue reagendada para el ${fecha_cita} a las ${hora_cita}. ` +
          'El nuevo horario está pendiente de confirmación administrativa.',
      ]
    );

    await client.query('COMMIT');
    transaccion = false;
    return res.status(200).json({
      mensaje: 'Cita reagendada; pendiente de confirmación administrativa',
      cita: actualizada.rows[0],
    });
  } catch (error) {
    if (transaccion) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Error al revertir reagendado:', rollbackError.message);
      }
    }
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'El horario seleccionado ya está ocupado' });
    }
    console.error('Error al reagendar cita:', error.message);
    return res.status(500).json({ mensaje: 'No se pudo reagendar la cita' });
  } finally {
    if (client) client.release();
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
  reagendarCita,
};
