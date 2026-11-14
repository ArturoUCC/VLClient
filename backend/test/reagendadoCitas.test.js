const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

let cita;
let bloqueada = false;
let desbloquear;
let actualizaciones;
let horarioOcupado;
let consultaBloqueo;
let notificaciones;
let fallaAviso;

const pool = {
  connect: async () => {
    let cambioPendiente;
    let avisoPendiente;
    return {
    async query(sql, params = []) {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'COMMIT' || sql === 'ROLLBACK') {
        if (sql === 'COMMIT' && cambioPendiente) {
          cita = cambioPendiente;
          actualizaciones++;
          notificaciones.push(avisoPendiente);
        }
        cambioPendiente = undefined;
        avisoPendiente = undefined;
        if (bloqueada) {
          bloqueada = false;
          desbloquear?.();
        }
        return { rows: [] };
      }
      if (sql.includes('FOR UPDATE OF ci')) {
        consultaBloqueo = sql;
        while (bloqueada) await new Promise((resolve) => { desbloquear = resolve; });
        bloqueada = true;
        if (params[1] !== 1 || params[2] !== 20 || params[0] !== 6) {
          return { rows: [] };
        }
        return { rows: [{ ...cita }] };
      }
      if (sql.includes('UPDATE citas')) {
        if (horarioOcupado) {
          const error = new Error('unique violation');
          error.code = '23505';
          throw error;
        }
        cambioPendiente = {
          ...cita, fecha_cita: params[0], hora_cita: params[1],
          estado: 'programada', reagendado_estado: 'utilizado',
          reagendado_usado_at: new Date(),
        };
        return { rows: [{ ...cambioPendiente }] };
      }
      if (sql.includes('INSERT INTO notificaciones')) {
        if (fallaAviso) throw new Error('Fallo de inserción simulado');
        avisoPendiente = { sql, params };
        return { rows: [], rowCount: 1 };
      }
      throw new Error('Consulta inesperada');
    },
    release() {},
  };
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  if (request === '../services/notificacionesService') {
    return { crearNotificacionSegura: async () => {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { reagendarCita } = require('../controllers/citasController');
Module._load = originalLoad;

const respuesta = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const solicitud = (idInquilino = 1, idNotificacion = 20) => ({
  usuario: { id_inquilino: idInquilino },
  params: { idCita: '6' },
  body: {
    id_notificacion: idNotificacion,
    fecha_cita: '2099-05-20',
    hora_cita: '10:00',
  },
});
const reiniciar = () => {
  cita = {
    id_cita: 6, id_reporte: 3, fecha_cita: '2099-05-19',
    hora_cita: '09:00', estado: 'confirmada',
    reagendado_estado: 'solicitado', reagendado_usado_at: null,
  };
  actualizaciones = 0;
  horarioOcupado = false;
  bloqueada = false;
  notificaciones = [];
  fallaAviso = false;
};

test('solo el inquilino propietario con la notificación vinculada puede reagendar', async () => {
  reiniciar();
  const ajeno = respuesta();
  await reagendarCita(solicitud(2), ajeno);
  assert.equal(ajeno.statusCode, 404);
  assert.match(consultaBloqueo, /JOIN reportes r ON r\.id_reporte = ci\.id_reporte/);
  assert.match(consultaBloqueo, /JOIN contratos c ON c\.id_contrato = r\.id_contrato/);
  assert.match(consultaBloqueo, /c\.id_inquilino = \$2/);
  assert.match(consultaBloqueo, /n\.id_notificacion = \$3 AND n\.id_inquilino = \$2/);
  assert.match(consultaBloqueo, /n\.accion_tipo = 'reagendar_cita'/);
  const avisoAjeno = respuesta();
  await reagendarCita(solicitud(1, 99), avisoAjeno);
  assert.equal(avisoAjeno.statusCode, 404);
  assert.equal(actualizaciones, 0);
  const valido = respuesta();
  await reagendarCita(solicitud(), valido);
  assert.equal(valido.statusCode, 200);
  assert.equal(valido.body.cita.estado, 'programada');
  assert.equal(valido.body.cita.reagendado_estado, 'utilizado');
  assert.equal(actualizaciones, 1);
  assert.equal(notificaciones.length, 1);
  assert.deepEqual(notificaciones[0].params, [
    1,
    'Cita reagendada correctamente',
    'Tu cita #6 fue reagendada para el 2099-05-20 a las 10:00. ' +
      'El nuevo horario está pendiente de confirmación administrativa.',
  ]);
  assert.match(notificaciones[0].sql, /'cita', NULL, NULL/);
});

test('dos solicitudes simultáneas solo actualizan la cita una vez', async () => {
  reiniciar();
  const primera = respuesta();
  const segunda = respuesta();
  await Promise.all([
    reagendarCita(solicitud(), primera),
    reagendarCita(solicitud(), segunda),
  ]);
  assert.deepEqual([primera.statusCode, segunda.statusCode].sort(), [200, 409]);
  assert.equal(actualizaciones, 1);
  assert.equal(notificaciones.length, 1);
});

test('la notificación antigua no permite un segundo cambio', async () => {
  reiniciar();
  const primera = respuesta();
  await reagendarCita(solicitud(), primera);
  const segunda = respuesta();
  await reagendarCita(solicitud(), segunda);
  assert.equal(segunda.statusCode, 409);
  assert.equal(actualizaciones, 1);
  assert.equal(notificaciones.length, 1);
});

test('un horario ocupado revierte el reagendado', async () => {
  reiniciar();
  horarioOcupado = true;
  const res = respuesta();
  await reagendarCita(solicitud(), res);
  assert.equal(res.statusCode, 409);
  assert.equal(cita.reagendado_estado, 'solicitado');
  assert.equal(actualizaciones, 0);
  assert.equal(notificaciones.length, 0);
});

test('si falla el aviso se revierte también el cambio de horario', async () => {
  reiniciar();
  fallaAviso = true;
  const res = respuesta();
  await reagendarCita(solicitud(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(cita.fecha_cita, '2099-05-19');
  assert.equal(cita.reagendado_estado, 'solicitado');
  assert.equal(actualizaciones, 0);
  assert.equal(notificaciones.length, 0);
});

test('rechaza fecha inválida, horario pasado y cita sin solicitud', async () => {
  reiniciar();
  const invalida = solicitud();
  invalida.body.fecha_cita = '2099-02-30';
  const res = respuesta();
  await reagendarCita(invalida, res);
  assert.equal(res.statusCode, 400);
  const pasada = solicitud();
  pasada.body.fecha_cita = '2020-01-01';
  const resPasada = respuesta();
  await reagendarCita(pasada, resPasada);
  assert.equal(resPasada.statusCode, 400);
  cita.reagendado_estado = 'sin_solicitud';
  const sinSolicitud = respuesta();
  await reagendarCita(solicitud(), sinSolicitud);
  assert.equal(sinSolicitud.statusCode, 409);
  assert.equal(actualizaciones, 0);
});
