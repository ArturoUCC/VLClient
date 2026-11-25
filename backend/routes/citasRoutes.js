const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');
const { consultarDisponibilidad } = require('../controllers/disponibilidadController');

const {
  obtenerMisCitas,
  crearCita,
  reagendarCita,
} = require('../controllers/citasController');

// Consultar mis citas
router.get('/mis-citas', verificarToken, obtenerMisCitas);
router.get('/disponibilidad', verificarToken, consultarDisponibilidad);

// Registrar nueva solicitud de cita
router.post('/crear', verificarToken, crearCita);

router.post('/:idCita/reagendar', verificarToken, reagendarCita);

module.exports = router;
