const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');
const { obtenerMisReportes } = require('../controllers/reportesController');

router.get('/mis-reportes', verificarToken, obtenerMisReportes);

module.exports = router;
