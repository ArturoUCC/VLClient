const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');

const {
  obtenerMisReportes,
  crearReporte
} = require('../controllers/reportesController');

// Consultar los reportes del inquilino
router.get('/mis-reportes', verificarToken, obtenerMisReportes);

// La app solo habilita la cola cuando el backend soporta ambos pasos idempotentes.
router.get('/capacidades', verificarToken, (req, res) => res.json({
  idempotencia_reportes: true,
  idempotencia_fotos: true,
}));

// Registrar un reporte nuevo
router.post('/crear', verificarToken, crearReporte);

module.exports = router;
