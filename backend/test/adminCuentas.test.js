const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcryptjs');

let consultas = [];
let duplicado = false;
const cliente = { async query(sql, params = []) {
  consultas.push({ sql, params });
  if (sql.includes('INSERT INTO administradores')) {
    if (duplicado) { const error = new Error('duplicado'); error.code = '23505'; throw error; }
    return { rows: [{ id_administrador: 4, nombre: params[0],
      apellido: params[1], correo: params[2], activo: true }] };
  }
  return { rows: [] };
}, release() {} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && /adminCuentasController\.js$/.test(parent?.filename || '')) {
    return { connect: async () => cliente };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let crearAdministrador;
try { ({ crearAdministrador } = require('../controllers/adminCuentasController')); }
finally { Module._load = originalLoad; }
const respuesta = () => ({ codigo: 200,
  status(n) { this.codigo = n; return this; },
  json(v) { this.body = v; return this; } });
const solicitud = (password = 'Abcdef1!') => ({ administrador: { id_administrador: 2 },
  body: { nombre: 'Ada', apellido: 'Prueba', correo: '  ADMIN@ejemplo.test  ',
    password, confirmacion: password } });

test('alta de administrador valida política, guarda bcrypt y audita sin devolver hash', async () => {
  consultas = []; duplicado = false;
  const res = respuesta();
  await crearAdministrador(solicitud(), res);
  assert.equal(res.codigo, 201);
  const insert = consultas.find((item) => item.sql.includes('INSERT INTO administradores'));
  assert.equal(insert.params[2], 'admin@ejemplo.test');
  assert.equal(await bcrypt.compare('Abcdef1!', insert.params[3]), true);
  assert.equal(res.body.administrador.password_hash, undefined);
  const audit = consultas.find((item) => item.sql.includes('bitacora_administrativa'));
  assert.deepEqual(audit.params, [2, 4]);
  assert.equal(consultas.at(-1).sql, 'COMMIT');
});

test('contraseña inválida se rechaza y correo duplicado revierte la transacción', async () => {
  consultas = [];
  assert.equal((await (async () => { const res = respuesta();
    await crearAdministrador(solicitud('sinmayus1!'), res); return res; })()).codigo, 400);
  assert.equal(consultas.length, 0);
  duplicado = true;
  const res = respuesta();
  await crearAdministrador(solicitud(), res);
  assert.equal(res.codigo, 409);
  assert.ok(consultas.some((item) => item.sql === 'ROLLBACK'));
});
