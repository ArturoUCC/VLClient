const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const filas = new Map();
let siguiente = 1;
let avisos = 0;
const pool = {
  async query(sql, params) {
    if (sql.includes('INSERT INTO reportes')) {
      const [owner, titulo, descripcion, categoria, clave] = params;
      if (clave && filas.has(clave)) return { rows: [] };
      const fila = { id_reporte: siguiente++, propietario: owner, titulo,
        descripcion, categoria, clave_idempotencia: clave };
      filas.set(clave, fila);
      return { rows: [fila] };
    }
    if (sql.includes('WHERE r.clave_idempotencia')) {
      const fila = filas.get(params[0]);
      return { rows: fila ? [{ ...fila }] : [] };
    }
    throw new Error('Consulta inesperada');
  },
};
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  if (request === '../services/notificacionesService') return {
    crearNotificacionSegura: async () => { avisos++; },
  };
  return original.call(this, request, parent, isMain);
};
const { crearReporte } = require('../controllers/reportesController');
Module._load = original;
const respuesta = () => ({ statusCode: 200,
  status(codigo) { this.statusCode = codigo; return this; },
  json(cuerpo) { this.body = cuerpo; return this; },
});
const clave = '00000000-0000-4000-8000-000000000001';
const solicitud = (owner = 1, cambios = {}) => ({
  usuario: { id_inquilino: owner }, body: { titulo: 'Fuga',
    descripcion: 'En la cocina', categoria: 'plomeria',
    clave_idempotencia: clave, ...cambios },
});

test('un reenvío y dos solicitudes simultáneas crean un solo reporte y aviso', async () => {
  const respuestas = [respuesta(), respuesta()];
  await Promise.all(respuestas.map((res) => crearReporte(solicitud(), res)));
  assert.deepEqual(respuestas.map((res) => res.statusCode).sort(), [200, 201]);
  assert.equal(respuestas[0].body.reporte.id_reporte,
    respuestas[1].body.reporte.id_reporte);
  assert.equal(filas.size, 1);
  assert.equal(avisos, 1);
  const perdida = respuesta();
  await crearReporte(solicitud(), perdida);
  assert.equal(perdida.statusCode, 200);
  assert.equal(avisos, 1);
});

test('la clave de otro inquilino o con contenido distinto se rechaza', async () => {
  for (const req of [solicitud(2), solicitud(1, { descripcion: 'Otra fuga' })]) {
    const res = respuesta();
    await crearReporte(req, res);
    assert.equal(res.statusCode, 409);
  }
  assert.equal(avisos, 1);
});

test('la clave UUID inválida se rechaza antes de consultar la base', async () => {
  const res = respuesta();
  await crearReporte(solicitud(1, { clave_idempotencia: 'abc' }), res);
  assert.equal(res.statusCode, 400);
});
