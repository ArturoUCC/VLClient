const pool = require('../config/db');
const { enviarLoteExpo, consultarRecibosExpo } = require('../services/expoPushService');

const TAM_LOTE = 100;
const MAX_LOTES = 10;
const MAX_INTENTOS = 3;
const TITULO = 'Vives Lara';
const CUERPO = 'Tienes una nueva notificación. Abre VLClient para consultarla.';
const TRANSITORIOS = new Set(['TOO_MANY_REQUESTS', 'MessageRateExceeded']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const envioRemotoHabilitado = (valor) => valor === 'true';

const comprobarProyecto = (projectId) => {
  if (!projectId || !UUID.test(projectId)) {
    throw new Error('Configura EXPO_PROJECT_ID antes de procesar push');
  }
  return projectId;
};

const transaccion = async (db, trabajo, soloLectura = false) => {
  const cliente = await db.connect();
  let abierta = false;
  try {
    await cliente.query(soloLectura ? 'BEGIN TRANSACTION READ ONLY' : 'BEGIN');
    abierta = true;
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    abierta = false;
    return resultado;
  } catch (error) {
    if (abierta) {
      try { await cliente.query('ROLLBACK'); } catch (_) { /* conservar error */ }
    }
    throw error;
  } finally {
    cliente.release();
  }
};

// Solo identificadores. La transacción de lectura prohíbe mutaciones accidentales.
const simularPush = async ({ db = pool, projectId = process.env.EXPO_PROJECT_ID } = {}) => {
  comprobarProyecto(projectId);
  return transaccion(db, async (cliente) => {
    const distribucion = await cliente.query(
      `SELECT o.id_notificacion, n.id_inquilino, d.id_push_dispositivo
       FROM push_notificaciones_outbox AS o
       JOIN notificaciones AS n ON n.id_notificacion = o.id_notificacion
       JOIN inquilinos AS i ON i.id_inquilino = n.id_inquilino AND i.activo = TRUE
       LEFT JOIN push_dispositivos AS d
         ON d.id_inquilino = n.id_inquilino AND d.activo = TRUE
        AND d.sesion_version_registro = i.sesion_version
        AND d.expo_project_id = $1::uuid
        AND d.fecha_registro <= n.fecha_creacion
       WHERE o.distribuido_at IS NULL
       ORDER BY o.encolado_at, o.id_notificacion, d.id_push_dispositivo
       LIMIT $2`,
      [projectId, TAM_LOTE]
    );
    const envios = await cliente.query(
      `SELECT e.id_push_envio, e.id_notificacion, e.id_inquilino,
              e.id_push_dispositivo, e.intentos
       FROM push_envios AS e
       JOIN push_dispositivos AS d
         ON d.id_push_dispositivo = e.id_push_dispositivo
        AND d.id_inquilino = e.id_inquilino
       JOIN inquilinos AS i ON i.id_inquilino = e.id_inquilino
       JOIN notificaciones AS n
         ON n.id_notificacion = e.id_notificacion
        AND n.id_inquilino = e.id_inquilino
       WHERE e.estado IN ('pendiente', 'reintentar')
         AND (e.proximo_intento_at IS NULL OR e.proximo_intento_at <= NOW())
         AND d.activo = TRUE AND i.activo = TRUE
         AND d.sesion_version_registro = i.sesion_version
         AND d.expo_project_id = $1::uuid
         AND d.fecha_registro <= n.fecha_creacion
       ORDER BY e.id_push_envio LIMIT $2`,
      [projectId, TAM_LOTE]
    );
    const recibos = await cliente.query(
      `SELECT COUNT(*)::int AS total FROM push_envios
       WHERE estado = 'aceptado' AND expo_ticket_id IS NOT NULL
         AND recibo_verificado_at IS NULL`
    );
    return { distribucion: distribucion.rows, envios: envios.rows,
      recibos_pendientes: recibos.rows[0].total };
  }, true);
};

const distribuirLote = async ({ db = pool, projectId = process.env.EXPO_PROJECT_ID } = {}) => {
  comprobarProyecto(projectId);
  return transaccion(db, async (cliente) => {
    const pendientes = await cliente.query(
      `SELECT o.id_notificacion
       FROM push_notificaciones_outbox AS o
       WHERE o.distribuido_at IS NULL
       ORDER BY o.encolado_at, o.id_notificacion
       LIMIT $1 FOR UPDATE OF o SKIP LOCKED`, [TAM_LOTE]
    );
    const ids = pendientes.rows.map((fila) => fila.id_notificacion);
    if (!ids.length) return { distribuidas: 0, envios_creados: 0 };

    const creados = await cliente.query(
      `INSERT INTO push_envios
         (id_notificacion, id_inquilino, id_push_dispositivo)
       SELECT n.id_notificacion, n.id_inquilino, d.id_push_dispositivo
       FROM notificaciones AS n
       JOIN inquilinos AS i
         ON i.id_inquilino = n.id_inquilino AND i.activo = TRUE
       JOIN push_dispositivos AS d
         ON d.id_inquilino = n.id_inquilino AND d.activo = TRUE
        AND d.sesion_version_registro = i.sesion_version
        AND d.expo_project_id = $2::uuid
        AND d.fecha_registro <= n.fecha_creacion
       WHERE n.id_notificacion = ANY($1::bigint[])
       ON CONFLICT (id_notificacion, id_push_dispositivo) DO NOTHING`,
      [ids, projectId]
    );
    await cliente.query(
      `UPDATE push_notificaciones_outbox SET distribuido_at = NOW()
       WHERE id_notificacion = ANY($1::bigint[]) AND distribuido_at IS NULL`,
      [ids]
    );
    return { distribuidas: ids.length, envios_creados: creados.rowCount };
  });
};

const reservarEnvios = async ({ db = pool, projectId = process.env.EXPO_PROJECT_ID } = {}) => {
  comprobarProyecto(projectId);
  return transaccion(db, async (cliente) => {
    // Una reserva vencida pudo alcanzar a Expo. Se conserva como ambigua y no se reenvía.
    await cliente.query(
      `UPDATE push_envios SET estado = 'fallido', bloqueo_hasta = NULL,
              ultimo_error_codigo = 'ResultadoAmbiguo', actualizado_at = NOW()
       WHERE estado = 'en_proceso' AND bloqueo_hasta <= NOW()`
    );
    await cliente.query(
      `UPDATE push_envios AS e SET estado = 'fallido',
              ultimo_error_codigo = 'DispositivoNoVigente', actualizado_at = NOW()
       WHERE e.estado IN ('pendiente', 'reintentar')
         AND NOT EXISTS (
           SELECT 1 FROM push_dispositivos AS d
           JOIN inquilinos AS i ON i.id_inquilino = d.id_inquilino
           JOIN notificaciones AS n ON n.id_notificacion = e.id_notificacion
           WHERE d.id_push_dispositivo = e.id_push_dispositivo
             AND d.id_inquilino = e.id_inquilino
             AND n.id_inquilino = e.id_inquilino
             AND d.activo = TRUE AND i.activo = TRUE
             AND d.sesion_version_registro = i.sesion_version
             AND d.expo_project_id = $1::uuid
             AND d.fecha_registro <= n.fecha_creacion
         )`, [projectId]
    );
    const seleccion = await cliente.query(
      `SELECT e.id_push_envio, e.id_notificacion, e.id_inquilino,
              e.id_push_dispositivo, e.intentos, d.expo_push_token
       FROM push_envios AS e
       JOIN push_dispositivos AS d
         ON d.id_push_dispositivo = e.id_push_dispositivo
        AND d.id_inquilino = e.id_inquilino
       JOIN inquilinos AS i ON i.id_inquilino = e.id_inquilino
       JOIN notificaciones AS n
         ON n.id_notificacion = e.id_notificacion
        AND n.id_inquilino = e.id_inquilino
       WHERE e.estado IN ('pendiente', 'reintentar')
         AND (e.proximo_intento_at IS NULL OR e.proximo_intento_at <= NOW())
         AND d.activo = TRUE AND i.activo = TRUE
         AND d.sesion_version_registro = i.sesion_version
         AND d.expo_project_id = $1::uuid
         AND d.fecha_registro <= n.fecha_creacion
       ORDER BY e.id_push_envio
       LIMIT $2 FOR UPDATE OF e SKIP LOCKED`,
      [projectId, TAM_LOTE]
    );
    const ids = seleccion.rows.map((fila) => fila.id_push_envio);
    if (ids.length) {
      await cliente.query(
        `UPDATE push_envios SET estado = 'en_proceso', intentos = intentos + 1,
                enviado_at = NOW(), expo_ticket_id = NULL,
                recibo_verificado_at = NULL,
                bloqueo_hasta = NOW() + INTERVAL '2 minutes', actualizado_at = NOW()
         WHERE id_push_envio = ANY($1::bigint[])`, [ids]
      );
    }
    return seleccion.rows.map((fila) => ({ ...fila, intentos: Number(fila.intentos) + 1 }));
  });
};

const revalidarEnvios = async ({ db, trabajos, projectId }) => {
  if (!trabajos.length) return [];
  const ids = trabajos.map((fila) => fila.id_push_envio);
  const resultado = await db.query(
    `SELECT e.id_push_envio, d.expo_push_token
     FROM push_envios AS e
     JOIN push_dispositivos AS d ON d.id_push_dispositivo = e.id_push_dispositivo
       AND d.id_inquilino = e.id_inquilino
     JOIN inquilinos AS i ON i.id_inquilino = e.id_inquilino
     JOIN notificaciones AS n ON n.id_notificacion = e.id_notificacion
       AND n.id_inquilino = e.id_inquilino
     WHERE e.id_push_envio = ANY($1::bigint[]) AND e.estado = 'en_proceso'
       AND e.bloqueo_hasta > NOW() AND d.activo = TRUE AND i.activo = TRUE
       AND d.sesion_version_registro = i.sesion_version
       AND d.expo_project_id = $2::uuid
       AND d.fecha_registro <= n.fecha_creacion`, [ids, projectId]
  );
  const vigentes = new Map(resultado.rows.map((fila) =>
    [String(fila.id_push_envio), fila.expo_push_token]));
  const aptos = trabajos.filter((fila) =>
    vigentes.get(String(fila.id_push_envio)) === fila.expo_push_token);
  const descartados = trabajos.filter((fila) => !aptos.includes(fila));
  if (descartados.length) {
    await db.query(
      `UPDATE push_envios SET estado = 'fallido', bloqueo_hasta = NULL,
              ultimo_error_codigo = 'DispositivoNoVigente', actualizado_at = NOW()
       WHERE id_push_envio = ANY($1::bigint[]) AND estado = 'en_proceso'`,
      [descartados.map((fila) => fila.id_push_envio)]
    );
  }
  return aptos;
};

const codigoSeguro = (respuesta) => {
  const codigo = respuesta?.details?.error;
  return typeof codigo === 'string' && /^[A-Za-z_]{1,64}$/.test(codigo)
    ? codigo : 'ErrorExpo';
};
const retrasoMinutos = (intentos) => [1, 5, 15][Math.min(intentos - 1, 2)];

const finalizarEnvio = async ({ db, trabajo, ticket, errorTipo }) => {
  const codigo = errorTipo || (ticket?.status === 'error' ? codigoSeguro(ticket) : null);
  if (!codigo && ticket?.status === 'ok' && typeof ticket.id === 'string' && ticket.id) {
    await db.query(
      `UPDATE push_envios SET estado = 'aceptado', expo_ticket_id = $2,
              bloqueo_hasta = NULL, actualizado_at = NOW()
       WHERE id_push_envio = $1 AND estado = 'en_proceso'`,
      [trabajo.id_push_envio, ticket.id]
    );
    return 'aceptado';
  }
  const final = codigo || 'ResultadoAmbiguo';
  const reintentar = (final === 'reintentar' || TRANSITORIOS.has(final)) &&
    trabajo.intentos < MAX_INTENTOS;
  await transaccion(db, async (cliente) => {
    const actualizado = await cliente.query(
      `UPDATE push_envios SET estado = $2, ultimo_error_codigo = $3,
              proximo_intento_at = CASE WHEN $4::int IS NULL THEN NULL
                ELSE NOW() + ($4::int * INTERVAL '1 minute') END,
              bloqueo_hasta = NULL, actualizado_at = NOW()
       WHERE id_push_envio = $1 AND estado = 'en_proceso'
       RETURNING id_push_dispositivo`,
      [trabajo.id_push_envio, reintentar ? 'reintentar' : 'fallido',
        final, reintentar ? retrasoMinutos(trabajo.intentos) : null]
    );
    if (final === 'DeviceNotRegistered' && actualizado.rowCount) {
      await cliente.query(
        `UPDATE push_dispositivos SET activo = FALSE, desactivado_at = NOW(),
                fecha_actualizacion = NOW(), ultimo_error_codigo = $3
         WHERE id_push_dispositivo = $1 AND expo_push_token = $2 AND activo = TRUE`,
        [trabajo.id_push_dispositivo, trabajo.expo_push_token, final]
      );
    }
  });
  return reintentar ? 'reintentar' : 'fallido';
};

const enviarPendientes = async ({ db = pool, expo = { enviarLoteExpo },
  projectId = process.env.EXPO_PROJECT_ID } = {}) => {
  comprobarProyecto(projectId);
  const resumen = { reservados: 0, aceptados: 0, reintentos: 0, fallidos: 0 };
  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const reservados = await reservarEnvios({ db, projectId });
    if (!reservados.length) break;
    resumen.reservados += reservados.length;
    const trabajos = await revalidarEnvios({ db, trabajos: reservados, projectId });
    resumen.fallidos += reservados.length - trabajos.length;
    if (!trabajos.length) continue;
    const mensajes = trabajos.map((fila) => ({
      to: fila.expo_push_token,
      title: TITULO,
      body: CUERPO,
      sound: 'default',
      channelId: 'avisos',
      data: { id_notificacion: String(fila.id_notificacion) },
    }));
    let tickets;
    let errorTipo;
    try {
      tickets = await expo.enviarLoteExpo(mensajes);
      if (!Array.isArray(tickets) || tickets.length !== trabajos.length) {
        errorTipo = 'ResultadoAmbiguo';
      }
    } catch (error) {
      errorTipo = error.tipo === 'reintentar' ? 'reintentar' :
        error.tipo === 'permanente' ? 'ErrorExpo' : 'ResultadoAmbiguo';
    }
    for (let i = 0; i < trabajos.length; i++) {
      const estado = await finalizarEnvio({ db, trabajo: trabajos[i],
        ticket: errorTipo ? null : tickets[i], errorTipo });
      if (estado === 'aceptado') resumen.aceptados++;
      else if (estado === 'reintentar') resumen.reintentos++;
      else resumen.fallidos++;
    }
  }
  return resumen;
};

const distribuirPendientes = async ({ db = pool,
  projectId = process.env.EXPO_PROJECT_ID } = {}) => {
  const resumen = { distribuidas: 0, envios_creados: 0 };
  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const resultado = await distribuirLote({ db, projectId });
    resumen.distribuidas += resultado.distribuidas;
    resumen.envios_creados += resultado.envios_creados;
    if (resultado.distribuidas < TAM_LOTE) break;
  }
  return resumen;
};

const reservarRecibos = async ({ db = pool } = {}) => transaccion(db, async (cliente) => {
  await cliente.query(
    `UPDATE push_envios SET estado = 'fallido', bloqueo_hasta = NULL,
            ultimo_error_codigo = 'ReciboNoDisponible', actualizado_at = NOW()
     WHERE estado = 'aceptado' AND enviado_at < NOW() - INTERVAL '24 hours'`
  );
  const seleccion = await cliente.query(
    `SELECT id_push_envio, id_push_dispositivo, expo_ticket_id,
            id_notificacion, id_inquilino, intentos
     FROM push_envios
     WHERE estado = 'aceptado' AND expo_ticket_id IS NOT NULL
       AND enviado_at <= NOW() - INTERVAL '15 minutes'
       AND (proximo_intento_at IS NULL OR proximo_intento_at <= NOW())
       AND (bloqueo_hasta IS NULL OR bloqueo_hasta <= NOW())
     ORDER BY enviado_at, id_push_envio
     LIMIT $1 FOR UPDATE SKIP LOCKED`, [TAM_LOTE]
  );
  const ids = seleccion.rows.map((fila) => fila.id_push_envio);
  if (ids.length) {
    await cliente.query(
      `UPDATE push_envios SET bloqueo_hasta = NOW() + INTERVAL '2 minutes',
              actualizado_at = NOW() WHERE id_push_envio = ANY($1::bigint[])`, [ids]
    );
  }
  return seleccion.rows;
});

const aplazarRecibos = async (db, ids) => {
  if (!ids.length) return;
  await db.query(
    `UPDATE push_envios SET bloqueo_hasta = NULL,
            proximo_intento_at = NOW() + INTERVAL '15 minutes', actualizado_at = NOW()
     WHERE id_push_envio = ANY($1::bigint[]) AND estado = 'aceptado'`, [ids]
  );
};

const finalizarRecibo = async ({ db, trabajo, recibo }) => {
  const codigo = recibo?.status === 'error' ? codigoSeguro(recibo) : null;
  if (recibo?.status !== 'ok' && !codigo) {
    await aplazarRecibos(db, [trabajo.id_push_envio]);
    return 'pendiente';
  }
  return transaccion(db, async (cliente) => {
    const nuevoEstado = recibo.status === 'ok' ? 'entregado' :
      TRANSITORIOS.has(codigo) && trabajo.intentos < MAX_INTENTOS
        ? 'reintentar' : 'fallido';
    const actualizado = await cliente.query(
      `UPDATE push_envios SET estado = $2, ultimo_error_codigo = $3,
              recibo_verificado_at = NOW(), bloqueo_hasta = NULL,
              proximo_intento_at = CASE WHEN $4::int IS NULL THEN NULL
                ELSE NOW() + ($4::int * INTERVAL '1 minute') END,
              actualizado_at = NOW()
       WHERE id_push_envio = $1 AND estado = 'aceptado'
         AND expo_ticket_id = $5
       RETURNING id_push_dispositivo`,
      [trabajo.id_push_envio, nuevoEstado, codigo,
        nuevoEstado === 'reintentar' ? retrasoMinutos(trabajo.intentos) : null,
        trabajo.expo_ticket_id]
    );
    if (codigo === 'DeviceNotRegistered' && actualizado.rowCount) {
      await cliente.query(
        `UPDATE push_dispositivos AS d SET activo = FALSE,
                desactivado_at = NOW(), fecha_actualizacion = NOW(),
                ultimo_error_codigo = $3
         FROM push_envios AS e
         WHERE d.id_push_dispositivo = $1 AND d.activo = TRUE
           AND e.id_push_envio = $2 AND e.id_push_dispositivo = d.id_push_dispositivo
           AND e.id_inquilino = d.id_inquilino
           AND d.fecha_actualizacion <= e.enviado_at`,
        [trabajo.id_push_dispositivo, trabajo.id_push_envio, codigo]
      );
    }
    return nuevoEstado;
  });
};

const procesarRecibos = async ({ db = pool, expo = { consultarRecibosExpo } } = {}) => {
  const resumen = { consultados: 0, entregados: 0, reintentos: 0,
    fallidos: 0, pendientes: 0 };
  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const trabajos = await reservarRecibos({ db });
    if (!trabajos.length) break;
    resumen.consultados += trabajos.length;
    let recibos;
    try {
      recibos = await expo.consultarRecibosExpo(trabajos.map((fila) => fila.expo_ticket_id));
    } catch (_) {
      await aplazarRecibos(db, trabajos.map((fila) => fila.id_push_envio));
      resumen.pendientes += trabajos.length;
      break;
    }
    for (const trabajo of trabajos) {
      const estado = await finalizarRecibo({ db, trabajo,
        recibo: recibos[trabajo.expo_ticket_id] });
      if (estado === 'entregado') resumen.entregados++;
      else if (estado === 'reintentar') resumen.reintentos++;
      else if (estado === 'fallido') resumen.fallidos++;
      else resumen.pendientes++;
    }
    if (trabajos.length < TAM_LOTE) break;
  }
  return resumen;
};

const procesarPendientes = async (opciones = {}) => ({
  distribucion: await distribuirPendientes(opciones),
  envios: await enviarPendientes(opciones),
});

if (require.main === module) {
  const modo = process.argv[2];
  if (process.argv.length !== 3 || !['--dry-run', '--procesar', '--recibos'].includes(modo)) {
    console.error('Uso: node jobs/procesarNotificacionesPush.js --dry-run|--procesar|--recibos');
    process.exitCode = 2;
    void pool.end();
  } else if (modo === '--procesar' &&
             !envioRemotoHabilitado(process.env.PUSH_REMOTE_ENABLED)) {
    console.error('El envío push remoto está desactivado para esta versión');
    process.exitCode = 2;
    void pool.end();
  } else {
    const trabajo = modo === '--dry-run' ? simularPush :
      modo === '--procesar' ? procesarPendientes : procesarRecibos;
    trabajo().then((resultado) => {
      console.log(JSON.stringify({ modo, ...resultado }, null, 2));
    }).catch(() => {
      console.error('Falló el procesamiento push; no se muestran tokens ni credenciales');
      process.exitCode = 1;
    }).finally(() => pool.end());
  }
}

module.exports = { simularPush, distribuirLote, distribuirPendientes,
  reservarEnvios, enviarPendientes, reservarRecibos, procesarRecibos,
  procesarPendientes, revalidarEnvios, finalizarEnvio, finalizarRecibo,
  TAM_LOTE, MAX_INTENTOS, envioRemotoHabilitado };
