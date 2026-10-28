const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');
const { obtenerMiPerfil } = require('../controllers/perfilController');

router.get('/mi-perfil', verificarToken, obtenerMiPerfil);

module.exports = router;
