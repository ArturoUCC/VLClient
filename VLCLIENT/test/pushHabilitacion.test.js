const test = require('node:test');
const assert = require('node:assert/strict');
const configuracion = require('../app.json');
const { estaHabilitadoPushRemoto } = require('../src/services/pushHabilitacion');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

test('la primera versión mantiene desactivado el registro push remoto', () => {
  assert.equal(configuracion.expo.extra.pushRemotoHabilitado, false);
  assert.equal(estaHabilitadoPushRemoto(configuracion.expo.extra), false);
  assert.equal(estaHabilitadoPushRemoto({}), false);
  assert.equal(estaHabilitadoPushRemoto({ pushRemotoHabilitado: true }), true);
  assert.equal(configuracion.expo.android.package, undefined);
  assert.equal(configuracion.expo.ios.bundleIdentifier, undefined);
});

test('el login no pide permiso ni registra token mientras push esté aplazado', async () => {
  let solicitudes = 0;
  const ruta = path.resolve(__dirname, '../src/services/pushDispositivo.js');
  const codigo = babel.transformSync(fs.readFileSync(ruta, 'utf8'), {
    babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'react-native') return { Platform: { OS: 'android' } };
    if (request === 'expo-constants') return {
      appOwnership: 'standalone', expoConfig: configuracion.expo,
    };
    if (request === 'expo-crypto') return { randomUUID: () => 'uuid' };
    if (request === 'expo-notifications') return {
      getPermissionsAsync: async () => { solicitudes++; return { granted: true }; },
      getExpoPushTokenAsync: async () => { solicitudes++; return { data: 'token' }; },
    };
    if (request === 'expo-secure-store') return {
      getItemAsync: async () => { solicitudes++; return null; },
    };
    if (request === './api') return {
      registrarDispositivoPush: async () => { solicitudes++; },
      desactivarDispositivoPush: async () => { solicitudes++; },
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const modulo = new Module(ruta, module);
    modulo.filename = ruta;
    modulo.paths = module.paths;
    modulo._compile(codigo, ruta);
    assert.equal(await modulo.exports.registrarPushTrasLogin('jwt-de-prueba'),
      'no_disponible');
    assert.equal(solicitudes, 0);
  } finally {
    Module._load = originalLoad;
  }
});
