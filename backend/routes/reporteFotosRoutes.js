const express = require('express');
const multer = require('multer');

const { verificarToken } = require('../middleware/authMiddleware');

const {
  subirFotosReporte,
  obtenerFotosReporte,
} = require('../controllers/reporteFotosController');
const { subirFotoIdempotente } = require('../controllers/reporteFotosIdempotenteController');

const router = express.Router();

const tiposPermitidos = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },

  fileFilter: (req, file, callback) => {
    if (!tiposPermitidos.includes(file.mimetype)) {
      return callback(
        new Error('Solo se permiten fotografías JPG, PNG, WEBP o HEIC')
      );
    }

    callback(null, true);
  },
});

const recibirFotos = (req, res, next) => {
  upload.array('fotos', 5)(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        mensaje: error.code === 'LIMIT_FILE_SIZE'
          ? 'Cada fotografía debe pesar máximo 5 MB'
          : error.message,
      });
    }

    next();
  });
};

router.post(
  '/:idReporte/sincronizar',
  verificarToken,
  recibirFotos,
  subirFotoIdempotente
);

router.post(
  '/:idReporte',
  verificarToken,
  recibirFotos,
  subirFotosReporte
);

router.get(
  '/:idReporte',
  verificarToken,
  obtenerFotosReporte
);

module.exports = router;
