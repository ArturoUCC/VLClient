const pool = require('../config/db');

const obtenerMiEstadoCuenta = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const resultado = await pool.query(
      `SELECT
        ec.id_estado_cuenta,
        i.nombre,
        i.apellido,
        p.nombre AS propiedad,
        ec.mes,
        ec.renta_base,
        ec.servicios,
        ec.cargos_adicionales,
        ec.total,
        ec.fecha_limite,
        ec.estado
      FROM estados_de_cuenta ec
      INNER JOIN contratos c
        ON ec.id_contrato = c.id_contrato
      INNER JOIN inquilinos i
        ON c.id_inquilino = i.id_inquilino
      INNER JOIN propiedades p
        ON c.id_propiedad = p.id_propiedad
      WHERE i.id_inquilino = $1
        AND i.activo = TRUE
        AND c.estado = 'activo'
        AND CURRENT_DATE BETWEEN c.fecha_inicio AND c.fecha_fin
      ORDER BY ec.mes DESC
      LIMIT 1`,
      [idInquilino]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró un estado de cuenta'
      });
    }

    return res.json(resultado.rows[0]);

  } catch (error) {
    console.error('Error al consultar estado de cuenta:', error.message);

    return res.status(500).json({
      mensaje: 'Error interno del servidor'
    });
  }
};

module.exports = { obtenerMiEstadoCuenta };
