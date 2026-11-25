const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');

const {
  obtenerMisReportes,
  obtenerMisReportesResumen,
  crearReporte
} = require('../controllers/reportesController');

// Consultar los reportes del inquilino
router.get('/mis-reportes', verificarToken, obtenerMisReportes);
router.get('/mis-reportes-resumen', verificarToken, obtenerMisReportesResumen);

// La app solo habilita la cola cuando el backend soporta ambos pasos idempotentes.
router.get('/capacidades', verificarToken, (req, res) => res.json({
  idempotencia_reportes: true,
  idempotencia_fotos: process.env.VLCLIENT_TEST_MODE !== '1',
}));

// Registrar un reporte nuevo
router.post('/crear', verificarToken, crearReporte);

module.exports = router;
