const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return { query: async () => { throw new Error('No DB'); } };
  return originalLoad.call(this, request, parent, isMain);
};
let router;
try { router = require('../routes/adminRoutes'); }
finally { Module._load = originalLoad; }

test('todas las rutas de datos y cambios administrativos exigen JWT', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  const servidor = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => servidor.once('listening', resolve));
    const base = `http://127.0.0.1:${servidor.address().port}/api/admin`;
    const rutas = [
      ['GET', '/resumen'], ['GET', '/inquilinos'], ['GET', '/inquilinos/1'],
      ['POST', '/inquilinos'],
      ['GET', '/citas'], ['GET', '/disponibilidad?fecha=2099-12-10'],
      ['GET', '/auth/perfil'], ['POST', '/auth/logout'],
      ['GET', '/propiedades'],
      ['POST', '/citas/1/confirmar'], ['POST', '/administradores'],
      ['PATCH', '/administradores/1/activo'],
      ['PUT', '/disponibilidad/fechas/2099-12-10'],
      ['PUT', '/disponibilidad/fechas/2099-12-10/horarios/09:00'],
    ];
    for (const [method, path] of rutas) {
      const respuesta = await fetch(base + path, { method });
      assert.equal(respuesta.status, 401, `${method} ${path}`);
    }
  } finally { await new Promise((resolve) => servidor.close(resolve)); }
});
