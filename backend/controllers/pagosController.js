const pool = require('../config/db');

const obtenerMisPagos = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const resultado = await pool.query(
      `SELECT
        p.id_pago,
        p.monto,
        p.fecha_pago,
        p.metodo_pago,
        p.referencia,
        p.observaciones,
        ec.mes,
        ec.total AS total_estado_cuenta,
        pr.nombre AS propiedad
      FROM pagos p
      INNER JOIN estados_de_cuenta ec
        ON p.id_estado_cuenta = ec.id_estado_cuenta
      INNER JOIN contratos c
        ON ec.id_contrato = c.id_contrato
      INNER JOIN propiedades pr
        ON c.id_propiedad = pr.id_propiedad
      WHERE c.id_inquilino = $1
      ORDER BY p.fecha_pago DESC, p.id_pago DESC`,
      [idInquilino]
    );

    return res.status(200).json({
      total_registros: resultado.rows.length,
      pagos: resultado.rows
    });

  } catch (error) {
    console.error('Error al consultar pagos:', error.message);

    return res.status(500).json({
      mensaje: 'Error al consultar el historial de pagos'
    });
  }
};

module.exports = { obtenerMisPagos };
