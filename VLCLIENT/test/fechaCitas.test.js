const test = require('node:test');
const assert = require('node:assert/strict');
const { ahoraMexico, horarioPasadoMexico } = require('../src/services/fechaCitas');

test('los horarios se comparan por día calendario de Ciudad de México', () => {
  const antes = new Date('2026-12-01T05:59:00Z');
  const despues = new Date('2026-12-01T06:01:00Z');
  assert.deepEqual(ahoraMexico(antes), { fecha: '2026-11-30', hora: '23:59' });
  assert.deepEqual(ahoraMexico(despues), { fecha: '2026-12-01', hora: '00:01' });
  assert.equal(horarioPasadoMexico('2026-12-01', '09:00', antes), false);
  assert.equal(horarioPasadoMexico('2026-11-30', '17:00', despues), true);
});
