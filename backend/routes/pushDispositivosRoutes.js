const express = require('express');
const { verificarToken } = require('../middleware/authMiddleware');
const {
  registrarDispositivo,
  desactivarDispositivo,
} = require('../controllers/pushDispositivosController');

const router = express.Router();
router.post('/dispositivos', verificarToken, registrarDispositivo);
router.delete('/dispositivos/:instalacionId', verificarToken, desactivarDispositivo);
module.exports = router;
