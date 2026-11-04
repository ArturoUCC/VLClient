const pool = require('../config/db');

// Consultar reportes del inquilino autenticado
const obtenerMisReportes = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const resultado = await pool.query(
      `SELECT r.*
       FROM reportes r
       INNER JOIN contratos c
         ON r.id_contrato = c.id_contrato
       WHERE c.id_inquilino = $1
       ORDER BY r.fecha_reporte DESC, r.id_reporte DESC`,
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

// Crear un nuevo reporte de mantenimiento
const crearReporte = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const { titulo, descripcion, categoria } = req.body || {};

    // Validar título y descripción
    if (
      typeof titulo !== 'string' ||
      typeof descripcion !== 'string' ||
      typeof categoria !== 'string' ||
      !titulo.trim() ||
      !descripcion.trim()
    ) {
      return res.status(400).json({
        mensaje: 'Título, descripción y categoría son obligatorios'
      });
    }

    const tituloLimpio = titulo.trim();
    const descripcionLimpia = descripcion.trim();

    if (tituloLimpio.length > 150 || descripcionLimpia.length > 2000) {
      return res.status(400).json({
        mensaje: 'El título o la descripción supera la longitud permitida'
      });
    }

    // Categorías permitidas por Neon Tech
    const categoriasPermitidas = [
      'plomeria',
      'electricidad',
      'estructura',
      'electrodomesticos',
      'limpieza',
      'otro'
    ];

    if (!categoriasPermitidas.includes(categoria)) {
      return res.status(400).json({
        mensaje: 'La categoría seleccionada no es válida'
      });
    }

    // Asociar el reporte al contrato vigente del usuario.
    // El cliente no puede elegir el id_contrato.
    const resultado = await pool.query(
      `INSERT INTO reportes (
        id_contrato,
        titulo,
        descripcion,
        categoria,
        prioridad,
        estado
      )
      SELECT
        c.id_contrato,
        $2,
        $3,
        $4,
        'media',
        'pendiente'
      FROM contratos c
      WHERE c.id_inquilino = $1
        AND c.estado = 'activo'
        AND CURRENT_DATE BETWEEN c.fecha_inicio AND c.fecha_fin
      ORDER BY c.fecha_inicio DESC
      LIMIT 1
      RETURNING *`,
      [
        idInquilino,
        tituloLimpio,
        descripcionLimpia,
        categoria
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró un contrato activo'
      });
    }

    return res.status(201).json({
      mensaje: 'Reporte registrado correctamente',
      reporte: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al crear reporte:', error.message);

    return res.status(500).json({
      mensaje: 'No se pudo registrar el reporte'
    });
  }
};

module.exports = {
  obtenerMisReportes,
  crearReporte
};
