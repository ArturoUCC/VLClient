const test = require('node:test');
const assert = require('node:assert/strict');
const { generarHorarios, horarioHabilitado } = require('../src/admin/horariosAdmin');

test('selector genera 08:00 a 18:00 cada 30 minutos en formato HH:mm', () => {
  const horas = generarHorarios();
  assert.equal(horas.length, 21);
  assert.equal(horas[0], '08:00');
  assert.equal(horas[1], '08:30');
  assert.equal(horas.at(-2), '17:30');
  assert.equal(horas.at(-1), '18:00');
  assert.equal(new Set(horas).size, horas.length);
  assert.ok(horas.every((hora) => /^\d{2}:(00|30)$/.test(hora)));
});

test('horarios ya habilitados se reconocen sin bloquear uno deshabilitado', () => {
  const existentes = [{ hora: '08:00', horario_habilitado: true },
    { hora: '08:30', horario_habilitado: false }];
  assert.equal(horarioHabilitado(existentes, '08:00'), true);
  assert.equal(horarioHabilitado(existentes, '08:30'), false);
  assert.equal(horarioHabilitado(existentes, '09:00'), false);
});
