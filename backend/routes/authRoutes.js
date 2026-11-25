const express = require('express');
const router = express.Router();
const { bloquearExternosPruebas } = require('../middleware/bloquearExternosPruebas');
const { iniciarSesionUnificada } = require('../controllers/loginUnificadoController');

const {
  solicitarRecuperacion,
  restablecerPassword
} = require('../controllers/authController');

router.post('/login', iniciarSesionUnificada);
router.post('/solicitar-recuperacion', bloquearExternosPruebas, solicitarRecuperacion);
router.post('/restablecer-password', restablecerPassword);

module.exports = router;
