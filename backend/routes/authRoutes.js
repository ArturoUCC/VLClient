const express = require('express');
const router = express.Router();

const {
  iniciarSesion,
  solicitarRecuperacion,
  restablecerPassword
} = require('../controllers/authController');

router.post('/login', iniciarSesion);
router.post('/solicitar-recuperacion', solicitarRecuperacion);
router.post('/restablecer-password', restablecerPassword);

module.exports = router;
