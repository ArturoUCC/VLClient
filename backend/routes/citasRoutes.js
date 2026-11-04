const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');

const {
  obtenerMisCitas,
  crearCita,
} = require('../controllers/citasController');

// Consultar mis citas
router.get('/mis-citas', verificarToken, obtenerMisCitas);

// Registrar nueva solicitud de cita
router.post('/crear', verificarToken, crearCita);

module.exports = router;
