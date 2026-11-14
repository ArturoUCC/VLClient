const test = require('node:test');
const assert = require('node:assert/strict');
const {
  comprobarSesion, configurarManejadorSesionExpirada, SesionExpiradaError,
} = require('../src/services/sesionHttp');

test('JWT expirado o revocado (401) avisa solo para solicitudes autenticadas', () => {
  const avisos = [];
  configurarManejadorSesionExpirada((token) => avisos.push(token));
  assert.throws(() => comprobarSesion({ status: 401 },
    { headers: { Authorization: 'Bearer token-de-prueba' } }), SesionExpiradaError);
  assert.equal(comprobarSesion({ status: 401 }, { headers: {} }).status, 401);
  assert.deepEqual(avisos, ['token-de-prueba']);
  configurarManejadorSesionExpirada(null);
});

test('un error de red o una respuesta temporal no revoca la sesión', () => {
  let avisos = 0;
  configurarManejadorSesionExpirada(() => { avisos++; });
  assert.equal(comprobarSesion({ status: 503 },
    { headers: { Authorization: 'Bearer token' } }).status, 503);
  assert.equal(avisos, 0);
  configurarManejadorSesionExpirada(null);
});
