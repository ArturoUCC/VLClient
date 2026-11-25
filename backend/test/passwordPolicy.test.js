const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluarPassword } = require('../utils/passwordPolicy');

test('acepta la política de contraseñas nuevas con el mínimo de 8 caracteres', () => {
  assert.equal(evaluarPassword('Abcdef1!').valida, true);
  assert.equal(evaluarPassword('A1!aaaaa'.repeat(9)).valida, true);
  assert.equal(evaluarPassword('A1!aaaaa'.repeat(9) + 'x').requisitos.bytes, false);
});

test('rechaza caracteres especiales ajenos, comillas y requisitos ausentes', () => {
  for (const clave of ['abcdef1!', 'Abcdefgh!', 'Abcdef12', 'Abc1!',
    'Abcdef1\'', 'Abcdef1"', 'Abcdef1`', 'Ábcdef1!', 'Abcdef1/']) {
    assert.equal(evaluarPassword(clave).valida, false, clave);
  }
});

test('acepta cada símbolo de la lista permitida', () => {
  for (const simbolo of '!@#$%&*_-+=?.:') {
    assert.equal(evaluarPassword(`Abcdef1${simbolo}`).valida, true, simbolo);
  }
});
