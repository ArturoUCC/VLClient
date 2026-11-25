const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

let cita;
let avisos;
let acciones;
let fallaAviso;
const cliente = {
  async query(sql, params = []) {
    if (sql === 'BEGIN') {
      this.pendiente = { ...cita }; this.aviso = null; this.accion = null;
      return { rows: [] };
    }
    if (sql === 'ROLLBACK') return { rows: [] };
    if (sql === 'COMMIT') {
      cita = this.pendiente;
      if (this.aviso) avisos.push(this.aviso);
      if (this.accion) acciones.push(this.accion);
      return { rows: [] };
    }
    if (sql.includes('FOR UPDATE OF ci')) {
      return { rows: params[0] === 6 ? [{ ...this.pendiente }] : [] };
    }
    if (sql.includes('UPDATE citas SET estado')) this.pendiente.estado = 'confirmada';
    if (sql.includes("reagendado_estado='solicitado'")) {
      this.pendiente.reagendado_estado = 'solicitado';
    }
    if (sql.includes('segundo_horario_no_disponible_at=NOW()')) {
      this.pendiente.segundo_horario_no_disponible_at = new Date();
    }
    if (sql.includes('INSERT INTO notificaciones')) {
      if (fallaAviso) throw new Error('Fallo de notificación simulado');
      this.aviso = { params };
      return { rows: [{ id_notificacion: avisos.length + 1 }] };
    }
    if (sql.includes('INSERT INTO bitacora_administrativa')) this.accion = { params };
    return { rows: [] };
  }, release() {},
};
const pool = { connect: async () => cliente };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && /adminCitasController\.js$/.test(parent?.filename || '')) {
    return pool;
  }
  return originalLoad.call(this, request, parent, isMain);
};
let ejecutarAccion;
try { ({ ejecutarAccion } = require('../controllers/adminCitasController')); }
finally { Module._load = originalLoad; }

const respuesta = () => ({ codigo: 200,
  status(n) { this.codigo = n; return this; },
  json(body) { this.body = body; return this; } });
const ejecutar = async (accion) => {
  const res = respuesta();
  await ejecutarAccion({ params: { idCita: '6', accion },
    administrador: { id_administrador: 2 } }, res);
  return res;
};
const reiniciar = (cambios = {}) => {
  cita = { id_cita: 6, id_reporte: 3, id_inquilino: 1,
    fecha_cita: '2026-12-10', hora_cita: '09:00', estado: 'programada',
    reagendado_estado: 'sin_solicitud', reagendado_usado_at: null,
    segundo_horario_no_disponible_at: null, ...cambios };
  avisos = []; acciones = []; fallaAviso = false;
};

test('confirmar genera una sola notificación y bitácora; repetir no duplica', async () => {
  reiniciar();
  assert.equal((await ejecutar('confirmar')).codigo, 200);
  assert.equal(cita.estado, 'confirmada');
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].params[0], 1);
  assert.equal(avisos[0].params[3], null);
  assert.equal(avisos[0].params[4], null);
  assert.equal(acciones.length, 1);
  assert.equal((await ejecutar('confirmar')).codigo, 409);
  assert.equal(avisos.length, 1);
});

test('la solicitud de reagendamiento es única y vinculada a la cita', async () => {
  reiniciar({ estado: 'confirmada' });
  assert.equal((await ejecutar('solicitar-reagendado')).codigo, 200);
  assert.equal(cita.reagendado_estado, 'solicitado');
  assert.equal(avisos[0].params[3], 'reagendar_cita');
  assert.equal(avisos[0].params[4], 6);
  assert.equal((await ejecutar('solicitar-reagendado')).codigo, 409);
  assert.equal(avisos.length, 1);
});

test('segundo horario informa una sola vez sin alterar fecha ni oportunidad', async () => {
  reiniciar({ reagendado_estado: 'utilizado', reagendado_usado_at: new Date() });
  assert.equal((await ejecutar('segundo-horario-no-disponible')).codigo, 200);
  assert.equal(cita.fecha_cita, '2026-12-10');
  assert.equal(cita.reagendado_estado, 'utilizado');
  assert.equal(avisos[0].params[3], null);
  assert.equal(avisos[0].params[4], null);
  assert.equal((await ejecutar('segundo-horario-no-disponible')).codigo, 409);
  assert.equal(avisos.length, 1);
});

test('una solicitud de reagendado y un segundo horario rechazado bloquean confirmación', async () => {
  for (const cambios of [{ reagendado_estado: 'solicitado' },
    { reagendado_estado: 'utilizado', reagendado_usado_at: new Date(),
      segundo_horario_no_disponible_at: new Date() }]) {
    reiniciar(cambios);
    assert.equal((await ejecutar('confirmar')).codigo, 409);
    assert.equal(cita.estado, 'programada');
    assert.equal(avisos.length, 0);
  }
});

test('un fallo de aviso revierte también el cambio de estado', async () => {
  reiniciar(); fallaAviso = true;
  assert.equal((await ejecutar('confirmar')).codigo, 503);
  assert.equal(cita.estado, 'programada');
  assert.equal(avisos.length, 0);
});
