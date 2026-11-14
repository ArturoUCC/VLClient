const express = require('express');
const path = require('node:path');

const router = express.Router();
const archivos = path.join(__dirname, '..', 'public', 'recuperar-password');

router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
  });
  next();
});

router.get('/', (req, res) => res.sendFile(path.join(archivos, 'index.html')));
router.get('/estilos.css', (req, res) => res.sendFile(path.join(archivos, 'estilos.css')));
router.get('/app.js', (req, res) => res.sendFile(path.join(archivos, 'app.js')));

module.exports = router;
