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

const INSERTAR_RECORDATORIOS = `
  INSERT INTO notificaciones (
    id_inquilino, titulo, mensaje, tipo, accion_tipo, id_cita,
    id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion
  )
  SELECT
    i.id_inquilino,
    'Recordatorio de vencimiento de renta',
    'Tu renta vence el ' || TO_CHAR(ec.fecha_limite, 'DD/MM/YYYY') ||
      '. Este recordatorio se configuró con ' || i.recordatorio_renta_dias ||
      ' días de anticipación. Consulta tu estado de cuenta en VLClient.',
    'pago', NULL, NULL,
    ec.id_estado_cuenta, ec.fecha_limite, i.recordatorio_renta_dias
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
  ON CONFLICT (id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion)
    WHERE id_estado_cuenta IS NOT NULL DO NOTHING
  RETURNING id_notificacion`;

const generarRecordatoriosRenta = async ({ db = pool, ahora = new Date() } = {}) => {
  const fecha = fechaLocalMexico(ahora);
  const resultado = await db.query(INSERTAR_RECORDATORIOS, [fecha]);
  return { fecha_local: fecha, creados: resultado.rowCount };
};

if (require.main === module) {
  generarRecordatoriosRenta()
    .then(({ fecha_local, creados }) => {
      console.log(`Recordatorios de renta ${fecha_local}: ${creados} creados`);
    })
    .catch(() => {
      console.error('Falló la generación de recordatorios de renta');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { fechaLocalMexico, generarRecordatoriosRenta, INSERTAR_RECORDATORIOS };
