const test = require('node:test');
const assert = require('node:assert/strict');
const movil = require('../src/services/passwordPolicy');
const servidor = require('../../backend/utils/passwordPolicy');

test('la ayuda móvil coincide con la validación del backend', () => {
  for (const clave of ['Abcdef1!', 'Abcdef1_', 'abcdef1!', 'Abcdef12',
    'Abcdef1\'', 'Abcdef1`', 'Abcdef1 '.repeat(10), 'Á'.repeat(40)]) {
    assert.deepEqual(movil.evaluarPassword(clave), servidor.evaluarPassword(clave));
  }
});
