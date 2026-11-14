const test = require('node:test');
const assert = require('node:assert/strict');
const { cerrarSesionLocal } = require('../src/services/cierreSesion');

test('cierra localmente aunque la baja push rechace por falta de red', async () => {
  const eventos = [];
  cerrarSesionLocal('jwt-de-prueba', async () => {
    eventos.push('push');
    throw new Error('sin conexión');
  }, () => eventos.push('limpiar'), () => eventos.push('navegar'));
  assert.deepEqual(eventos, ['limpiar', 'navegar']);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(eventos, ['limpiar', 'navegar', 'push']);
});
