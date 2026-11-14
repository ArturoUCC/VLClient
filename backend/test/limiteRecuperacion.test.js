const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

let intentos = 0;
let claveRegistrada;
const pool = {
  query: async (sql, params) => {
    assert.match(sql, /INSERT INTO limites_recuperacion_password/);
    assert.match(sql, /ON CONFLICT \(clave\) DO UPDATE/);
    claveRegistrada = params[0];
    return { rows: [{ intentos: ++intentos }] };
  }
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  return originalLoad.call(this, request, parent, isMain);
};
const { consumirLimite } = require('../services/limiteRecuperacionService');
Module._load = originalLoad;

test('el limitador usa una clave HMAC y aplica el máximo', async () => {
  const anterior = process.env.RECOVERY_RATE_LIMIT_SECRET;
  process.env.RECOVERY_RATE_LIMIT_SECRET = 'secreto-de-prueba-de-mas-de-32-caracteres';
  try {
    assert.equal(await consumirLimite('solicitud-correo', 'inquilino@example.test', 3, 60), true);
    assert.equal(await consumirLimite('solicitud-correo', 'inquilino@example.test', 3, 60), true);
    assert.equal(await consumirLimite('solicitud-correo', 'inquilino@example.test', 3, 60), true);
    assert.equal(await consumirLimite('solicitud-correo', 'inquilino@example.test', 3, 60), false);
    assert.match(claveRegistrada, /^[a-f0-9]{64}$/);
    assert.ok(!claveRegistrada.includes('inquilino'));
  } finally {
    if (anterior === undefined) delete process.env.RECOVERY_RATE_LIMIT_SECRET;
    else process.env.RECOVERY_RATE_LIMIT_SECRET = anterior;
  }
});
