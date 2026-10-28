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

module.exports = { obtenerMiPerfil };
