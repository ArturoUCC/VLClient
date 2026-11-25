const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

let reservada = false;
let bloqueo = false;
let liberar;
let avisos = 0;
let citas = 0;
let fallaAviso = false;
let fechaHabilitada = true;
let horarioHabilitado = true;
const pool = { connect: async () => {
  let nueva = false;
  return { async query(sql, params = []) {
    if (sql === 'BEGIN') return { rows: [] };
    if (sql === 'COMMIT' || sql === 'ROLLBACK') {
      if (sql === 'COMMIT' && nueva) { reservada = true; citas += 1; avisos += 1; }
      nueva = false;
      if (bloqueo) { bloqueo = false; liberar?.(); }
      return { rows: [] };
    }
    if (sql.includes('FROM fechas_citas')) return { rows: [{ habilitada: fechaHabilitada }] };
    if (sql.includes('FROM horarios_citas')) {
      while (bloqueo) await new Promise((resolve) => { liberar = resolve; });
      bloqueo = true;
      return { rows: horarioHabilitado ? [{ id_horario: 12 }] : [] };
    }
    if (sql.includes('SELECT 1 FROM reservas_citas')) {
      return { rows: reservada ? [{ id_cita: 9 }] : [] };
    }
    if (sql.includes('FROM reportes r')) {
      return { rows: params[1] === 1 ? [{ id_reporte: 4 }] : [] };
    }
    if (sql.includes('FROM citas') && sql.includes('id_reporte')) {
      return { rows: reservada ? [{ id_cita: 9 }] : [] };
    }
    if (sql.includes('INSERT INTO citas')) {
      nueva = true;
      return { rows: [{ id_cita: 9, id_reporte: 4, estado: 'programada' }] };
    }
    if (sql.includes('INSERT INTO reservas_citas')) return { rows: [] };
    if (sql.includes('INSERT INTO notificaciones')) {
      if (fallaAviso) throw new Error('Fallo simulado');
      return { rows: [] };
    }
    throw new Error('Consulta inesperada');
  }, release() {} };
} };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && /citasController\.js$/.test(parent?.filename || '')) {
    return pool;
  }
  if (request === '../services/notificacionesService') return {};
  return originalLoad.call(this, request, parent, isMain);
};
let crearCita;
try { ({ crearCita } = require('../controllers/citasController')); }
finally { Module._load = originalLoad; }
const respuesta = () => ({ statusCode: 200,
  status(n) { this.statusCode = n; return this; },
  json(v) { this.body = v; return this; } });
const solicitar = async (inquilino = 1) => {
  const res = respuesta();
  await crearCita({ usuario: { id_inquilino: inquilino }, body: {
    id_reporte: 4, fecha_cita: '2099-12-10', hora_cita: '10:00',
    observaciones: '',
  } }, res);
  return res;
};
const reiniciar = () => { reservada = false; bloqueo = false;
  avisos = 0; citas = 0; fallaAviso = false;
  fechaHabilitada = true; horarioHabilitado = true; };

test('dos reservas simultáneas confirman una sola cita y un solo aviso', async () => {
  reiniciar();
  const [a, b] = await Promise.all([solicitar(), solicitar()]);
  assert.deepEqual([a.statusCode, b.statusCode].sort(), [201, 409]);
  assert.equal(citas, 1); assert.equal(avisos, 1);
});

test('un inquilino ajeno no puede reservar para el reporte de otro', async () => {
  reiniciar();
  assert.equal((await solicitar(2)).statusCode, 404);
  assert.equal(citas, 0);
});

test('si falla la notificación se revierte la cita y la reserva', async () => {
  reiniciar(); fallaAviso = true;
  assert.equal((await solicitar()).statusCode, 500);
  assert.equal(citas, 0); assert.equal(avisos, 0); assert.equal(reservada, false);
});

test('una fecha o un horario no habilitados se rechazan antes del INSERT', async () => {
  reiniciar(); fechaHabilitada = false;
  assert.equal((await solicitar()).statusCode, 409);
  assert.equal(citas, 0);
  reiniciar(); horarioHabilitado = false;
  assert.equal((await solicitar()).statusCode, 409);
  assert.equal(citas, 0);
});
