const pool = require('../config/db');

const obtenerMiPerfil = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const resultado = await pool.query(
      `SELECT
        i.id_inquilino,
        i.nombre,
        i.apellido,
        i.correo,
        i.telefono,
        i.recordatorio_renta_dias,
        c.id_contrato,
        c.fecha_inicio,
        c.fecha_fin,
        c.estado AS estado_contrato,
        p.nombre AS propiedad,
        p.direccion,
        p.edificio,
        p.numero_departamento
      FROM inquilinos i
      LEFT JOIN LATERAL (
        SELECT *
        FROM contratos
        WHERE id_inquilino = i.id_inquilino
          AND estado = 'activo'
          AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin
        ORDER BY fecha_inicio DESC
        LIMIT 1
      ) c ON TRUE
      LEFT JOIN propiedades p
        ON c.id_propiedad = p.id_propiedad
      WHERE i.id_inquilino = $1
        AND i.activo = TRUE`,
      [idInquilino]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró el perfil del inquilino'
      });
    }

    return res.json(resultado.rows[0]);

  } catch (error) {
    console.error('Error al consultar perfil:', error.message);

    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

const actualizarRecordatorioRenta = async (req, res) => {
  const datos = req.body;
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) ||
      Object.keys(datos).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(datos, 'recordatorio_renta_dias') ||
      !Number.isInteger(datos.recordatorio_renta_dias) ||
      datos.recordatorio_renta_dias < 1 || datos.recordatorio_renta_dias > 31) {
    return res.status(400).json({
      mensaje: 'Selecciona un número entero de días entre 1 y 31',
    });
  }

  try {
    const resultado = await pool.query(
      `UPDATE inquilinos
       SET recordatorio_renta_dias = $1
       WHERE id_inquilino = $2 AND activo = TRUE
       RETURNING recordatorio_renta_dias`,
      [datos.recordatorio_renta_dias, req.usuario.id_inquilino]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Inquilino no encontrado' });
    }
    return res.status(200).json({
      mensaje: 'Anticipación del recordatorio actualizada',
      recordatorio_renta_dias: resultado.rows[0].recordatorio_renta_dias,
    });
  } catch (error) {
    console.error('Error al actualizar recordatorio de renta:', error.message);
    return res.status(500).json({ mensaje: 'No se pudo guardar la preferencia' });
  }
};

module.exports = { obtenerMiPerfil, actualizarRecordatorioRenta };
