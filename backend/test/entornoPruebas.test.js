const test = require('node:test');
const assert = require('node:assert/strict');
const { HOST_PRUEBAS, validarDatabaseUrlPruebas,
  crearEntornoAislado, afirmarProcesoPruebas } = require('../config/entornoPruebas');
const { bloquearExternosPruebas } = require('../middleware/bloquearExternosPruebas');
const { enviarRecuperacion } = require('../services/correoRecuperacionService');
const { enviarLoteExpo } = require('../services/expoPushService');

const url = `postgresql://usuario:ficticia@${HOST_PRUEBAS}/neondb?sslmode=require&channel_binding=require`;
const variables = { DATABASE_URL: url, JWT_SECRET: 'a'.repeat(64),
  ADMIN_JWT_SECRET: 'b'.repeat(64), RECOVERY_RATE_LIMIT_SECRET: 'c'.repeat(64) };

test('solo se admite el hostname exacto de la rama aislada', () => {
  assert.equal(validarDatabaseUrlPruebas(url), true);
  for (const otro of [
    url.replace(HOST_PRUEBAS, `${HOST_PRUEBAS}.evil.example`),
    url.replace(HOST_PRUEBAS, 'ep-sparkling-waterfall-b4gyj26e.otro.neon.tech'),
    url.replace('/neondb?', '/neondb?host=produccion&'),
    url.replace('sslmode=require', 'sslmode=disable'),
    url.replace('postgresql:', 'https:'),
  ]) assert.throws(() => validarDatabaseUrlPruebas(otro));
});

test('el proceso hijo no hereda credenciales externas de producción', () => {
  const origen = { PATH: 'ruta-sistema', DATABASE_URL: 'produccion',
    JWT_SECRET: 'produccion', RESEND_API_KEY: 'produccion',
    CLOUDINARY_API_SECRET: 'produccion', EXPO_ACCESS_TOKEN: 'produccion',
    NODE_OPTIONS: '--require produccion', PORT: '9000' };
  const entorno = crearEntornoAislado(variables, origen);
  assert.deepEqual(Object.keys(entorno).sort(),
    ['PATH', 'DATABASE_URL', 'JWT_SECRET', 'ADMIN_JWT_SECRET',
      'RECOVERY_RATE_LIMIT_SECRET', 'PORT', 'VLCLIENT_TEST_MODE',
      'PUSH_REMOTE_ENABLED'].sort());
  assert.equal(entorno.PORT, '3000');
  assert.equal(new URL(entorno.DATABASE_URL).hostname, HOST_PRUEBAS);
  assert.equal(new URL(entorno.DATABASE_URL).searchParams.get('sslmode'),
    'verify-full');
  assert.equal(new URL(url).searchParams.get('sslmode'), 'require');
  assert.doesNotThrow(() => afirmarProcesoPruebas(entorno));
  assert.throws(() => afirmarProcesoPruebas({ ...entorno, DATABASE_URL: url }));
  assert.throws(() => afirmarProcesoPruebas({ ...entorno,
    RESEND_API_KEY: 'credencial-de-produccion' }));
  assert.throws(() => crearEntornoAislado({ ...variables,
    CLOUDINARY_API_KEY: 'credencial-de-produccion' }, origen));
});

test('el modo pruebas responde 503 antes de una operación externa', () => {
  const previo = process.env.VLCLIENT_TEST_MODE;
  process.env.VLCLIENT_TEST_MODE = '1';
  let siguio = false;
  const res = { status(n) { this.codigo = n; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; } };
  try {
    bloquearExternosPruebas({}, res, () => { siguio = true; });
    assert.equal(res.codigo, 503);
    assert.equal(siguio, false);
  } finally {
    if (previo === undefined) delete process.env.VLCLIENT_TEST_MODE;
    else process.env.VLCLIENT_TEST_MODE = previo;
  }
});

test('Resend y Expo rechazan antes de contactar servicios externos', async () => {
  const previo = process.env.VLCLIENT_TEST_MODE;
  process.env.VLCLIENT_TEST_MODE = '1';
  let contactos = 0;
  const fetchSimulado = async () => { contactos++; throw new Error('No permitido'); };
  try {
    await assert.rejects(enviarRecuperacion('persona@example.test', 'ficticio'));
    await assert.rejects(enviarLoteExpo([{ to: 'ExpoPushToken[ficticio]' }],
      { fetchImpl: fetchSimulado }));
    assert.equal(contactos, 0);
  } finally {
    if (previo === undefined) delete process.env.VLCLIENT_TEST_MODE;
    else process.env.VLCLIENT_TEST_MODE = previo;
  }
});

test('Cloudinary en pruebas no carga el cliente externo ni simula un upload', () => {
  const previo = process.env.VLCLIENT_TEST_MODE;
  process.env.VLCLIENT_TEST_MODE = '1';
  const ruta = require.resolve('../config/cloudinary');
  delete require.cache[ruta];
  try {
    const cloudinary = require('../config/cloudinary');
    assert.throws(() => cloudinary.uploader.upload_stream());
    assert.throws(() => cloudinary.api.resource());
  } finally {
    delete require.cache[ruta];
    if (previo === undefined) delete process.env.VLCLIENT_TEST_MODE;
    else process.env.VLCLIENT_TEST_MODE = previo;
  }
});
