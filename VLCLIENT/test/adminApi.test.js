const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

const ruta = path.resolve(__dirname, '../src/services/api.js');
const codigo = babel.transformSync(fs.readFileSync(ruta, 'utf8'), {
  babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'expo-file-system') return { File: class {} };
  if (request === 'expo/fetch') return { fetch: () => { throw new Error('Sin archivos'); } };
  if (request === './sesionHttp') return {
    comprobarSesion: (respuesta) => respuesta,
    configurarManejadorSesionExpirada: () => {},
  };
  return originalLoad.call(this, request, parent, isMain);
};
let api;
try {
  const modulo = new Module(ruta, module);
  modulo.filename = ruta; modulo.paths = module.paths;
  modulo._compile(codigo, ruta); api = modulo.exports;
} finally { Module._load = originalLoad; }

test('login y operaciones administrativas usan rutas separadas y JWT en cabecera', async () => {
  const originalFetch = global.fetch;
  const llamadas = [];
  global.fetch = async (url, opciones) => {
    llamadas.push({ url, opciones });
    const data = url.endsWith('/auth/login') ?
      { token: 'jwt-de-prueba', administrador: { rol: 'administrador' } } :
      url.endsWith('/resumen') ? { resumen: { inquilinos_total: 2 } } : {};
    return { ok: true, status: 200, json: async () => data };
  };
  try {
    const login = await api.loginAdministrador('admin@ejemplo.test', 'Abcdef1!');
    assert.equal(login.administrador.rol, 'administrador');
    assert.match(llamadas[0].url, /\/api\/admin\/auth\/login$/);
    assert.deepEqual(Object.keys(JSON.parse(llamadas[0].opciones.body)).sort(),
      ['correo', 'password']);
    await api.obtenerResumenAdmin('jwt-de-prueba');
    assert.equal(llamadas[1].opciones.headers.Authorization, 'Bearer jwt-de-prueba');
    await api.cerrarSesionAdmin('jwt-de-prueba');
    assert.match(llamadas[2].url, /\/api\/admin\/auth\/logout$/);
    assert.equal(llamadas[2].opciones.method, 'POST');
  } finally { global.fetch = originalFetch; }
});

test('el formulario unificado envía solo credenciales y recibe el rol del servidor', async () => {
  const originalFetch = global.fetch;
  let llamada;
  global.fetch = async (url, opciones) => {
    llamada = { url, opciones };
    return { ok: true, status: 200, json: async () => ({
      token: 'jwt-simulado', rol: 'administrador',
      administrador: { id_administrador: 4 },
    }) };
  };
  try {
    const resultado = await api.iniciarSesion('admin@ejemplo.test', 'Clave123!');
    assert.equal(resultado.rol, 'administrador');
    assert.match(llamada.url, /\/api\/auth\/login$/);
    assert.deepEqual(Object.keys(JSON.parse(llamada.opciones.body)).sort(),
      ['correo', 'password']);
  } finally { global.fetch = originalFetch; }
});

test('alta administrativa envía contrato y credenciales solo al endpoint protegido', async () => {
  const originalFetch = global.fetch;
  let llamada;
  global.fetch = async (url, opciones) => {
    llamada = { url, opciones };
    return { ok: true, status: 201, json: async () => ({
      inquilino: { id_inquilino: 20 }, contrato: { id_contrato: 30 },
    }) };
  };
  try {
    const datos = { nombre: 'Ana', id_propiedad: 7, renta_acordada: '9500' };
    const resultado = await api.registrarInquilinoAdmin('jwt-de-prueba', datos);
    assert.equal(resultado.contrato.id_contrato, 30);
    assert.match(llamada.url, /\/api\/admin\/inquilinos$/);
    assert.equal(llamada.opciones.method, 'POST');
    assert.equal(llamada.opciones.headers.Authorization, 'Bearer jwt-de-prueba');
    assert.deepEqual(JSON.parse(llamada.opciones.body), datos);
  } finally { global.fetch = originalFetch; }
});
