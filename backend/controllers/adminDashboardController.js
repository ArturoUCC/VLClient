const pool = require('../config/db');

const resumen = async (_req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM inquilinos) AS inquilinos_total,
        (SELECT COUNT(*)::int FROM inquilinos WHERE activo=TRUE) AS inquilinos_activos,
        (SELECT COUNT(*)::int FROM inquilinos WHERE activo=FALSE) AS inquilinos_inactivos,
        (SELECT COUNT(DISTINCT id_propiedad)::int FROM contratos
          WHERE estado='activo') AS propiedades_contrato_activo,
        (SELECT COUNT(*)::int FROM reportes WHERE estado IN ('pendiente','en_proceso'))
          AS reportes_pendientes,
        (SELECT COUNT(*)::int FROM citas WHERE estado='programada') AS citas_pendientes,
        (SELECT COUNT(*)::int FROM citas WHERE estado='confirmada') AS citas_confirmadas,
        (SELECT COUNT(*)::int FROM citas
          WHERE estado IN ('programada','confirmada')
            AND fecha_cita BETWEEN (NOW() AT TIME ZONE 'America/Mexico_City')::date
            AND (NOW() AT TIME ZONE 'America/Mexico_City')::date + 7
            AND (fecha_cita > (NOW() AT TIME ZONE 'America/Mexico_City')::date
              OR hora_cita >= (NOW() AT TIME ZONE 'America/Mexico_City')::time))
          AS citas_proximas,
        (SELECT COUNT(*)::int FROM citas WHERE reagendado_estado='solicitado')
          AS solicitudes_reagendamiento`);
    return res.json({ resumen: resultado.rows[0] });
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudo consultar el resumen' });
  }
};

module.exports = { resumen };
