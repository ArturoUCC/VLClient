const test = require('node:test');
const assert = require('node:assert/strict');
const { contarFiltrosActivos, parametrosCitas, etiquetaInquilino,
  combinarInquilinos } = require('../src/admin/filtrosCitas');

test('cada filtro se envía individualmente y la página se conserva', () => {
  const casos = [
    ['estado', 'confirmada'], ['id_inquilino', '7'],
    ['id_propiedad', '12'], ['fecha', '2026-12-05'],
    ['reagendado_estado', 'solicitado'],
  ];
  for (const [campo, valor] of casos) {
    const filtros = { [campo]: valor };
    assert.equal(contarFiltrosActivos(filtros), 1);
    assert.deepEqual(parametrosCitas(filtros, 3), {
      pagina: '3', limite: '20', [campo]: valor,
    });
  }
});

test('filtros combinados y limpieza no dejan parámetros antiguos', () => {
  const filtros = { estado: 'programada', id_inquilino: '7',
    id_propiedad: '12', fecha: '2026-12-05',
    reagendado_estado: 'utilizado' };
  assert.equal(contarFiltrosActivos(filtros), 5);
  assert.deepEqual(parametrosCitas(filtros), {
    pagina: '1', limite: '20', ...filtros,
  });
  const limpios = Object.fromEntries(Object.keys(filtros).map((clave) => [clave, '']));
  assert.equal(contarFiltrosActivos(limpios), 0);
  assert.deepEqual(parametrosCitas(limpios), { pagina: '1', limite: '20' });
});

test('inquilinos con nombres iguales se distinguen por propiedad e ID', () => {
  const primero = { id_inquilino: 3, nombre: 'Ana', apellido: 'Lara',
    propiedad: 'Departamento Norte' };
  const segundo = { ...primero, id_inquilino: 4,
    propiedad: 'Departamento Sur' };
  assert.notEqual(etiquetaInquilino(primero), etiquetaInquilino(segundo));
  assert.match(etiquetaInquilino(segundo), /Departamento Sur/);
  assert.deepEqual(combinarInquilinos([primero], [primero, segundo], false),
    [primero, segundo]);
  assert.deepEqual(combinarInquilinos([primero], [segundo], true), [segundo]);
});
