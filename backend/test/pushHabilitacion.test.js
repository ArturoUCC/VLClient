const test = require('node:test');
const assert = require('node:assert/strict');
const { envioRemotoHabilitado } = require('../jobs/procesarNotificacionesPush');

test('el procesador remoto exige activación explícita', () => {
  assert.equal(envioRemotoHabilitado(undefined), false);
  assert.equal(envioRemotoHabilitado('false'), false);
  assert.equal(envioRemotoHabilitado('true'), true);
});
