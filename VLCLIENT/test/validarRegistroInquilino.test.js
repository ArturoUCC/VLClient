const test = require('node:test');
const assert = require('node:assert/strict');
const { validarRegistroInquilino } = require('../src/services/validarRegistroInquilino');

const campos = { nombre: 'Ana', apellido: 'Prueba', correo: 'ana@ejemplo.test',
  telefono: '', password: 'Clave123!', confirmacion: 'Clave123!',
  fecha_inicio: '2026-12-01', fecha_fin: '2027-11-30', renta: '9500.00' };
const propiedad = { id_propiedad: 7, disponible: true };

test('el formulario acepta límites confirmados y cero exacto', () => {
  const limite = { ...campos, nombre: 'N'.repeat(100), apellido: 'A'.repeat(150),
    correo: `${'a'.repeat(150 - '@ejemplo.test'.length)}@ejemplo.test`,
    telefono: '1'.repeat(20), renta: '9999999999.99' };
  assert.equal(validarRegistroInquilino(limite, propiedad), true);
  assert.equal(validarRegistroInquilino({ ...campos, renta: '0.00' }, propiedad), true);
});

test('el formulario rechaza longitudes y cantidades fuera de NUMERIC(12,2)', () => {
  for (const cambio of [
    { nombre: 'N'.repeat(101) }, { apellido: 'A'.repeat(151) },
    { correo: `${'a'.repeat(151 - '@ejemplo.test'.length)}@ejemplo.test` },
    { telefono: '1'.repeat(21) }, { renta: '10000000000' },
    { renta: '1.005' }, { renta: '9999999999.999' },
    { renta: '1e3' }, { renta: '1,50' }, { renta: '-1' },
  ]) assert.equal(validarRegistroInquilino({ ...campos, ...cambio }, propiedad), false);
  assert.equal(validarRegistroInquilino(campos, { disponible: false }), false);
});
