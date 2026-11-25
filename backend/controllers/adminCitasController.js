const pool = require('../config/db');
const { fechaValida } = require('./disponibilidadController');

const listarCitas = async (req, res) => {
  const pagina = Number(req.query.pagina || 1);
  const limite = Number(req.query.limite || 20);
  const idInquilino = req.query.id_inquilino ? Number(req.query.id_inquilino) : null;
  const idPropiedad = req.query.id_propiedad ? Number(req.query.id_propiedad) : null;
  const estados = ['programada', 'confirmada', 'completada', 'cancelada'];
  const reagendados = ['sin_solicitud', 'solicitado', 'utilizado'];
  if (!Number.isSafeInteger(pagina) || pagina < 1 ||
      !Number.isSafeInteger(limite) || limite < 1 || limite > 50 ||
      idInquilino !== null && (!Number.isSafeInteger(idInquilino) || idInquilino <= 0) ||
      idPropiedad !== null && (!Number.isSafeInteger(idPropiedad) || idPropiedad <= 0) ||
      req.query.estado && !estados.includes(req.query.estado) ||
      req.query.reagendado_estado && !reagendados.includes(req.query.reagendado_estado) ||
      req.query.fecha && !fechaValida(req.query.fecha)) {
    return res.status(400).json({ mensaje: 'Filtros inválidos' });
  }
  try {
    const resultado = await pool.query(
      `SELECT ci.id_cita, ci.id_reporte,
              TO_CHAR(ci.fecha_cita,'YYYY-MM-DD') AS fecha_cita,
              TO_CHAR(ci.hora_cita,'HH24:MI') AS hora_cita,
              ci.estado, ci.reagendado_estado,
              ci.segundo_horario_no_disponible_at,
              i.id_inquilino, i.nombre, i.apellido,
              p.id_propiedad, p.nombre AS propiedad,
              COUNT(*) OVER()::integer AS total
       FROM citas ci JOIN reportes r ON r.id_reporte=ci.id_reporte
       JOIN contratos c ON c.id_contrato=r.id_contrato
       JOIN inquilinos i ON i.id_inquilino=c.id_inquilino
       JOIN propiedades p ON p.id_propiedad=c.id_propiedad
       WHERE ($1::int IS NULL OR i.id_inquilino=$1)
         AND ($2::int IS NULL OR p.id_propiedad=$2)
         AND ($3::date IS NULL OR ci.fecha_cita=$3)
         AND ($4::text IS NULL OR ci.estado=$4)
         AND ($5::text IS NULL OR ci.reagendado_estado=$5)
       ORDER BY ci.fecha_cita DESC, ci.hora_cita DESC, ci.id_cita DESC
       LIMIT $6 OFFSET $7`, [idInquilino, idPropiedad,
        req.query.fecha || null, req.query.estado || null,
        req.query.reagendado_estado || null, limite, (pagina - 1) * limite]);
    return res.json({ total: resultado.rows[0]?.total || 0,
      citas: resultado.rows.map(({ total, ...fila }) => fila) });
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudieron consultar las citas' });
  }
};

const ejecutarAccion = async (req, res) => {
  const idCita = Number(req.params.idCita);
  const accion = req.params.accion;
  if (!Number.isSafeInteger(idCita) || idCita <= 0 ||
      !['confirmar', 'solicitar-reagendado', 'segundo-horario-no-disponible'].includes(accion)) {
    return res.status(400).json({ mensaje: 'Acción o cita inválida' });
  }
  let client;
  let transaccion = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const resultado = await client.query(
      `SELECT ci.id_cita, ci.id_reporte, ci.estado, ci.reagendado_estado,
              ci.reagendado_usado_at, ci.segundo_horario_no_disponible_at,
              TO_CHAR(ci.fecha_cita,'YYYY-MM-DD') AS fecha_cita,
              TO_CHAR(ci.hora_cita,'HH24:MI') AS hora_cita,
              c.id_inquilino
       FROM citas ci JOIN reportes r ON r.id_reporte=ci.id_reporte
       JOIN contratos c ON c.id_contrato=r.id_contrato
       WHERE ci.id_cita=$1 FOR UPDATE OF ci`, [idCita]);
    const cita = resultado.rows[0];
    if (!cita) {
      await client.query('ROLLBACK'); transaccion = false;
      return res.status(404).json({ mensaje: 'Cita no encontrada' });
    }
    let titulo, mensaje, accionTipo = null, idCitaAviso = null;
    if (accion === 'confirmar') {
      if (cita.estado !== 'programada' || cita.reagendado_estado === 'solicitado' ||
          cita.segundo_horario_no_disponible_at) {
        await client.query('ROLLBACK'); transaccion = false;
        return res.status(409).json({ mensaje: 'Esta cita no puede confirmarse' });
      }
      await client.query(`UPDATE citas SET estado='confirmada' WHERE id_cita=$1`, [idCita]);
      titulo = 'Cita de mantenimiento confirmada';
      mensaje = `Tu cita #${idCita} para el reporte #${cita.id_reporte} fue confirmada ` +
        `para el ${cita.fecha_cita} a las ${cita.hora_cita}.`;
    } else if (accion === 'solicitar-reagendado') {
      if (!['programada', 'confirmada'].includes(cita.estado) ||
          cita.reagendado_estado !== 'sin_solicitud' || cita.reagendado_usado_at) {
        await client.query('ROLLBACK'); transaccion = false;
        return res.status(409).json({ mensaje: 'Esta cita no admite otra solicitud' });
      }
      await client.query(
        `UPDATE citas SET reagendado_estado='solicitado',
         reagendado_solicitado_at=NOW() WHERE id_cita=$1`, [idCita]);
      titulo = 'Reagenda tu cita de mantenimiento';
      mensaje = `La fecha u hora de tu cita #${idCita} para el reporte #${cita.id_reporte} ` +
        `(${cita.fecha_cita} a las ${cita.hora_cita}) no está disponible. ` +
        'Puedes elegir un nuevo horario una sola vez.';
      accionTipo = 'reagendar_cita';
      idCitaAviso = idCita;
    } else {
      if (cita.estado !== 'programada' || cita.reagendado_estado !== 'utilizado' ||
          !cita.reagendado_usado_at || cita.segundo_horario_no_disponible_at) {
        await client.query('ROLLBACK'); transaccion = false;
        return res.status(409).json({ mensaje: 'Esta cita no admite el aviso' });
      }
      await client.query(
        `UPDATE citas SET segundo_horario_no_disponible_at=NOW()
         WHERE id_cita=$1`, [idCita]);
      titulo = 'Horario de cita no disponible';
      mensaje = `El nuevo horario de tu cita #${idCita} (${cita.fecha_cita} ` +
        `a las ${cita.hora_cita}) tampoco está disponible. ` +
        'La inmobiliaria se pondrá en contacto contigo para resolver el horario.';
    }
    const aviso = await client.query(
      `INSERT INTO notificaciones
       (id_inquilino,titulo,mensaje,tipo,accion_tipo,id_cita)
       VALUES($1,$2,$3,'cita',$4,$5) RETURNING id_notificacion`,
      [cita.id_inquilino, titulo, mensaje, accionTipo, idCitaAviso]);
    await client.query(
      `INSERT INTO bitacora_administrativa
       (id_administrador,accion,entidad,entidad_id,detalles)
       VALUES($1,$2,'citas',$3,$4::jsonb)`,
      [req.administrador.id_administrador, accion, idCita,
        JSON.stringify({ id_notificacion: aviso.rows[0].id_notificacion })]);
    await client.query('COMMIT'); transaccion = false;
    return res.json({ id_cita: idCita, accion,
      id_notificacion: aviso.rows[0].id_notificacion });
  } catch (_) {
    if (transaccion) {
      try { await client.query('ROLLBACK'); } catch (_) { /* error original */ }
    }
    return res.status(503).json({ mensaje: 'No se pudo actualizar la cita' });
  } finally { if (client) client.release(); }
};

module.exports = { listarCitas, ejecutarAccion };
