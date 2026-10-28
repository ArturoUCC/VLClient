const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');
const { obtenerMisPagos } = require('../controllers/pagosController');

router.get('/mis-pagos', verificarToken, obtenerMisPagos);

module.exports = router;
