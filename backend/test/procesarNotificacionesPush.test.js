const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return {};
  return originalLoad.call(this, request, parent, isMain);
};
const job = require('../jobs/procesarNotificacionesPush');
Module._load = originalLoad;
const { enviarLoteExpo, consultarRecibosExpo } = require('../services/expoPushService');

const PROJECT = 'adb5f587-2df0-49f7-9b40-c04c6bd4944e';

const baseDistribucion = () => {
  const avisos = [{ id_notificacion: 10, id_inquilino: 1,
    fecha_creacion: new Date('2026-11-15T12:00:00Z') }];
  const dispositivos = [
    { id_push_dispositivo: 1, id_inquilino: 1, activo: true,
      sesion_version_registro: 2, expo_project_id: PROJECT,
      fecha_registro: new Date('2026-11-14T12:00:00Z') },
    { id_push_dispositivo: 2, id_inquilino: 2, activo: true,
      sesion_version_registro: 0, expo_project_id: PROJECT,
      fecha_registro: new Date('2026-11-14T12:00:00Z') },
    { id_push_dispositivo: 3, id_inquilino: 1, activo: false,
      sesion_version_registro: 2, expo_project_id: PROJECT,
      fecha_registro: new Date('2026-11-14T12:00:00Z') },
    { id_push_dispositivo: 4, id_inquilino: 1, activo: true,
      sesion_version_registro: 1, expo_project_id: PROJECT,
      fecha_registro: new Date('2026-11-14T12:00:00Z') },
    { id_push_dispositivo: 5, id_inquilino: 1, activo: true,
      sesion_version_registro: 2, expo_project_id: PROJECT,
      fecha_registro: new Date('2026-11-16T12:00:00Z') },
  ];
  const outbox = [{ id_notificacion: 10, distribuido_at: null }];
  const envios = [];
  const bloqueados = new Set();
  const db = {
    async connect() {
      const propios = new Set();
      return {
        async query(sql, params) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            if (sql !== 'BEGIN') {
              for (const id of propios) bloqueados.delete(id);
            }
            return { rows: [] };
          }
          if (sql.includes('FROM push_notificaciones_outbox AS o') &&
              sql.includes('FOR UPDATE OF o SKIP LOCKED')) {
            const rows = outbox.filter((o) => !o.distribuido_at &&
              !bloqueados.has(o.id_notificacion)).slice(0, params[0]);
            for (const row of rows) {
              bloqueados.add(row.id_notificacion);
              propios.add(row.id_notificacion);
            }
            return { rows };
          }
          if (sql.includes('INSERT INTO push_envios')) {
            assert.match(sql, /d\.id_inquilino = n\.id_inquilino/);
            assert.match(sql, /d\.sesion_version_registro = i\.sesion_version/);
            assert.match(sql, /d\.activo = TRUE/);
            assert.match(sql, /d\.fecha_registro <= n\.fecha_creacion/);
            assert.match(sql, /ON CONFLICT \(id_notificacion, id_push_dispositivo\) DO NOTHING/);
            const antes = envios.length;
            for (const aviso of avisos.filter((n) => params[0].includes(n.id_notificacion))) {
              for (const dispositivo of dispositivos) {
                if (dispositivo.id_inquilino !== aviso.id_inquilino ||
                    !dispositivo.activo || dispositivo.sesion_version_registro !== 2 ||
                    dispositivo.expo_project_id !== params[1] ||
                    dispositivo.fecha_registro > aviso.fecha_creacion) continue;
                if (!envios.some((e) => e.id_notificacion === aviso.id_notificacion &&
                    e.id_push_dispositivo === dispositivo.id_push_dispositivo)) {
                  envios.push({ id_notificacion: aviso.id_notificacion,
                    id_inquilino: aviso.id_inquilino,
                    id_push_dispositivo: dispositivo.id_push_dispositivo });
                }
              }
            }
            return { rowCount: envios.length - antes };
          }
          if (sql.includes('UPDATE push_notificaciones_outbox')) {
            for (const o of outbox.filter((o) => params[0].includes(o.id_notificacion))) {
              o.distribuido_at = new Date();
            }
            return { rowCount: params[0].length };
          }
          throw new Error('Consulta de distribución inesperada');
        },
        release() {},
      };
    },
  };
  return { db, envios, outbox };
};

test('distribuye una vez y solo al dispositivo activo del propietario con sesión vigente', async () => {
  const { db, envios, outbox } = baseDistribucion();
  const resultados = await Promise.all([
    job.distribuirLote({ db, projectId: PROJECT }),
    job.distribuirLote({ db, projectId: PROJECT }),
  ]);
  assert.equal(resultados.reduce((s, r) => s + r.distribuidas, 0), 1);
  assert.deepEqual(envios, [{ id_notificacion: 10, id_inquilino: 1,
    id_push_dispositivo: 1 }]);
  assert.ok(outbox[0].distribuido_at);
  assert.deepEqual(await job.distribuirLote({ db, projectId: PROJECT }),
    { distribuidas: 0, envios_creados: 0 });
});

test('dry-run solo usa lectura y no llama a Expo', async () => {
  const consultas = [];
  const db = { async connect() { return {
    async query(sql) {
      consultas.push(sql);
      if (sql === 'BEGIN TRANSACTION READ ONLY' || sql === 'COMMIT') return {};
      if (sql.includes('FROM push_notificaciones_outbox')) return { rows: [
        { id_notificacion: 10, id_inquilino: 1, id_push_dispositivo: 1 }] };
      if (sql.includes('SELECT e.id_push_envio')) return { rows: [] };
      if (sql.includes('COUNT(*)::int')) return { rows: [{ total: 0 }] };
      throw new Error('Mutación en dry-run');
    }, release() {},
  }; } };
  const resultado = await job.simularPush({ db, projectId: PROJECT });
  assert.equal(resultado.distribucion[0].id_notificacion, 10);
  assert.equal(resultado.envios.length, 0);
  assert.equal(resultado.recibos_pendientes, 0);
  assert.equal(consultas[0], 'BEGIN TRANSACTION READ ONLY');
  assert.equal(consultas.at(-1), 'COMMIT');
  assert.ok(consultas.slice(1, -1).every((sql) => /^\s*SELECT/i.test(sql)));
  assert.ok(consultas.every((sql) => !sql.includes('expo_push_token')));
});

const baseEnvio = () => {
  const envio = { id_push_envio: 5, id_notificacion: 10, id_inquilino: 1,
    id_push_dispositivo: 1, intentos: 0, estado: 'pendiente',
    expo_push_token: 'ExpoPushToken[simulado]' };
  const dispositivo = { activo: true, expo_push_token: envio.expo_push_token };
  const consultas = [];
  const estadoTx = { abierta: false };
  const db = {
    async connect() { return {
      async query(sql, params) {
        consultas.push(sql);
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
          estadoTx.abierta = sql === 'BEGIN'; return {};
        }
        if (sql.includes("ultimo_error_codigo = 'ResultadoAmbiguo'")) return { rowCount: 0 };
        if (sql.includes("ultimo_error_codigo = 'DispositivoNoVigente'")) return { rowCount: 0 };
        if (sql.includes('FOR UPDATE OF e SKIP LOCKED')) {
          return { rows: envio.estado === 'pendiente' ? [{ ...envio }] : [] };
        }
        if (sql.includes("SET estado = 'en_proceso'")) {
          envio.estado = 'en_proceso'; envio.intentos++; return { rowCount: 1 };
        }
        if (sql.includes('SET estado = $2')) {
          assert.equal(envio.estado, 'en_proceso');
          envio.estado = params[1]; envio.ultimo_error_codigo = params[2];
          return { rowCount: 1, rows: [{ id_push_dispositivo: 1 }] };
        }
        if (sql.includes('UPDATE push_dispositivos')) {
          dispositivo.activo = false; return { rowCount: 1 };
        }
        throw new Error('Consulta de envío inesperada');
      }, release() {},
    }; },
    async query(sql, params) {
      consultas.push(sql);
      if (sql.includes('SELECT e.id_push_envio')) {
        return { rows: envio.estado === 'en_proceso' && dispositivo.activo
          ? [{ id_push_envio: 5, expo_push_token: dispositivo.expo_push_token }] : [] };
      }
      if (sql.includes("SET estado = 'aceptado'")) {
        envio.estado = 'aceptado'; envio.expo_ticket_id = params[1];
        return { rowCount: 1 };
      }
      throw new Error('Consulta externa inesperada');
    },
  };
  return { db, envio, dispositivo, consultas, estadoTx };
};

test('envía payload genérico, guarda ticket y no repite un envío aceptado', async () => {
  const { db, envio, estadoTx, consultas } = baseEnvio();
  const mensajes = [];
  const expo = { async enviarLoteExpo(lote) {
    assert.equal(estadoTx.abierta, false);
    mensajes.push(...lote);
    return [{ status: 'ok', id: 'ticket-1' }];
  } };
  const primero = await job.enviarPendientes({ db, expo, projectId: PROJECT });
  assert.equal(primero.aceptados, 1);
  assert.equal(envio.estado, 'aceptado');
  assert.equal(envio.expo_ticket_id, 'ticket-1');
  assert.deepEqual(mensajes[0].data, { id_notificacion: '10' });
  assert.equal(mensajes[0].title, 'Vives Lara');
  assert.ok(!JSON.stringify(mensajes[0]).includes('renta'));
  assert.ok(consultas.some((sql) => sql.includes('FOR UPDATE OF e SKIP LOCKED')));
  await job.enviarPendientes({ db, expo, projectId: PROJECT });
  assert.equal(mensajes.length, 1);
});

test('ticket DeviceNotRegistered desactiva token; rechazo transitorio reintenta con límite', async () => {
  const invalido = baseEnvio();
  invalido.envio.estado = 'en_proceso'; invalido.envio.intentos = 1;
  assert.equal(await job.finalizarEnvio({ db: invalido.db, trabajo: invalido.envio,
    ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } } }), 'fallido');
  assert.equal(invalido.dispositivo.activo, false);

  const transitorio = baseEnvio();
  transitorio.envio.estado = 'en_proceso'; transitorio.envio.intentos = 1;
  assert.equal(await job.finalizarEnvio({ db: transitorio.db, trabajo: transitorio.envio,
    ticket: { status: 'error', details: { error: 'TOO_MANY_REQUESTS' } } }), 'reintentar');
  assert.equal(transitorio.envio.estado, 'reintentar');
  transitorio.envio.estado = 'en_proceso'; transitorio.envio.intentos = 3;
  assert.equal(await job.finalizarEnvio({ db: transitorio.db, trabajo: transitorio.envio,
    ticket: { status: 'error', details: { error: 'TOO_MANY_REQUESTS' } } }), 'fallido');
});

test('timeout ambiguo no se reenvía', async () => {
  const { db, envio } = baseEnvio();
  const expo = { async enviarLoteExpo() {
    throw Object.assign(new Error('timeout'), { tipo: 'ambiguo' });
  } };
  const resumen = await job.enviarPendientes({ db, expo, projectId: PROJECT });
  assert.equal(resumen.fallidos, 1);
  assert.equal(envio.estado, 'fallido');
  assert.equal(envio.ultimo_error_codigo, 'ResultadoAmbiguo');
});

test('Expo usa lotes pequeños, timeout y procesa tickets/recibos simulados', async () => {
  const llamadas = [];
  const fetchImpl = async (url, options) => {
    llamadas.push({ url, options });
    if (url.endsWith('/send')) return { ok: true, status: 200,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }) };
    return { ok: true, status: 200,
      json: async () => ({ data: { 'ticket-1': { status: 'ok' } } }) };
  };
  const tickets = await enviarLoteExpo([{ to: 'ExpoPushToken[simulado]' }],
    { fetchImpl, accessToken: undefined });
  const recibos = await consultarRecibosExpo(['ticket-1'],
    { fetchImpl, accessToken: undefined });
  assert.equal(tickets[0].id, 'ticket-1');
  assert.equal(recibos['ticket-1'].status, 'ok');
  assert.equal(llamadas.length, 2);
  assert.ok(llamadas.every(({ options }) => options.signal));
  await assert.rejects(enviarLoteExpo(Array(101).fill({})), /Lote push inválido/);
  await assert.rejects(consultarRecibosExpo(Array(1001).fill('x')),
    /Lote de recibos inválido/);
  await assert.rejects(enviarLoteExpo([{}], { fetchImpl: async () =>
    ({ status: 429, ok: false }), accessToken: undefined }),
  (error) => error.tipo === 'reintentar');
  await assert.rejects(enviarLoteExpo([{}], { fetchImpl: async () =>
    ({ status: 503, ok: false }), accessToken: undefined }),
  (error) => error.tipo === 'ambiguo');
});

test('recibo confirma la entrega al proveedor o desactiva el dispositivo inválido', async () => {
  const estados = [];
  const db = { async connect() { return {
    async query(sql, params) {
      if (['BEGIN', 'COMMIT'].includes(sql)) return {};
      if (sql.includes('UPDATE push_envios SET estado = $2')) {
        estados.push(params[1]); return { rowCount: 1,
          rows: [{ id_push_dispositivo: 1 }] };
      }
      if (sql.includes('UPDATE push_dispositivos AS d')) {
        estados.push('dispositivo_desactivado'); return { rowCount: 1 };
      }
      throw new Error('Consulta de recibo inesperada');
    }, release() {},
  }; } };
  const trabajo = { id_push_envio: 5, id_push_dispositivo: 1,
    expo_ticket_id: 'ticket-1', intentos: 1 };
  assert.equal(await job.finalizarRecibo({ db, trabajo,
    recibo: { status: 'ok' } }), 'entregado');
  assert.equal(await job.finalizarRecibo({ db, trabajo,
    recibo: { status: 'error', details: { error: 'DeviceNotRegistered' } } }), 'fallido');
  assert.deepEqual(estados, ['entregado', 'fallido', 'dispositivo_desactivado']);
});

test('dos consultas de recibos simultáneas reservan el ticket una sola vez', async () => {
  let reservado = false;
  let estado = 'aceptado';
  let llamadasExpo = 0;
  const db = { async connect() { return {
    async query(sql, params) {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return {};
      if (sql.includes("ultimo_error_codigo = 'ReciboNoDisponible'")) return { rowCount: 0 };
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        if (reservado || estado !== 'aceptado') return { rows: [] };
        reservado = true;
        return { rows: [{ id_push_envio: 5, id_push_dispositivo: 1,
          id_notificacion: 10, id_inquilino: 1,
          expo_ticket_id: 'ticket-1', intentos: 1 }] };
      }
      if (sql.includes('SET bloqueo_hasta = NOW()')) {
        reservado = true; return { rowCount: 1 };
      }
      if (sql.includes('UPDATE push_envios SET estado = $2')) {
        estado = params[1]; return { rowCount: 1,
          rows: [{ id_push_dispositivo: 1 }] };
      }
      throw new Error('Consulta de recibos inesperada');
    }, release() {},
  }; } };
  const expo = { async consultarRecibosExpo(ids) {
    llamadasExpo++;
    assert.deepEqual(ids, ['ticket-1']);
    return { 'ticket-1': { status: 'ok' } };
  } };
  const resultados = await Promise.all([
    job.procesarRecibos({ db, expo }), job.procesarRecibos({ db, expo }),
  ]);
  assert.equal(llamadasExpo, 1);
  assert.equal(estado, 'entregado');
  assert.equal(resultados.reduce((s, r) => s + r.entregados, 0), 1);
});
