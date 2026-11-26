const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const cargar = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' &&
      /disponibilidadController\.js$/.test(parent?.filename || '')) return {};
  return cargar.call(this, request, parent, isMain);
};
const { horaValida } = require('../controllers/disponibilidadController');
Module._load = cargar;

test('disponibilidad administrativa acepta 08:00–18:00 en HH:mm', () => {
  for (const hora of ['08:00', '08:30', '17:30', '18:00']) {
    assert.equal(horaValida(hora), true);
  }
  for (const hora of ['07:30', '18:30', '8:00', '18:60', 'texto']) {
    assert.equal(horaValida(hora), false);
  }
});
