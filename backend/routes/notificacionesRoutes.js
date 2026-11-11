const express = require('express');
const router = express.Router();

const {
  verificarToken,
} = require('../middleware/authMiddleware');

const {
  obtenerMisNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
} = require('../controllers/notificacionesController');

// Consultar notificaciones
router.get(
  '/mis-notificaciones',
  verificarToken,
  obtenerMisNotificaciones
);

// Marcar todas como leídas
// IMPORTANTE: esta ruta va antes de /:idNotificacion
router.patch(
  '/marcar-todas-leidas',
  verificarToken,
  marcarTodasComoLeidas
);

// Marcar una como leída
router.patch(
  '/:idNotificacion/leida',
  verificarToken,
  marcarComoLeida
);

module.exports = router;
