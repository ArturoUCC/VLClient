const pool = require('../config/db');

const fechaValida = (valor) => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d;
};
const horaValida = (hora) => typeof hora === 'string' &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) &&
  hora >= '08:00' && hora <= '18:00';

const consultarDisponibilidad = async (req, res) => {
  const fecha = req.query.fecha;
  const mes = req.query.mes;
  if (fecha && !fechaValida(fecha) ||
      mes && (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) ||
      (!fecha && !mes)) {
    return res.status(400).json({ mensaje: 'Fecha o mes inválido' });
  }
  try {
    const admin = Boolean(req.administrador);
    const resultado = await pool.query(
      `SELECT TO_CHAR(h.fecha, 'YYYY-MM-DD') AS fecha,
              TO_CHAR(h.hora, 'HH24:MI') AS hora,
              f.habilitada AS fecha_habilitada, h.habilitado AS horario_habilitado,
              (r.id_cita IS NOT NULL) AS ocupado,
              CASE WHEN f.habilitada AND h.habilitado AND r.id_cita IS NULL
                   THEN TRUE ELSE FALSE END AS disponible
              ${admin ? `, ci.id_cita, ci.estado AS estado_cita,
                i.id_inquilino, i.nombre AS nombre_inquilino,
                i.apellido AS apellido_inquilino` : ''}
       FROM horarios_citas h JOIN fechas_citas f ON f.fecha = h.fecha
       LEFT JOIN reservas_citas r ON r.id_horario = h.id_horario
       ${admin ? `LEFT JOIN citas ci ON ci.id_cita=r.id_cita
         LEFT JOIN reportes re ON re.id_reporte=ci.id_reporte
         LEFT JOIN contratos c ON c.id_contrato=re.id_contrato
         LEFT JOIN inquilinos i ON i.id_inquilino=c.id_inquilino` : ''}
       WHERE ($1::date IS NULL OR h.fecha = $1::date)
         AND ($2::text IS NULL OR TO_CHAR(h.fecha, 'YYYY-MM') = $2)
       ORDER BY h.fecha, h.hora`, [fecha || null, mes || null]);
    return res.json({ horarios: resultado.rows });
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudo consultar la disponibilidad' });
  }
};

const cambiarFecha = async (req, res) => {
  const { fecha } = req.params;
  const habilitada = req.body?.habilitada;
  if (!fechaValida(fecha) || typeof habilitada !== 'boolean') {
    return res.status(400).json({ mensaje: 'Fecha o estado inválido' });
  }
  const cliente = await pool.connect().catch(() => null);
  if (!cliente) return res.status(503).json({ mensaje: 'Servicio temporalmente no disponible' });
  try {
    await cliente.query('BEGIN');
    const fechaActual = await cliente.query(
      `INSERT INTO fechas_citas(fecha, habilitada) VALUES($1, FALSE)
       ON CONFLICT(fecha) DO UPDATE SET fecha=EXCLUDED.fecha
       RETURNING fecha`, [fecha]);
    if (!habilitada) {
      const ocupada = await cliente.query(
        `SELECT 1 FROM reservas_citas r JOIN horarios_citas h
           ON h.id_horario=r.id_horario WHERE h.fecha=$1 LIMIT 1`, [fecha]);
      if (ocupada.rows.length) {
        await cliente.query('ROLLBACK');
        return res.status(409).json({ mensaje: 'La fecha tiene citas reservadas' });
      }
    }
    await cliente.query('UPDATE fechas_citas SET habilitada=$1 WHERE fecha=$2',
      [habilitada, fecha]);
    await cliente.query(
      `INSERT INTO bitacora_administrativa(id_administrador,accion,entidad,detalles)
       VALUES($1,'cambiar_fecha','fechas_citas',$2::jsonb)`, [
        req.administrador.id_administrador, JSON.stringify({ fecha, habilitada }),
      ]);
    await cliente.query('COMMIT');
    return res.json({ fecha: fechaActual.rows[0].fecha, habilitada });
  } catch (_) {
    await cliente.query('ROLLBACK');
    return res.status(503).json({ mensaje: 'No se pudo cambiar la fecha' });
  } finally { cliente.release(); }
};

const cambiarHorario = async (req, res) => {
  const { fecha, hora } = req.params;
  const habilitado = req.body?.habilitado;
  if (!fechaValida(fecha) || !horaValida(hora) || typeof habilitado !== 'boolean') {
    return res.status(400).json({ mensaje: 'Horario o estado inválido' });
  }
  const cliente = await pool.connect().catch(() => null);
  if (!cliente) return res.status(503).json({ mensaje: 'Servicio temporalmente no disponible' });
  try {
    await cliente.query('BEGIN');
    const fechaActual = await cliente.query(
      `SELECT habilitada FROM fechas_citas WHERE fecha=$1 FOR UPDATE`, [fecha]);
    if (!fechaActual.rows.length || !fechaActual.rows[0].habilitada) {
      await cliente.query('ROLLBACK');
      return res.status(409).json({ mensaje: 'Primero habilita la fecha' });
    }
    const horario = await cliente.query(
      `INSERT INTO horarios_citas(fecha,hora,habilitado)
       VALUES($1,$2,FALSE) ON CONFLICT(fecha,hora)
       DO UPDATE SET fecha=EXCLUDED.fecha
       RETURNING id_horario`, [fecha, hora]);
    if (!habilitado) {
      const ocupada = await cliente.query(
        `SELECT 1 FROM reservas_citas WHERE id_horario=$1`,
        [horario.rows[0].id_horario]);
      if (ocupada.rows.length) {
        await cliente.query('ROLLBACK');
        return res.status(409).json({ mensaje: 'El horario tiene una cita reservada' });
      }
    }
    await cliente.query('UPDATE horarios_citas SET habilitado=$1 WHERE id_horario=$2',
      [habilitado, horario.rows[0].id_horario]);
    await cliente.query(
      `INSERT INTO bitacora_administrativa(id_administrador,accion,entidad,entidad_id,detalles)
       VALUES($1,'cambiar_horario','horarios_citas',$2,$3::jsonb)`, [
        req.administrador.id_administrador, horario.rows[0].id_horario,
        JSON.stringify({ fecha, hora, habilitado }),
      ]);
    await cliente.query('COMMIT');
    return res.json({ fecha, hora, habilitado });
  } catch (_) {
    await cliente.query('ROLLBACK');
    return res.status(503).json({ mensaje: 'No se pudo cambiar el horario' });
  } finally { cliente.release(); }
};

module.exports = { consultarDisponibilidad, cambiarFecha, cambiarHorario,
  fechaValida, horaValida };
