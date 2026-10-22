const express = require('express');
const router = express.Router();

const {
  verificarToken
} = require('../middleware/authMiddleware');

const {
  obtenerMiEstadoCuenta
} = require('../controllers/estadosCuentaController');

router.get('/mi-cuenta', verificarToken, obtenerMiEstadoCuenta);

module.exports = router;
