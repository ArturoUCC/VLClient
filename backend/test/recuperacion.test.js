const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

let cuenta = { id_inquilino: 7, correo: 'inquilino@example.test', activo: true,
  password_hash: 'anterior', sesion_version: 0 };
let recuperacion;
let correoEnviado;
let expirada = false;
const pool = {
  query: async (sql, params) => consultar(sql, params),
  connect: async () => ({ query: async (sql, params) => consultar(sql, params), release() {} })
};

async function consultar(sql, params = []) {
  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
  if (sql.includes('password_hash,') && sql.includes('FROM inquilinos')) {
    return { rows: params[0].toLowerCase() === cuenta.correo ? [cuenta] : [] };
  }
  if (sql.includes('SELECT id_inquilino, correo FROM inquilinos')) {
    return { rows: params[0] === cuenta.correo && cuenta.activo ? [cuenta] : [] };
  }
  if (sql.includes('INSERT INTO recuperaciones_password')) {
    recuperacion = { id_recuperacion: 11, id_inquilino: cuenta.id_inquilino,
      token_hash: params[1], usada: false };
    return { rows: [{ id_recuperacion: 11 }] };
  }
  if (sql.includes('SELECT id_inquilino FROM recuperaciones_password')) {
    return { rows: recuperacion?.token_hash === params[0]
      ? [{ id_inquilino: cuenta.id_inquilino }] : [] };
  }
  if (sql.includes('SELECT id_inquilino FROM inquilinos')) {
    return { rows: cuenta.activo ? [cuenta] : [] };
  }
  if (sql.includes('SELECT id_recuperacion FROM recuperaciones_password')) {
    return { rows: recuperacion?.token_hash === params[0] && !recuperacion.usada && !expirada
      ? [{ id_recuperacion: 11 }] : [] };
  }
  if (sql.includes('UPDATE inquilinos SET password_hash')) {
    cuenta.password_hash = params[0];
    cuenta.sesion_version++;
  }
  if (sql.includes('UPDATE recuperaciones_password') && recuperacion) {
    recuperacion.usada = true;
  }
  if (sql.includes('SELECT id_inquilino, sesion_version')) {
    return { rows: [cuenta] };
  }
  return { rows: [] };
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  if (request === '../services/limiteRecuperacionService') {
    return { consumirLimite: async () => true };
  }
  if (request === '../services/correoRecuperacionService') {
    return { enviarRecuperacion: async (destinatario, token) => {
      correoEnviado = { destinatario, token };
    } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const auth = require('../controllers/authController');
const { verificarToken } = require('../middleware/authMiddleware');
Module._load = originalLoad;

const respuesta = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

test('la solicitud no enumera correos y almacena solo el hash', async () => {
  const desconocido = respuesta();
  await auth.solicitarRecuperacion({ body: { correo: 'otro@example.test' }, ip: '127.0.0.1' }, desconocido);
  const conocido = respuesta();
  await auth.solicitarRecuperacion({ body: { correo: cuenta.correo }, ip: '127.0.0.1' }, conocido);
  await new Promise(setImmediate);
  assert.equal(desconocido.statusCode, 202);
  assert.deepEqual(conocido.body, desconocido.body);
  assert.equal(correoEnviado.token.length, 64);
  assert.notEqual(recuperacion.token_hash, correoEnviado.token);
  assert.equal(recuperacion.token_hash.length, 64);
});

test('el token se consume una vez y revoca los JWT anteriores', async () => {
  const anterior = jwt.sign({ id_inquilino: 7, rol: 'inquilino', sesion_version: 0 }, 'prueba');
  const req = { body: { token: correoEnviado.token, nuevaPassword: 'NuevaClaveSegura123' }, ip: '127.0.0.1' };
  expirada = true;
  const vencido = respuesta();
  await auth.restablecerPassword(req, vencido);
  assert.equal(vencido.statusCode, 400);
  assert.equal(cuenta.sesion_version, 0);
  expirada = false;
  const primero = respuesta();
  await auth.restablecerPassword(req, primero);
  assert.equal(primero.statusCode, 200);
  assert.equal(recuperacion.usada, true);
  assert.equal(cuenta.sesion_version, 1);
  assert.equal(await bcrypt.compare(req.body.nuevaPassword, cuenta.password_hash), true);

  const segundo = respuesta();
  await auth.restablecerPassword(req, segundo);
  assert.equal(segundo.statusCode, 400);

  const secretoAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'prueba';
  const validacion = respuesta();
  await verificarToken({ headers: { authorization: `Bearer ${anterior}` } }, validacion, () => {
    throw new Error('El JWT anterior no debe autorizar');
  });
  assert.equal(validacion.statusCode, 401);

  const login = respuesta();
  await auth.iniciarSesion({ body: { correo: cuenta.correo, password: req.body.nuevaPassword } }, login);
  assert.equal(login.statusCode, 200);
  assert.equal(jwt.verify(login.body.token, 'prueba').sesion_version, 1);
  let autorizado = false;
  await verificarToken({ headers: { authorization: `Bearer ${login.body.token}` } }, respuesta(), () => {
    autorizado = true;
  });
  assert.equal(autorizado, true);
  if (secretoAnterior === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secretoAnterior;
});
