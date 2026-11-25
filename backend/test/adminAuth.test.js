const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const admin = { id_administrador: 3, nombre: 'Ada', apellido: 'Prueba',
  correo: 'admin@ejemplo.test', activo: true, sesion_version: 0 };
const consultas = [];
const pool = { query: async (sql, parametros) => {
  consultas.push({ sql, parametros });
  if (sql.includes('SELECT id_administrador, nombre')) {
    return { rows: admin.activo ? [{ ...admin, password_hash: admin.password_hash }] : [] };
  }
  if (sql.includes('SELECT id_administrador, sesion_version')) {
    return { rows: admin.activo ? [{ id_administrador: 3,
      sesion_version: admin.sesion_version }] : [] };
  }
  if (sql.includes('UPDATE administradores')) {
    admin.sesion_version += 1;
  }
  return { rows: [] };
} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' &&
      /admin(AuthController|AuthMiddleware)\.js$/.test(parent?.filename || '')) return pool;
  if (request === '../services/limiteRecuperacionService' &&
      /adminAuthController\.js$/.test(parent?.filename || '')) {
    return { consumirLimite: async () => true };
  }
  return originalLoad.call(this, request, parent, isMain);
};
let controlador, middleware;
try {
  controlador = require('../controllers/adminAuthController');
  middleware = require('../middleware/adminAuthMiddleware');
} finally { Module._load = originalLoad; }

const respuesta = () => ({ codigo: 200, cuerpo: null,
  status(n) { this.codigo = n; return this; },
  json(v) { this.cuerpo = v; return this; },
  end() { return this; } });

test('login administrativo verifica bcrypt y emite rol desde el backend', async () => {
  process.env.ADMIN_JWT_SECRET = 'secreto-simulado-exclusivo-de-pruebas';
  admin.password_hash = await bcrypt.hash('Abcdef1!', 4);
  const res = respuesta();
  await controlador.loginAdministrador({ body: {
    correo: '  ADMIN@EJEMPLO.TEST  ', password: 'Abcdef1!', rol: 'inquilino',
  }, ip: '127.0.0.1' }, res);
  assert.equal(res.codigo, 200);
  assert.equal(jwt.verify(res.cuerpo.token, process.env.ADMIN_JWT_SECRET).rol,
    'administrador');
  assert.equal(res.cuerpo.administrador.password_hash, undefined);
  assert.match(consultas.at(-1).sql, /lower\(correo\) = \$1/);
  assert.equal(consultas.at(-1).parametros[0], 'admin@ejemplo.test');
  const erronea = respuesta();
  await controlador.loginAdministrador({ body: { correo: admin.correo,
    password: 'incorrecta' }, ip: '127.0.0.1' }, erronea);
  assert.equal(erronea.codigo, 401);
});

test('el middleware rechaza JWT de inquilino y sesiones administrativas revocadas', async () => {
  const tenant = jwt.sign({ rol: 'inquilino', id_inquilino: 3,
    sesion_version: 0 }, process.env.ADMIN_JWT_SECRET);
  let res = respuesta();
  await middleware.verificarAdministrador({ headers: {
    authorization: `Bearer ${tenant}` }, }, res, () => assert.fail('sin acceso'));
  assert.equal(res.codigo, 403);

  const token = jwt.sign({ rol: 'administrador', id_administrador: 3,
    sesion_version: 0 }, process.env.ADMIN_JWT_SECRET);
  let autorizado = false;
  res = respuesta();
  await middleware.verificarAdministrador({ headers: {
    authorization: `Bearer ${token}` }, }, res, () => { autorizado = true; });
  assert.equal(autorizado, true);
  await controlador.logoutAdministrador({ administrador: { id_administrador: 3 } }, respuesta());
  res = respuesta();
  await middleware.verificarAdministrador({ headers: {
    authorization: `Bearer ${token}` }, }, res, () => assert.fail('revocada'));
  assert.equal(res.codigo, 401);
});
