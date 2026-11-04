const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');

const {
  obtenerMisReportes,
  crearReporte
} = require('../controllers/reportesController');

// Consultar los reportes del inquilino
router.get('/mis-reportes', verificarToken, obtenerMisReportes);

// Registrar un reporte nuevo
router.post('/crear', verificarToken, crearReporte);

module.exports = router;
