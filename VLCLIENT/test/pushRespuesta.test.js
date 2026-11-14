const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const archivo = path.join(__dirname, '..', 'src', 'services', 'pushRespuesta.js');
const codigo = babel.transformSync(fs.readFileSync(archivo, 'utf8'), {
  babelrc: false,
  configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const modulo = { exports: {} };
new Function('module', 'exports', codigo)(modulo, modulo.exports);
const { extraerIdNotificacion, claveInteraccion, consultarAvisoPropio } = modulo.exports;

const respuesta = (id, identificador = 'push-123') => ({
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  notification: {
    request: { identifier: identificador, content: { data: { id_notificacion: id } } },
  },
});

test('solo acepta un identificador de aviso válido, no contenido externo', () => {
  assert.equal(extraerIdNotificacion(respuesta('42')), 42);
  assert.equal(extraerIdNotificacion(respuesta(42)), 42);
  for (const invalido of [0, -1, '1e2', '4;DROP TABLE', '0', '1.5',
    '9007199254740992', null, undefined]) {
    assert.equal(extraerIdNotificacion(respuesta(invalido)), null);
  }
  assert.equal(extraerIdNotificacion({}), null);
});

test('la misma pulsación de arranque y listener produce una sola clave', () => {
  const aviso = respuesta('42');
  assert.equal(claveInteraccion(aviso, 42), claveInteraccion(aviso, 42));
  assert.notEqual(claveInteraccion(aviso, 42),
    claveInteraccion(respuesta('43', 'push-456'), 43));
});

test('consulta la API con sesión y solo admite avisos devueltos para ese inquilino', async () => {
  let consultados = 0;
  const consultar = async (token) => {
    assert.equal(token, 'jwt-simulado');
    consultados++;
    return { notificaciones: [{ id_notificacion: 42, titulo: 'Aviso propio' }] };
  };
  assert.equal((await consultarAvisoPropio('jwt-simulado', 42, consultar)).titulo,
    'Aviso propio');
  assert.equal(await consultarAvisoPropio('jwt-simulado', 99, consultar), null);
  assert.equal(await consultarAvisoPropio(null, 42, consultar), null);
  assert.equal(consultados, 2);
});

test('un JWT vencido o error de API no autoriza navegación', async () => {
  await assert.rejects(consultarAvisoPropio('vencido', 42, async () => {
    throw new Error('401');
  }), /401/);
});
