const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

let reportes = [];
const consultas = [];
const pool = { query: async (sql, params) => {
  consultas.push({ sql, params });
  if (sql.includes('FROM inquilinos WHERE')) return { rows: [
    { id_inquilino: params[0], nombre: 'Persona', apellido: 'Prueba' }] };
  if (sql.includes('FROM reportes r')) return { rows: reportes };
  return { rows: [] };
} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' &&
      /adminInquilinosController\.js$/.test(parent?.filename || '')) return pool;
  return originalLoad.call(this, request, parent, isMain);
};
const { detalleInquilino, listarInquilinos } =
  require('../controllers/adminInquilinosController');
Module._load = originalLoad;
const pedir = async (id = '2') => {
  const res = { codigo: 200, status(n) { this.codigo = n; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; } };
  await detalleInquilino({ params: { idInquilino: id } }, res);
  return res;
};

test('el detalle obtiene fotos en una consulta acotada al inquilino y su reporte', async () => {
  reportes = [
    { id_reporte: 10, fotos: [] },
    { id_reporte: 11, fotos: [{ id_foto: 1,
      url_foto: 'https://res.cloudinary.com/demo/image/upload/a.jpg' }] },
    { id_reporte: 12, fotos: [{ id_foto: 2, url_foto: 'local-test://dos' },
      { id_foto: 3, url_foto: 'local-test://tres' }] },
  ];
  consultas.length = 0;
  const res = await pedir();
  assert.equal(res.codigo, 200);
  assert.deepEqual(res.cuerpo.reportes.map((r) => r.fotos.length), [0, 1, 2]);
  assert.deepEqual(res.cuerpo.reportes[2].fotos.map((f) => f.id_foto), [2, 3]);
  assert.match(res.cuerpo.reportes[1].fotos[0].url_miniatura,
    /c_limit,w_320,h_320/);
  const consulta = consultas.find((c) => c.sql.includes('FROM reportes r'));
  assert.match(consulta.sql, /JOIN contratos c ON c.id_contrato=r.id_contrato/);
  assert.match(consulta.sql, /rf.id_reporte=r.id_reporte/);
  assert.match(consulta.sql, /WHERE c.id_inquilino=\$1/);
  assert.deepEqual(consulta.params, [2]);
  assert.equal(consultas.length, 5);
});

test('el identificador del inquilino no admite valores ambiguos', async () => {
  const res = await pedir('2x');
  assert.equal(res.codigo, 400);
});

test('el selector busca nombre o apellido con paginación y propiedad', async () => {
  consultas.length = 0;
  const res = { codigo: 200, status(n) { this.codigo = n; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; } };
  await listarInquilinos({ query: { buscar: 'Lara', estado: 'todos',
    pagina: '2', limite: '30' } }, res);
  assert.equal(res.codigo, 200);
  const consulta = consultas[0];
  assert.match(consulta.sql, /i.nombre ILIKE/);
  assert.match(consulta.sql, /i.apellido ILIKE/);
  assert.match(consulta.sql, /p.nombre AS propiedad/);
  assert.match(consulta.sql, /LIMIT \$3 OFFSET \$4/);
  assert.deepEqual(consulta.params, ['todos', 'Lara', 30, 30]);
});
