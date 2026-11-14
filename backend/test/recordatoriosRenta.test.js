const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return {};
  return originalLoad.call(this, request, parent, isMain);
};
const { fechaLocalMexico, generarRecordatoriosRenta, INSERTAR_RECORDATORIOS } =
  require('../jobs/generarRecordatoriosRenta');
Module._load = originalLoad;

const fechaOrdinal = (fecha) => Date.parse(`${fecha}T00:00:00Z`) / 86400000;
const baseSimulada = (cuentas) => {
  const emitidas = new Set();
  const avisos = [];
  return {
    avisos,
    async query(sql, [hoy]) {
      assert.equal(sql, INSERTAR_RECORDATORIOS);
      const totalAnterior = avisos.length;
      for (const cuenta of cuentas) {
        const faltan = fechaOrdinal(cuenta.fecha_limite) - fechaOrdinal(hoy);
        if (!cuenta.activo || !cuenta.contrato_activo ||
            cuenta.estado !== 'pendiente' ||
            cuenta.total <= cuenta.pagado || faltan <= 0 ||
            faltan > cuenta.dias) continue;
        const clave = `${cuenta.id}:${cuenta.fecha_limite}:${cuenta.dias}`;
        if (emitidas.has(clave)) continue;
        emitidas.add(clave);
        avisos.push(clave);
      }
      return { rowCount: avisos.length - totalAnterior };
    },
  };
};
const cuenta = (cambios = {}) => ({
  id: 8, fecha_limite: '2026-11-20', estado: 'pendiente',
  total: 9500, pagado: 0, dias: 5, activo: true,
  contrato_activo: true, ...cambios,
});

test('la fecha local cambia en medianoche de México, no en medianoche UTC', () => {
  assert.equal(fechaLocalMexico(new Date('2026-11-15T05:59:00Z')), '2026-11-14');
  assert.equal(fechaLocalMexico(new Date('2026-11-15T06:00:00Z')), '2026-11-15');
  assert.equal(fechaLocalMexico(new Date('2027-01-01T05:59:00Z')), '2026-12-31');
  assert.equal(fechaLocalMexico(new Date('2027-01-01T06:00:00Z')), '2027-01-01');
});

test('SQL exige saldo, cuenta pendiente, fecha futura y usa el índice único', () => {
  assert.match(INSERTAR_RECORDATORIOS, /ec\.estado = 'pendiente'/);
  assert.match(INSERTAR_RECORDATORIOS, /ec\.total > pagos_cuenta\.total_pagado/);
  assert.match(INSERTAR_RECORDATORIOS, /SUM\(p\.monto\)/);
  assert.match(INSERTAR_RECORDATORIOS, /ec\.fecha_limite > \$1::date/);
  assert.match(INSERTAR_RECORDATORIOS,
    /ec\.fecha_limite - i\.recordatorio_renta_dias <= \$1::date/);
  assert.match(INSERTAR_RECORDATORIOS,
    /ON CONFLICT \(id_estado_cuenta, fecha_limite_recordatorio, dias_anticipacion\)/);
  assert.match(INSERTAR_RECORDATORIOS, /'pago', NULL, NULL/);
});

test('predeterminado, personalizado y pagos parciales conservan el aviso', async () => {
  const db = baseSimulada([
    cuenta(),
    cuenta({ id: 9, dias: 11, fecha_limite: '2026-11-26', pagado: 3000 }),
    cuenta({ id: 10, dias: 2, fecha_limite: '2026-11-20' }),
    cuenta({ id: 11, estado: 'pagado' }),
    cuenta({ id: 12, pagado: 9500 }),
  ]);
  const resultado = await generarRecordatoriosRenta({
    db, ahora: new Date('2026-11-15T15:00:00Z'),
  });
  assert.equal(resultado.fecha_local, '2026-11-15');
  assert.equal(resultado.creados, 2);
  assert.deepEqual(db.avisos, ['8:2026-11-20:5', '9:2026-11-26:11']);
});

test('cambiar la preferencia crea el aviso nuevo dentro de su ventana', async () => {
  const registro = cuenta();
  const db = baseSimulada([registro]);
  await generarRecordatoriosRenta({ db, ahora: new Date('2026-11-15T15:00:00Z') });
  registro.dias = 11;
  await generarRecordatoriosRenta({ db, ahora: new Date('2026-11-16T15:00:00Z') });
  assert.deepEqual(db.avisos, ['8:2026-11-20:5', '8:2026-11-20:11']);
});

test('límites de mes y año y vencimientos anteriores', async () => {
  const db = baseSimulada([
    cuenta({ id: 20, fecha_limite: '2027-01-02', dias: 2 }),
    cuenta({ id: 21, fecha_limite: '2026-12-31', dias: 5 }),
    cuenta({ id: 22, fecha_limite: '2027-01-01', dias: 1 }),
  ]);
  await generarRecordatoriosRenta({ db, ahora: new Date('2026-12-31T18:00:00Z') });
  assert.deepEqual(db.avisos, ['20:2027-01-02:2', '22:2027-01-01:1']);
});

test('ejecuciones repetidas y simultáneas no duplican el mismo aviso', async () => {
  const db = baseSimulada([cuenta()]);
  const ahora = new Date('2026-11-15T15:00:00Z');
  await Promise.all([
    generarRecordatoriosRenta({ db, ahora }),
    generarRecordatoriosRenta({ db, ahora }),
  ]);
  await generarRecordatoriosRenta({ db, ahora });
  assert.deepEqual(db.avisos, ['8:2026-11-20:5']);
});
