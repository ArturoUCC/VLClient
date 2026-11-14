const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const jwt = require('jsonwebtoken');

const projectId = '11111111-1111-4111-8111-111111111111';
const instalacionA = '22222222-2222-4222-8222-222222222222';
const instalacionB = '33333333-3333-4333-8333-333333333333';
const instalacionC = '44444444-4444-4444-8444-444444444444';
const tokenA = 'ExpoPushToken[abc123]';
const tokenB = 'ExpoPushToken[def456]';
const tokenC = 'ExpoPushToken[ghi789]';
const personas = new Map([[1, { sesion_version: 0 }], [2, { sesion_version: 0 }]]);
const dispositivos = new Map();
const consultas = [];
let siguienteId = 1;

const pool = {
  async query(sql, params) {
    consultas.push({ sql, params });
    if (sql.includes('FROM inquilinos')) {
      const persona = personas.get(params[0]);
      return { rows: persona ? [{ id_inquilino: params[0], ...persona }] : [] };
    }
    if (sql.includes('UPDATE push_dispositivos')) {
      const row = dispositivos.get(params[0]);
      if (row && row.id_inquilino === params[1] && row.activo) row.activo = false;
      return { rowCount: row && !row.activo ? 1 : 0 };
    }
    throw new Error('Consulta no prevista');
  },
  async connect() {
    return {
      async query(sql, params) {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
        if (sql.includes('FROM inquilinos')) return pool.query(sql, params);
        if (sql.includes('INSERT INTO push_dispositivos')) {
          consultas.push({ sql, params });
          const [idInquilino, instalacionId, expoToken, idProyecto,
            plataforma, sesionVersion] = params;
          const otroToken = [...dispositivos.values()].find((d) =>
            d.activo && d.expo_push_token === expoToken &&
            d.instalacion_id !== instalacionId);
          if (otroToken) throw Object.assign(new Error('conflicto'), { code: '23505' });
          const previo = dispositivos.get(instalacionId);
          if (previo?.activo && previo.id_inquilino !== idInquilino) {
            return { rows: [] };
          }
          const row = {
            id_push_dispositivo: previo?.activo ? previo.id_push_dispositivo : siguienteId++,
            id_inquilino: idInquilino,
            instalacion_id: instalacionId,
            expo_push_token: expoToken,
            expo_project_id: idProyecto,
            plataforma,
            sesion_version_registro: sesionVersion,
            activo: true,
          };
          dispositivos.set(instalacionId, row);
          return { rows: [{ id_push_dispositivo: row.id_push_dispositivo,
            instalacion_id: instalacionId, plataforma }] };
        }
        throw new Error('Consulta no prevista');
      },
      release() {},
    };
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  return originalLoad.call(this, request, parent, isMain);
};
const { verificarToken } = require('../middleware/authMiddleware');
const { registrarDispositivo, desactivarDispositivo } =
  require('../controllers/pushDispositivosController');
Module._load = originalLoad;

const respuesta = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  end() { this.ended = true; return this; },
});
const body = (instalacionId = instalacionA, expoToken = tokenA) => ({
  instalacion_id: instalacionId,
  expo_push_token: expoToken,
  plataforma: 'android',
  expo_project_id: projectId,
});
const sesion = (id, version = 0) => jwt.sign(
  { id_inquilino: id, sesion_version: version, rol: 'inquilino' },
  process.env.JWT_SECRET, { algorithm: 'HS256' }
);
const autenticar = async (id, version = 0) => {
  const req = { headers: { authorization: `Bearer ${sesion(id, version)}` } };
  const res = respuesta();
  await verificarToken(req, res, () => { res.next = true; });
  return { req, res };
};

test.before(() => {
  process.env.JWT_SECRET = 'test-only-secret-not-production';
  process.env.EXPO_PROJECT_ID = projectId;
});

test('JWT ausente o con versión anterior no autoriza el dispositivo', async () => {
  const sinToken = respuesta();
  await verificarToken({ headers: {} }, sinToken, () => {});
  assert.equal(sinToken.statusCode, 401);
  personas.get(1).sesion_version = 1;
  const { res } = await autenticar(1, 0);
  assert.equal(res.statusCode, 401);
  personas.get(1).sesion_version = 0;
});

test('registro idempotente y rotación conservan el mismo dispositivo', async () => {
  const { req, res: auth } = await autenticar(1);
  assert.equal(auth.next, true);
  req.body = body();
  const primero = respuesta();
  await registrarDispositivo(req, primero);
  assert.equal(primero.statusCode, 200);
  assert.equal(primero.body.dispositivo.expo_push_token, undefined);
  const id = primero.body.dispositivo.id_push_dispositivo;
  await registrarDispositivo(req, respuesta());
  req.body = body(instalacionA, tokenB);
  await registrarDispositivo(req, respuesta());
  assert.equal(dispositivos.get(instalacionA).id_push_dispositivo, id);
  assert.equal(dispositivos.get(instalacionA).expo_push_token, tokenB);
  assert.equal(dispositivos.size, 1);
});

test('un inquilino puede mantener varias instalaciones activas', async () => {
  const { req } = await autenticar(1);
  req.body = body(instalacionB, tokenA);
  const res = respuesta();
  await registrarDispositivo(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(dispositivos.get(instalacionA).activo, true);
  assert.equal(dispositivos.get(instalacionB).activo, true);
  assert.equal(dispositivos.get(instalacionB).id_inquilino, 1);
});

test('rechaza campos ajenos, proyecto distinto y tokens inválidos', async () => {
  const { req } = await autenticar(1);
  for (const invalido of [
    { ...body(), id_inquilino: 2 },
    { ...body(), expo_project_id: instalacionB },
    { ...body(), expo_push_token: 'token-invalido' },
    { ...body(), plataforma: 'web' },
    { ...body(), instalacion_id: 'otro' },
  ]) {
    req.body = invalido;
    const res = respuesta();
    await registrarDispositivo(req, res);
    assert.equal(res.statusCode, 400);
  }
});

test('impide reclamar la instalación o token activo de otro inquilino', async () => {
  const { req } = await autenticar(2);
  req.body = body(instalacionA, tokenA);
  const instalacionOcupada = respuesta();
  await registrarDispositivo(req, instalacionOcupada);
  assert.equal(instalacionOcupada.statusCode, 409);

  req.body = body(instalacionC, tokenB);
  const tokenOcupado = respuesta();
  await registrarDispositivo(req, tokenOcupado);
  assert.equal(tokenOcupado.statusCode, 409);
  assert.equal(dispositivos.get(instalacionA).id_inquilino, 1);
});

test('recomprueba la versión dentro de la transacción', async () => {
  const { req } = await autenticar(1);
  personas.get(1).sesion_version = 1;
  req.body = body(instalacionC, tokenC);
  const res = respuesta();
  await registrarDispositivo(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(dispositivos.has(instalacionC), false);
  personas.get(1).sesion_version = 0;
});

test('logout desactiva solo la instalación propia y permite reactivarla', async () => {
  const { req: otro } = await autenticar(2);
  otro.params = { instalacionId: instalacionA };
  const ajeno = respuesta();
  await desactivarDispositivo(otro, ajeno);
  assert.equal(ajeno.statusCode, 204);
  assert.equal(dispositivos.get(instalacionA).activo, true);

  const { req: propio } = await autenticar(1);
  propio.params = { instalacionId: instalacionA };
  const baja = respuesta();
  await desactivarDispositivo(propio, baja);
  assert.equal(baja.statusCode, 204);
  assert.equal(dispositivos.get(instalacionA).activo, false);

  otro.body = body(instalacionA, tokenC);
  const alta = respuesta();
  await registrarDispositivo(otro, alta);
  assert.equal(alta.statusCode, 200);
  assert.equal(dispositivos.get(instalacionA).id_inquilino, 2);
  assert.match(consultas.at(-1).sql, /ON CONFLICT \(instalacion_id\) WHERE activo/);
});
