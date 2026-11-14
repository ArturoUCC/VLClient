const test = require('node:test');
const assert = require('node:assert/strict');
const { crearConciliadorCitasBorradores } = require('../src/services/citasBorradoresCore');

const escenario = () => {
  const borradores = new Map([[13, { id_inquilino: 1, estado: 'enviado' }],
    [14, { id_inquilino: 1, estado: 'enviado' }],
    [15, { id_inquilino: 1, estado: 'pendiente_sincronizacion' }]]);
  let fallaApi = false;
  let propietario = 1;
  let citas = [{ id_cita: 6, id_reporte: 13 }];
  const llamadas = [];
  const conciliador = crearConciliadorCitasBorradores({
    obtenerMiPerfil: async () => ({ id_inquilino: propietario }),
    obtenerMisCitas: async () => {
      if (fallaApi) throw new Error('Sin red');
      return citas;
    },
    retirarBorradorConCita: async (idReporte, idInquilino) => {
      llamadas.push([idReporte, idInquilino]);
      const fila = borradores.get(Number(idReporte));
      if (!fila || fila.id_inquilino !== idInquilino || fila.estado !== 'enviado') return 0;
      borradores.delete(Number(idReporte));
      return 1;
    },
  });
  return { borradores, llamadas, conciliador,
    fallarApi: () => { fallaApi = true; },
    cambiarPropietario: (valor) => { propietario = valor; },
    cambiarCitas: (valor) => { citas = valor; } };
};

test('la confirmación de API retira solo el borrador del reporte de la cita', async () => {
  const s = escenario();
  assert.equal(await s.conciliador.confirmar('jwt', 13,
    { id_cita: 6, id_reporte: 13 }), 1);
  assert.equal(s.borradores.has(13), false);
  assert.equal(s.borradores.has(14), true);
  assert.deepEqual(s.llamadas, [[13, 1]]);
});

test('una cita de otro reporte no retira el borrador equivocado', async () => {
  const s = escenario();
  await assert.rejects(s.conciliador.confirmar('jwt', 13,
    { id_cita: 7, id_reporte: 14 }), /no corresponde/);
  assert.equal(s.borradores.size, 3);
  assert.equal(s.llamadas.length, 0);
});

test('un fallo de API conserva la opción de continuar con la cita', async () => {
  const s = escenario(); s.fallarApi();
  await assert.rejects(s.conciliador.conciliar('jwt', 1), /Sin red/);
  assert.equal(s.borradores.has(13), true);
  assert.equal(s.llamadas.length, 0);
});

test('al reabrir Borradores se retira el reporte 13 con cita previa', async () => {
  const s = escenario();
  assert.equal(await s.conciliador.conciliar('jwt', 1), 1);
  assert.equal(s.borradores.has(13), false);
  assert.equal(s.borradores.has(14), true);
  assert.equal(s.borradores.has(15), true);
});

test('un JWT de otra cuenta no elimina los borradores locales', async () => {
  const s = escenario(); s.cambiarPropietario(2);
  await assert.rejects(s.conciliador.conciliar('jwt-de-2', 1), /propietario/);
  assert.equal(s.borradores.size, 3);
  assert.equal(s.llamadas.length, 0);
});

test('una cita repetida solo intenta retirar una vez el mismo reporte', async () => {
  const s = escenario();
  s.cambiarCitas([{ id_cita: 6, id_reporte: 13 },
    { id_cita: 7, id_reporte: 13 }]);
  assert.equal(await s.conciliador.conciliar('jwt', 1), 1);
  assert.deepEqual(s.llamadas, [[13, 1]]);
});
