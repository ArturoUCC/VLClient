const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const preferencias = new Map([[1, 5], [2, 5]]);
const consultas = [];
const pool = {
  async query(sql, params) {
    consultas.push({ sql, params });
    if (sql.includes('UPDATE inquilinos')) {
      if (!preferencias.has(params[1])) return { rows: [] };
      preferencias.set(params[1], params[0]);
      return { rows: [{ recordatorio_renta_dias: params[0] }] };
    }
    if (sql.includes('FROM inquilinos i')) {
      return { rows: [{ id_inquilino: params[0],
        recordatorio_renta_dias: preferencias.get(params[0]) }] };
    }
    throw new Error('Consulta inesperada');
  },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  return originalLoad.call(this, request, parent, isMain);
};
const { obtenerMiPerfil, actualizarRecordatorioRenta } =
  require('../controllers/perfilController');
Module._load = originalLoad;

const respuesta = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('el perfil devuelve la preferencia predeterminada de Neon', async () => {
  const res = respuesta();
  await obtenerMiPerfil({ usuario: { id_inquilino: 1 } }, res);
  assert.equal(res.body.recordatorio_renta_dias, 5);
  assert.match(consultas.at(-1).sql, /i\.recordatorio_renta_dias/);
});

test('PATCH acepta enteros de 1 a 31 y solo actualiza al dueño del JWT', async () => {
  for (const dias of [1, 2, 4, 5, 11, 13, 31]) {
    const res = respuesta();
    await actualizarRecordatorioRenta({
      usuario: { id_inquilino: 2 }, body: { recordatorio_renta_dias: dias },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.recordatorio_renta_dias, dias);
    assert.deepEqual(consultas.at(-1).params, [dias, 2]);
    assert.match(consultas.at(-1).sql, /WHERE id_inquilino = \$2 AND activo = TRUE/);
  }
  assert.equal(preferencias.get(1), 5);
  assert.equal(preferencias.get(2), 31);
});

test('PATCH rechaza valores inválidos y campos adicionales', async () => {
  for (const body of [
    {}, { recordatorio_renta_dias: 0 }, { recordatorio_renta_dias: 32 },
    { recordatorio_renta_dias: 2.5 }, { recordatorio_renta_dias: '5' },
    { recordatorio_renta_dias: null },
    { recordatorio_renta_dias: 5, id_inquilino: 1 },
  ]) {
    const anterior = consultas.length;
    const res = respuesta();
    await actualizarRecordatorioRenta({ usuario: { id_inquilino: 2 }, body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(consultas.length, anterior);
  }
});
