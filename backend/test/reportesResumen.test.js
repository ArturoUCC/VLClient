const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

let consulta;
const pool = { query: async (sql, params) => {
  consulta = { sql, params };
  return { rows: [{ id_reporte: 13, titulo: 'Prueba', total: 1,
    fotos: [{ id_foto: 11,
      url_foto: 'https://res.cloudinary.com/demo/image/upload/v1/foto.jpg' }],
    citas: [{ id_cita: 8, estado: 'programada' }] }] };
} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && /reportesController\.js$/.test(parent?.filename || '')) {
    return pool;
  }
  if (request === '../services/notificacionesService') {
    return { crearNotificacionSegura: async () => {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let obtenerMisReportesResumen;
try { ({ obtenerMisReportesResumen } = require('../controllers/reportesController')); }
finally { Module._load = originalLoad; }
const respuesta = () => ({ status(n) { this.codigo = n; return this; },
  json(v) { this.body = v; return this; } });

test('resumen paginado consulta solo al propietario y agrupa fotos y citas', async () => {
  const res = respuesta();
  await obtenerMisReportesResumen({ usuario: { id_inquilino: 2 },
    query: { pagina: '1', limite: '20' } }, res);
  assert.equal(consulta.params[0], 2);
  assert.match(consulta.sql, /WHERE c\.id_inquilino=\$1/);
  assert.match(consulta.sql, /LEFT JOIN LATERAL/);
  assert.equal(res.body.reportes.length, 1);
  assert.equal(res.body.reportes[0].citas[0].id_cita, 8);
  assert.match(res.body.reportes[0].fotos[0].url_miniatura,
    /c_limit,w_320,h_320,q_auto,f_auto/);
});

test('paginación inválida se rechaza antes de consultar', async () => {
  consulta = null;
  const res = respuesta();
  await obtenerMisReportesResumen({ usuario: { id_inquilino: 2 },
    query: { pagina: '0' } }, res);
  assert.equal(res.codigo, 400);
  assert.equal(consulta, null);
});
