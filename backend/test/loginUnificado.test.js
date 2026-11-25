const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let admin = null;
let inquilino = null;
let limite = true;
const consultas = [];
const pool = { query: async (sql, params) => {
  consultas.push({ sql, params });
  return { rows: sql.includes('FROM administradores') ?
    admin ? [admin] : [] : inquilino ? [inquilino] : [] };
} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' &&
      /loginUnificadoController\.js$/.test(parent?.filename || '')) return pool;
  if (request === '../services/limiteRecuperacionService' &&
      /loginUnificadoController\.js$/.test(parent?.filename || '')) {
    return { consumirLimite: async () => limite };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { iniciarSesionUnificada } = require('../controllers/loginUnificadoController');
Module._load = originalLoad;

const respuesta = () => ({ codigo: 200, status(n) { this.codigo = n; return this; },
  json(cuerpo) { this.cuerpo = cuerpo; return this; } });
const pedir = async (password = 'Clave123!') => {
  const res = respuesta();
  await iniciarSesionUnificada({ ip: '192.0.2.1', body: {
    correo: '  PERSONA@EJEMPLO.TEST  ', password, rol: 'administrador',
  } }, res);
  return res;
};

test('el backend decide el rol, normaliza correo y firma con secretos distintos', async () => {
  process.env.JWT_SECRET = 'jwt-de-inquilino-para-prueba';
  process.env.ADMIN_JWT_SECRET = 'secreto-administrativo-independiente-para-prueba';
  const hash = await bcrypt.hash('Clave123!', 4);
  admin = null;
  inquilino = { id_inquilino: 2, correo: 'persona@ejemplo.test', nombre: 'Inquilino',
    apellido: 'Prueba', activo: true, sesion_version: 3, password_hash: hash };
  let res = await pedir();
  assert.equal(res.codigo, 200);
  assert.equal(res.cuerpo.rol, 'inquilino');
  assert.equal(jwt.verify(res.cuerpo.token, process.env.JWT_SECRET).id_inquilino, 2);
  assert.equal(res.cuerpo.inquilino.password_hash, undefined);
  assert.ok(consultas.every(({ params }) => params[0] === 'persona@ejemplo.test'));
  inquilino = null;
  admin = { id_administrador: 8, correo: 'persona@ejemplo.test', nombre: 'Admin',
    apellido: 'Prueba', activo: true, sesion_version: 1, password_hash: hash };
  res = await pedir();
  assert.equal(res.codigo, 200);
  assert.equal(res.cuerpo.rol, 'administrador');
  assert.equal(jwt.verify(res.cuerpo.token, process.env.ADMIN_JWT_SECRET)
    .id_administrador, 8);
});

test('correo coincidente, cuenta inactiva y contraseña errónea dan respuesta genérica', async () => {
  const hash = await bcrypt.hash('Clave123!', 4);
  const base = { correo: 'persona@ejemplo.test', activo: true,
    sesion_version: 0, password_hash: hash };
  admin = { ...base, id_administrador: 8 };
  inquilino = { ...base, id_inquilino: 2,
    password_hash: await bcrypt.hash('Otra123!', 4) };
  const coincidente = await pedir();
  assert.equal(coincidente.codigo, 401);
  assert.equal((await pedir('Otra123!')).codigo, 401);
  admin = null;
  inquilino.password_hash = hash;
  inquilino.activo = false;
  const inactivo = await pedir();
  assert.equal(inactivo.codigo, 401);
  inquilino.activo = true;
  const incorrecto = await pedir('incorrecta');
  assert.equal(incorrecto.codigo, 401);
  inquilino = null;
  admin = { ...base, id_administrador: 8, activo: false };
  const adminInactivo = await pedir();
  assert.equal(adminInactivo.codigo, 401);
  admin = null;
  const ausente = await pedir();
  assert.deepEqual(coincidente.cuerpo, inactivo.cuerpo);
  assert.deepEqual(inactivo.cuerpo, incorrecto.cuerpo);
  assert.deepEqual(incorrecto.cuerpo, adminInactivo.cuerpo);
  assert.deepEqual(incorrecto.cuerpo, ausente.cuerpo);
});

test('límite de intentos impide consultar cuentas', async () => {
  consultas.length = 0; limite = false;
  try {
    const res = await pedir();
    assert.equal(res.codigo, 429);
    assert.equal(consultas.length, 0);
  } finally { limite = true; }
});
