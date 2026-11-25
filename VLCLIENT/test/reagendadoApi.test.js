const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');
const { evaluarResultadoReagendado } = require('../src/services/resultadoReagendado');

const ruta = path.resolve(__dirname, '../src/services/api.js');
const codigo = babel.transformSync(fs.readFileSync(ruta, 'utf8'), {
  babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'expo-file-system') return { File: class {} };
  if (request === 'expo/fetch') return { fetch: () => { throw new Error('No se espera una carga de archivo'); } };
  if (request === './sesionHttp') return {
    comprobarSesion: (response) => response,
    configurarManejadorSesionExpirada: () => {},
  };
  return originalLoad.call(this, request, parent, isMain);
};
let api;
try {
  const modulo = new Module(ruta, module);
  modulo.filename = ruta;
  modulo.paths = module.paths;
  modulo._compile(codigo, ruta);
  api = modulo.exports;
} finally {
  Module._load = originalLoad;
}

const cita = (cambios = {}) => ({
  id_cita: 6, fecha_cita: '2026-12-10', hora_cita: '10:00',
  estado: 'programada', reagendado_estado: 'utilizado',
  reagendado_usado_at: '2026-11-25T12:00:00.000Z', ...cambios,
});

test('el formulario envía el POST con el objeto de reagendado, sin intentar llamarlo', async () => {
  const originalFetch = global.fetch;
  const llamadas = [];
  global.fetch = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return { ok: true, status: 200, json: async () => ({ cita: cita() }) };
  };
  try {
    const datos = { id_notificacion: 9, fecha_cita: '2026-12-10', hora_cita: '10:00' };
    const respuesta = await api.reagendarCita('jwt-simulado', 6, datos);
    assert.equal(respuesta.cita.reagendado_estado, 'utilizado');
    assert.equal(llamadas.length, 1);
    assert.match(llamadas[0].url, /\/api\/citas\/6\/reagendar$/);
    assert.equal(llamadas[0].opciones.method, 'POST');
    assert.deepEqual(JSON.parse(llamadas[0].opciones.body), datos);
  } finally {
    global.fetch = originalFetch;
  }
});

test('una respuesta HTTP rechazada conserva el estado para distinguirla de la pérdida de respuesta', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 409,
    json: async () => ({ mensaje: 'Horario ocupado' }) });
  try {
    await assert.rejects(api.reagendarCita('jwt-simulado', 6, {}),
      (error) => error.status === 409 && error.message === 'Horario ocupado');
  } finally {
    global.fetch = originalFetch;
  }
});

test('una respuesta de éxito incorrecta exige consultar el estado real', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200,
    json: async () => ({ cita: cita({ id_cita: 7 }) }) });
  try {
    await assert.rejects(api.reagendarCita('jwt-simulado', 6, {}),
      /No se pudo verificar la respuesta/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('si se pierde la respuesta del POST, un GET propio confirma el cambio sin otro POST', async () => {
  const originalFetch = global.fetch;
  const llamadas = [];
  global.fetch = async (url) => {
    llamadas.push(url);
    if (url.endsWith('/reagendar')) throw new Error('Conexión interrumpida');
    return { ok: true, status: 200, json: async () => ({ citas: [cita()] }) };
  };
  try {
    await assert.rejects(api.reagendarCita('jwt-simulado', 6, {
      id_notificacion: 9, fecha_cita: '2026-12-10', hora_cita: '10:00',
    }), /Conexión interrumpida/);
    const citas = await api.obtenerMisCitas('jwt-simulado');
    assert.equal(evaluarResultadoReagendado(citas, 6,
      '2026-12-10', '10:00').estado, 'confirmado');
    assert.equal(llamadas.filter((url) => url.endsWith('/reagendar')).length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('tras perder la respuesta, el horario confirmado se reconoce por una lectura autenticada', () => {
  assert.equal(evaluarResultadoReagendado([cita()], 6, '2026-12-10', '10:00').estado,
    'confirmado');
  assert.equal(evaluarResultadoReagendado([cita()], 6, '2026-12-11', '10:00').estado,
    'oportunidad_utilizada');
  assert.equal(evaluarResultadoReagendado([cita({
    reagendado_estado: 'solicitado', reagendado_usado_at: null,
  })], 6, '2026-12-10', '10:00').estado, 'todavia_solicitado');
  assert.equal(evaluarResultadoReagendado([cita({ id_cita: 7 })], 6,
    '2026-12-10', '10:00').estado, 'sin_confirmacion');
});
