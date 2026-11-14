const pool = require('../config/db');

const ZONA_HORARIA = 'America/Mexico_City';

// Congela el día local para toda la ejecución; las restas de días se hacen
// sobre DATE en PostgreSQL, sin convertir el vencimiento a UTC.
const fechaLocalMexico = (instante) => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instante);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
};

const CANDIDATOS_RECORDATORIO = `
  WITH candidatos AS (
    SELECT ec.id_estado_cuenta, i.id_inquilino, ec.fecha_limite,
           i.recordatorio_renta_dias AS dias_anticipacion,
           ec.total - pagos_cuenta.total_pagado AS saldo_pendiente
    FROM estados_de_cuenta AS ec
    JOIN contratos AS c ON c.id_contrato = ec.id_contrato
    JOIN inquilinos AS i ON i.id_inquilino = c.id_inquilino
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(p.monto), 0) AS total_pagado
      FROM pagos AS p
      WHERE p.id_estado_cuenta = ec.id_estado_cuenta
    ) AS pagos_cuenta ON TRUE
    WHERE i.activo = TRUE
      AND c.estado = 'activo'
      AND $1::date BETWEEN c.fecha_inicio AND c.fecha_fin
      AND ec.estado = 'pendiente'
      AND ec.total > pagos_cuenta.total_pagado
      AND ec.fecha_limite > $1::date
      AND ec.fecha_limite - i.recordatorio_renta_dias <= $1::date
  )`;

const INSERTAR_RECORDATORIOS = `${CANDIDATOS_RECORDATORIO}
  INSERT INTO notificaciones (
    id_inquilino, titulo, mensaje, tipo, accion_tipo, id_cita,
    id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion
  )
  SELECT
    c.id_inquilino,
    'Recordatorio de vencimiento de renta',
    'Tu renta vence el ' || TO_CHAR(c.fecha_limite, 'DD/MM/YYYY') ||
      '. Este recordatorio se configuró con ' || c.dias_anticipacion ||
      ' días de anticipación. Consulta tu estado de cuenta en VLClient.',
    'pago', NULL, NULL,
    c.id_estado_cuenta, c.fecha_limite, c.dias_anticipacion
  FROM candidatos AS c
  -- Desambigua ON CONFLICT del ON de un posible JOIN en INSERT ... SELECT.
  WHERE TRUE
  ON CONFLICT (id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion)
    WHERE id_estado_cuenta IS NOT NULL DO NOTHING
  RETURNING id_notificacion`;

const CONSULTAR_RECORDATORIOS = `${CANDIDATOS_RECORDATORIO}
  SELECT c.id_estado_cuenta, c.id_inquilino,
         TO_CHAR(c.fecha_limite, 'YYYY-MM-DD') AS fecha_limite,
         c.dias_anticipacion, c.saldo_pendiente
  FROM candidatos AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM notificaciones AS n
    WHERE n.id_estado_cuenta = c.id_estado_cuenta
      AND n.fecha_limite_recordatorio = c.fecha_limite
      AND n.dias_anticipacion = c.dias_anticipacion
  )
  ORDER BY c.fecha_limite, c.id_estado_cuenta`;

const generarRecordatoriosRenta = async ({ db = pool, ahora = new Date() } = {}) => {
  const fecha = fechaLocalMexico(ahora);
  const resultado = await db.query(INSERTAR_RECORDATORIOS, [fecha]);
  return { fecha_local: fecha, creados: resultado.rowCount };
};

const simularRecordatoriosRenta = async ({ db = pool, ahora = new Date() } = {}) => {
  const fecha = fechaLocalMexico(ahora);
  const client = await db.connect();
  let transaccion = false;
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    transaccion = true;
    const resultado = await client.query(CONSULTAR_RECORDATORIOS, [fecha]);
    await client.query('COMMIT');
    transaccion = false;
    return { fecha_local: fecha, candidatos: resultado.rows };
  } catch (error) {
    if (transaccion) {
      try { await client.query('ROLLBACK'); } catch (_) { /* Conservar error original. */ }
    }
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  const argumentos = process.argv.slice(2);
  const dryRun = argumentos.length === 1 && argumentos[0] === '--dry-run';
  if (argumentos.length > 0 && !dryRun) {
    console.error('Uso: node jobs/generarRecordatoriosRenta.js [--dry-run]');
    process.exitCode = 2;
    pool.end();
  } else {
    const trabajo = dryRun ? simularRecordatoriosRenta : generarRecordatoriosRenta;
    trabajo()
    .then((resultado) => {
      if (dryRun) {
        console.log(JSON.stringify({
          modo: 'dry-run',
          fecha_local: resultado.fecha_local,
          total: resultado.candidatos.length,
          candidatos: resultado.candidatos,
        }, null, 2));
      } else {
        console.log(`Recordatorios de renta ${resultado.fecha_local}: ${resultado.creados} creados`);
      }
    })
    .catch(() => {
      console.error('Falló la consulta o generación de recordatorios de renta');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
  }
}

module.exports = {
  fechaLocalMexico, generarRecordatoriosRenta, simularRecordatoriosRenta,
  CANDIDATOS_RECORDATORIO, INSERTAR_RECORDATORIOS, CONSULTAR_RECORDATORIOS,
};
