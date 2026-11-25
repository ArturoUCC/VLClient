const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

const base = path.resolve(__dirname, '../src');
const codigoPantalla = fs.readFileSync(path.join(base, 'screens/LoginScreen.js'), 'utf8');
test('la pantalla usa un solo formulario sin selector de rol', () => {
  assert.match(codigoPantalla, /autenticar\(correo\.trim\(\), password\)/);
  assert.doesNotMatch(codigoPantalla, /tipoCuenta|loginAdministrador\(/);
  assert.match(codigoPantalla, /respuesta\.rol === 'administrador'/);
});

test('la sesión persistida distingue roles y el cierre elimina el token', async () => {
  const ruta = path.join(base, 'services/sesionPersistida.js');
  const codigo = babel.transformSync(fs.readFileSync(ruta, 'utf8'), {
    babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  let almacenado = null;
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'expo-secure-store') return {
      setItemAsync: async (_, valor) => { almacenado = valor; },
      getItemAsync: async () => almacenado,
      deleteItemAsync: async () => { almacenado = null; },
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  let sesion;
  try {
    const modulo = new Module(ruta, module);
    modulo.filename = ruta; modulo.paths = module.paths;
    modulo._compile(codigo, ruta); sesion = modulo.exports;
  } finally { Module._load = originalLoad; }
  await sesion.guardarSesion('token-simulado', 'administrador');
  assert.deepEqual(await sesion.leerSesion(), {
    token: 'token-simulado', rol: 'administrador',
  });
  await sesion.borrarSesion();
  assert.equal(await sesion.leerSesion(), null);
  await assert.rejects(sesion.guardarSesion('otro', 'desconocido'));
});
