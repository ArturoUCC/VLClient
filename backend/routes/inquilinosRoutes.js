const express = require('express');
const router = express.Router();

const {
  obtenerInquilinos
} = require('../controllers/inquilinosController');

router.get('/', obtenerInquilinos);

module.exports = router;
