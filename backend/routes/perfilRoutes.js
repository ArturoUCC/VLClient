const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');
const {
  obtenerMiPerfil,
  actualizarRecordatorioRenta,
} = require('../controllers/perfilController');

router.get('/mi-perfil', verificarToken, obtenerMiPerfil);
router.patch('/recordatorio-renta', verificarToken, actualizarRecordatorioRenta);

module.exports = router;
