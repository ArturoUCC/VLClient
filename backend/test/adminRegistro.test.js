const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const db = { connect: null };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return db;
  return originalLoad.call(this, request, parent, isMain);
};
let registrarInquilino;
try { ({ registrarInquilino } = require('../controllers/adminInquilinosController')); }
finally { Module._load = originalLoad; }

const datos = { nombre: 'Ana', apellido: 'Prueba', correo: '  ANA@ejemplo.test  ',
  telefono: '', password: 'Clave123!', confirmacion: 'Clave123!',
  id_propiedad: 7, fecha_inicio: '2026-12-01', fecha_fin: '2027-11-30',
  renta_acordada: '9500.00' };
const ejecutar = async (entrada = datos) => {
  const req = { body: entrada, administrador: { id_administrador: 3 } };
  const res = { codigo: 200, status(n) { this.codigo = n; return this; },
    json(valor) { this.valor = valor; return this; } };
  await registrarInquilino(req, res); return res;
};
const cliente = (opciones = {}) => {
  const consultas = [];
  let liberado = false;
  return { consultas, get liberado() { return liberado; }, release() { liberado = true; },
    async query(sql, params) {
      consultas.push({ sql, params });
      if (opciones.fallarEn && sql.includes(opciones.fallarEn)) {
        const error = new Error('fallo simulado'); error.code = opciones.codigo;
        throw error;
      }
      if (sql.includes('FROM propiedades')) return { rows: opciones.propiedad === null ? [] :
        [{ id_propiedad: 7, estado: opciones.propiedad || 'disponible' }] };
      if (sql.includes('FROM contratos')) return { rows: opciones.ocupada ? [{ 1: 1 }] : [] };
      if (sql.includes('FROM inquilinos')) return { rows: opciones.correo ? [{ 1: 1 }] : [] };
      if (sql.includes('INSERT INTO inquilinos')) return { rows: [{ id_inquilino: 20,
        nombre: 'Ana', apellido: 'Prueba', correo: 'ana@ejemplo.test' }] };
      if (sql.includes('INSERT INTO contratos')) return { rows: [{ id_contrato: 30 }] };
      return { rows: [] };
    } };
};

test('alta confirma inquilino, contrato, propiedad y bitácora juntos', async () => {
  const c = cliente(); db.connect = async () => c;
  const r = await ejecutar(); assert.equal(r.codigo, 201);
  assert.equal(r.valor.inquilino.id_inquilino, 20);
  assert.equal(r.valor.contrato.id_contrato, 30);
  assert.deepEqual(c.consultas.map((q) => q.sql).filter((q) =>
    /^(BEGIN|COMMIT|ROLLBACK)$/.test(q)), ['BEGIN', 'COMMIT']);
  assert.ok(c.consultas.find((q) => q.sql.includes('FOR UPDATE')));
  assert.ok(c.consultas.find((q) => q.sql.includes("SET estado='rentada'")));
  const insert = c.consultas.find((q) => q.sql.includes('INSERT INTO inquilinos'));
  assert.equal(insert.params[2], 'ana@ejemplo.test');
  const audit = c.consultas.find((q) => q.sql.includes('bitacora_administrativa'));
  assert.deepEqual(audit.params.slice(0, 2), [3, 20]);
  assert.deepEqual(JSON.parse(audit.params[2]), { id_contrato: 30, id_propiedad: 7 });
  assert.equal(c.liberado, true);
});
test('duplicado, propiedad ocupada y mantenimiento no insertan', async () => {
  for (const opciones of [{ correo: true }, { ocupada: true },
    { propiedad: 'mantenimiento' }, { propiedad: null }]) {
    const c = cliente(opciones); db.connect = async () => c;
    const r = await ejecutar();
    assert.equal(r.codigo, opciones.propiedad === null ? 404 : 409);
    assert.equal(c.consultas.some((q) => q.sql.includes('INSERT INTO inquilinos')), false);
    assert.ok(c.consultas.some((q) => q.sql === 'ROLLBACK'));
  }
});
test('fallo en contrato revierte el alta y no cambia propiedad', async () => {
  const c = cliente({ fallarEn: 'INSERT INTO contratos' }); db.connect = async () => c;
  const r = await ejecutar(); assert.equal(r.codigo, 503);
  assert.ok(c.consultas.some((q) => q.sql === 'ROLLBACK'));
  assert.equal(c.consultas.some((q) => q.sql.includes("SET estado='rentada'")), false);
});
test('índice único protege dos solicitudes simultáneas tras esperar el bloqueo', async () => {
  const primero = cliente();
  const segundo = cliente({ propiedad: 'rentada' });
  let indice = 0;
  db.connect = async () => [primero, segundo][indice++];
  const resultados = await Promise.all([ejecutar(), ejecutar()]);
  assert.deepEqual(resultados.map((r) => r.codigo).sort(), [201, 409]);
  assert.equal(segundo.consultas.some((q) => q.sql.includes('INSERT INTO inquilinos')), false);
});
test('fechas, importe y contraseña inválidos se rechazan antes de consultar', async () => {
  db.connect = async () => { throw new Error('No debe conectar'); };
  for (const cambio of [{ fecha_fin: '2026-11-30' }, { renta_acordada: '-1' },
    { password: 'débil' }, { id_propiedad: 0 }]) {
    const r = await ejecutar({ ...datos, ...cambio }); assert.equal(r.codigo, 400);
  }
});

test('acepta límites VARCHAR y NUMERIC(12,2) confirmados', async () => {
  const limite = { ...datos, nombre: 'N'.repeat(100), apellido: 'A'.repeat(150),
    correo: `${'a'.repeat(150 - '@ejemplo.test'.length)}@ejemplo.test`,
    telefono: '1'.repeat(20), renta_acordada: '9999999999.99' };
  const c = cliente(); db.connect = async () => c;
  assert.equal((await ejecutar(limite)).codigo, 201);
  const importe = c.consultas.find((q) => q.sql.includes('INSERT INTO contratos'));
  assert.equal(importe.params[4], '9999999999.99');
  const cero = cliente(); db.connect = async () => cero;
  assert.equal((await ejecutar({ ...datos, renta_acordada: '0.00' })).codigo, 201);
});

test('rechaza desbordes y decimales que PostgreSQL redondearía', async () => {
  db.connect = async () => { throw new Error('No debe conectar'); };
  for (const cambio of [
    { nombre: 'N'.repeat(101) }, { apellido: 'A'.repeat(151) },
    { correo: `${'a'.repeat(151 - '@ejemplo.test'.length)}@ejemplo.test` },
    { telefono: '1'.repeat(21) }, { renta_acordada: '10000000000' },
    { renta_acordada: '9999999999.999' }, { renta_acordada: '1.005' },
    { renta_acordada: '1e3' }, { renta_acordada: '1,50' },
    { renta_acordada: 1.005 }, { renta_acordada: 'NaN' },
  ]) {
    assert.equal((await ejecutar({ ...datos, ...cambio })).codigo, 400);
  }
});
