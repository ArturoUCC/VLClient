const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let cuenta = null;
let permitir = true;
const limites = [];
const pool = { query: async (sql, params) => {
  assert.match(sql, /FROM inquilinos/);
  assert.equal(params[0], 'inquilino@example.test');
  return { rows: cuenta ? [cuenta] : [] };
} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  if (request === '../services/limiteRecuperacionService') return {
    consumirLimite: async (...args) => { limites.push(args); return permitir; },
  };
  if (request === '../services/correoRecuperacionService') return { enviarRecuperacion: async () => {} };
  return originalLoad.call(this, request, parent, isMain);
};
const { iniciarSesion } = require('../controllers/authController');
Module._load = originalLoad;

const responder = () => ({
  statusCode: 200,
  status(codigo) { this.statusCode = codigo; return this; },
  json(body) { this.body = body; return this; },
});
const pedir = async (password = 'password-de-prueba') => {
  const res = responder();
  await iniciarSesion({ ip: '192.0.2.1', body: {
    correo: 'Inquilino@example.test', password,
  } }, res);
  return res;
};

test('login aplica límites compartidos por IP y correo antes de buscar la cuenta', async () => {
  const previo = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'jwt-de-prueba';
  try {
    cuenta = null;
    limites.length = 0;
    permitir = false;
    const respuesta = await pedir();
    assert.equal(respuesta.statusCode, 429);
    assert.deepEqual(limites.map((item) => item[0]), ['login-ip', 'login-correo']);
    assert.equal(limites[0][2], 20);
    assert.equal(limites[1][2], 5);
  } finally {
    permitir = true;
    if (previo === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previo;
  }
});

test('login no distingue un correo desconocido de una contraseña incorrecta', async () => {
  const previo = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'jwt-de-prueba';
  try {
    cuenta = null;
    const desconocido = await pedir();
    cuenta = { id_inquilino: 1, activo: true,
      password_hash: await bcrypt.hash('otra-password', 4), sesion_version: 2 };
    const incorrecto = await pedir();
    assert.equal(desconocido.statusCode, 401);
    assert.equal(incorrecto.statusCode, 401);
    assert.deepEqual(desconocido.body, incorrecto.body);
  } finally {
    cuenta = null;
    if (previo === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previo;
  }
});

test('login válido mantiene JWT con versión de sesión vigente', async () => {
  const previo = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'jwt-de-prueba';
  try {
    cuenta = { id_inquilino: 2, nombre: 'Prueba', apellido: 'Dos',
      correo: 'inquilino@example.test', activo: true,
      password_hash: await bcrypt.hash('password-de-prueba', 4), sesion_version: 3 };
    const respuesta = await pedir();
    assert.equal(respuesta.statusCode, 200);
    const datos = jwt.verify(respuesta.body.token, process.env.JWT_SECRET);
    assert.equal(datos.id_inquilino, 2);
    assert.equal(datos.sesion_version, 3);
  } finally {
    cuenta = null;
    if (previo === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previo;
  }
});
