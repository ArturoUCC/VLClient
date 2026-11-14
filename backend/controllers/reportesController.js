const pool = require('../config/db');
const { claveValida } = require('../utils/idempotencia');

const {
  crearNotificacionSegura,
} = require('../services/notificacionesService');

// CONSULTAR REPORTES DEL INQUILINO AUTENTICADO
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
      reportes: resultado.rows,
    });

  } catch (error) {
    console.error(
      'Error al consultar reportes:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'No se pudieron consultar los reportes',
    });
  }
};

// CREAR UN NUEVO REPORTE DE MANTENIMIENTO
const crearReporte = async (req, res) => {
  try {
    const idInquilino = req.usuario.id_inquilino;

    const {
      titulo,
      descripcion,
      categoria,
      clave_idempotencia: claveIdempotencia,
    } = req.body || {};

    if (claveIdempotencia !== undefined && !claveValida(claveIdempotencia)) {
      return res.status(400).json({ mensaje: 'Clave de solicitud inválida' });
    }

    // VALIDAR CAMPOS OBLIGATORIOS
    if (
      typeof titulo !== 'string' ||
      typeof descripcion !== 'string' ||
      typeof categoria !== 'string' ||
      !titulo.trim() ||
      !descripcion.trim()
    ) {
      return res.status(400).json({
        mensaje: 'Título, descripción y categoría son obligatorios',
      });
    }

    const tituloLimpio = titulo.trim();
    const descripcionLimpia = descripcion.trim();

    // VALIDAR LONGITUD DE TEXTOS
    if (
      tituloLimpio.length > 150 ||
      descripcionLimpia.length > 2000
    ) {
      return res.status(400).json({
        mensaje: 'El título o la descripción supera la longitud permitida',
      });
    }

    // CATEGORÍAS PERMITIDAS POR NEON TECH
    const categoriasPermitidas = [
      'plomeria',
      'electricidad',
      'estructura',
      'electrodomesticos',
      'limpieza',
      'otro',
    ];

    if (!categoriasPermitidas.includes(categoria)) {
      return res.status(400).json({
        mensaje: 'La categoría seleccionada no es válida',
      });
    }

    // ASOCIAR EL REPORTE AL CONTRATO ACTIVO
    const resultado = await pool.query(
      `INSERT INTO reportes (
        id_contrato,
        titulo,
        descripcion,
        categoria,
        prioridad,
        estado,
        clave_idempotencia
      )
      SELECT
        c.id_contrato,
        $2,
        $3,
        $4,
        'media',
        'pendiente',
        $5
      FROM contratos c
      WHERE c.id_inquilino = $1
        AND c.estado = 'activo'
        AND (NOW() AT TIME ZONE 'America/Mexico_City')::date
            BETWEEN c.fecha_inicio AND c.fecha_fin
      ORDER BY c.fecha_inicio DESC
      LIMIT 1
      ON CONFLICT (clave_idempotencia)
        WHERE clave_idempotencia IS NOT NULL DO NOTHING
      RETURNING *`,
      [
        idInquilino,
        tituloLimpio,
        descripcionLimpia,
        categoria,
        claveIdempotencia || null,
      ]
    );

    // Un reintento espera al INSERT concurrente por el índice único y
    // consulta el resultado ya confirmado, sin crear otra notificación.
    if (resultado.rows.length === 0) {
      if (claveIdempotencia) {
        const existente = await pool.query(
          `SELECT r.*, c.id_inquilino AS propietario
           FROM reportes r
           JOIN contratos c ON c.id_contrato = r.id_contrato
           WHERE r.clave_idempotencia = $1`, [claveIdempotencia]
        );
        const previo = existente.rows[0];
        if (previo) {
          if (Number(previo.propietario) !== Number(idInquilino) ||
              previo.titulo !== tituloLimpio ||
              previo.descripcion !== descripcionLimpia ||
              previo.categoria !== categoria) {
            return res.status(409).json({ mensaje: 'La solicitud ya fue utilizada con otros datos' });
          }
          delete previo.propietario;
          return res.status(200).json({
            mensaje: 'Reporte ya registrado', reporte: previo, reutilizado: true,
          });
        }
      }
      return res.status(404).json({
        mensaje: 'No se encontró un contrato activo',
      });
    }

    const reporteCreado = resultado.rows[0];

    // GENERAR NOTIFICACIÓN AUTOMÁTICA
    // El reporte ya está guardado en Neon.
    // Si falla la notificación, no se elimina el reporte.
    await crearNotificacionSegura({
      idInquilino,
      titulo: 'Reporte de mantenimiento registrado',
      mensaje:
        `Tu reporte #${reporteCreado.id_reporte} ` +
        `"${reporteCreado.titulo}" fue registrado ` +
        'correctamente. Puedes consultar su estado en VLClient.',
      tipo: 'reporte',
    });

    // RESPUESTA AL CLIENTE
    return res.status(201).json({
      mensaje: 'Reporte registrado correctamente',
      reporte: reporteCreado,
    });

  } catch (error) {
    console.error(
      'Error al crear reporte:',
      error.message
    );

    return res.status(500).json({
      mensaje: 'No se pudo registrar el reporte',
    });
  }
};

module.exports = {
  obtenerMisReportes,
  crearReporte,
};
