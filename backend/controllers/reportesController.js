const pool = require('../config/db');

const obtenerMisReportes = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const resultado = await pool.query(
      `SELECT r.*
       FROM reportes r
       INNER JOIN contratos c
         ON r.id_contrato = c.id_contrato
       WHERE c.id_inquilino = $1
       ORDER BY r.id_reporte DESC`,
      [idInquilino]
    );

    return res.status(200).json({
      total_registros: resultado.rows.length,
      reportes: resultado.rows
    });

  } catch (error) {
    console.error('Error al consultar reportes:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudieron consultar los reportes'
    });
  }
};

module.exports = { obtenerMisReportes };
