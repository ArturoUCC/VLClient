const test = require('node:test');
const assert = require('node:assert/strict');
const { crearMotorSincronizacion } = require('../src/services/motorSincronizacionReportes');

const uuid = '00000000-0000-4000-8000-000000000010';
const fotoUuid = '00000000-0000-4000-8000-000000000011';
const crearEscenario = () => {
  const filas = new Map([[uuid, { id: uuid, id_inquilino: 1,
    titulo: 'Fuga', descripcion: 'En cocina', categoria: 'plomeria',
    id_reporte: null, estado: 'pendiente_sincronizacion',
    fotos: [{ uri: 'documentos/foto.jpg', nombre: 'foto.jpg' }] }]]);
  const llamadas = { reportes: 0, fotos: 0, backend: 0 };
  let conectado = true;
  let fotoFalla = false;
  let sesionVencida = false;
  const deps = {
    nuevaClave: () => fotoUuid,
    estadoRed: async () => ({ isConnected: conectado, isInternetReachable: conectado }),
    backendDisponible: async () => { llamadas.backend++; return conectado; },
    verificarPropietario: async () => 1,
    recuperarSincronizaciones: async (owner) => {
      for (const fila of filas.values()) if (fila.id_inquilino === owner &&
          ['sincronizando_idempotente', 'error_reintentar'].includes(fila.estado)) {
        fila.estado = 'pendiente_sincronizacion';
      }
    },
    listarBorradores: async (owner) => [...filas.values()].filter((fila) =>
      fila.id_inquilino === owner).map((fila) => structuredClone(fila)),
    reclamarBorrador: async (id, owner) => {
      const fila = filas.get(id);
      if (!fila || fila.id_inquilino !== owner || fila.estado !== 'pendiente_sincronizacion') return null;
      fila.estado = 'sincronizando_idempotente';
      return structuredClone(fila);
    },
    guardarProgreso: async (id, owner, cambios) => {
      const fila = filas.get(id);
      assert.equal(fila.id_inquilino, owner);
      Object.assign(fila, structuredClone(cambios));
    },
    cambiarEstadoBorrador: async (id, owner, desde, hacia) => {
      const fila = filas.get(id);
      if (fila.id_inquilino !== owner || fila.estado !== desde) return false;
      fila.estado = hacia;
      return true;
    },
    fotosFaltantes: () => [],
    crearReporte: async (token, reporte) => {
      llamadas.reportes++;
      assert.equal(reporte.clave_idempotencia, uuid);
      if (sesionVencida) throw Object.assign(new Error('Sesión vencida'), { status: 401 });
      return { reporte: { id_reporte: 42 } };
    },
    subirFotoReporteIdempotente: async (token, idReporte, foto) => {
      llamadas.fotos++;
      assert.equal(idReporte, 42);
      assert.equal(foto.clave_idempotencia, fotoUuid);
      if (fotoFalla) throw new Error('Cloudinary indisponible');
      return { foto: { id_foto: 7 } };
    },
  };
  return { filas, llamadas, deps,
    setConectado: (valor) => { conectado = valor; },
    setFotoFalla: (valor) => { fotoFalla = valor; },
    setSesionVencida: (valor) => { sesionVencida = valor; } };
};

test('sin conexión, no consulta el backend ni modifica el borrador', async () => {
  const s = crearEscenario(); s.setConectado(false);
  const res = await crearMotorSincronizacion(s.deps).ejecutar('jwt', 1);
  assert.equal(res.estado, 'sin_conexion');
  assert.equal(s.llamadas.backend, 0);
  assert.equal(s.filas.get(uuid).estado, 'pendiente_sincronizacion');
});

test('una API antigua sin soporte idempotente deja el reporte pendiente', async () => {
  const s = crearEscenario();
  s.deps.backendDisponible = async () => false;
  const res = await crearMotorSincronizacion(s.deps).ejecutar('jwt', 1);
  assert.equal(res.estado, 'sin_conexion');
  assert.equal(s.llamadas.reportes, 0);
  assert.equal(s.filas.get(uuid).estado, 'pendiente_sincronizacion');
});

test('un inquilino distinto no puede sincronizar el borrador', async () => {
  const s = crearEscenario();
  await crearMotorSincronizacion(s.deps).ejecutar('jwt-de-otro', 2);
  assert.equal(s.llamadas.reportes, 0);
  assert.equal(s.filas.get(uuid).estado, 'pendiente_sincronizacion');
});

test('un JWT de otro inquilino no puede enviar el borrador aunque se pase su id local', async () => {
  const s = crearEscenario();
  s.deps.verificarPropietario = async () => 2;
  const res = await crearMotorSincronizacion(s.deps).ejecutar('jwt-de-B', 1);
  assert.equal(res.estado, 'otra_cuenta');
  assert.equal(s.llamadas.reportes, 0);
});

test('JWT expirado suspende la cola sin perder la clave estable', async () => {
  const s = crearEscenario(); s.setSesionVencida(true);
  const res = await crearMotorSincronizacion(s.deps).ejecutar('jwt', 1);
  assert.equal(res.estado, 'sesion_vencida');
  assert.equal(s.filas.get(uuid).estado, 'pendiente_sincronizacion');
  assert.equal(s.filas.get(uuid).fotos[0].clave_idempotencia, fotoUuid);
});

test('fallo de foto conserva el reporte y permite reintento tras reinicio', async () => {
  const s = crearEscenario(); s.setFotoFalla(true);
  await crearMotorSincronizacion(s.deps).ejecutar('jwt', 1);
  assert.equal(s.filas.get(uuid).id_reporte, 42);
  assert.equal(s.filas.get(uuid).estado, 'error_reintentar');
  s.setFotoFalla(false);
  const res = await crearMotorSincronizacion(s.deps).ejecutar('jwt', 1);
  assert.equal(res.enviados, 1);
  assert.equal(s.llamadas.reportes, 1);
  assert.equal(s.filas.get(uuid).estado, 'enviado');
  assert.equal(s.filas.get(uuid).fotos[0].id_foto, 7);
});

test('una cola activa no envía dos veces la misma fila', async () => {
  const s = crearEscenario();
  const motor = crearMotorSincronizacion(s.deps);
  const [primero, segundo] = await Promise.all([
    motor.ejecutar('jwt', 1), motor.ejecutar('jwt', 1),
  ]);
  assert.equal(primero.enviados, 1);
  assert.equal(segundo.estado, 'en_curso');
  assert.equal(s.llamadas.reportes, 1);
  assert.equal(s.llamadas.fotos, 1);
});

test('respuesta de reporte perdida conserva la clave y reanuda al reabrir', async () => {
  const s = crearEscenario();
  const crear = s.deps.crearReporte;
  let primera = true;
  s.deps.crearReporte = async (...args) => {
    const resultado = await crear(...args);
    if (primera) {
      primera = false;
      throw Object.assign(new Error('Network request failed'), { name: 'TypeError' });
    }
    return resultado;
  };
  const inicial = await crearMotorSincronizacion(s.deps).ejecutar('jwt', 1);
  assert.equal(inicial.estado, 'sin_conexion');
  assert.equal(s.filas.get(uuid).id_reporte, null);
  assert.equal(s.filas.get(uuid).estado, 'pendiente_sincronizacion');
  const despues = await crearMotorSincronizacion(s.deps).ejecutar('jwt', 1);
  assert.equal(despues.enviados, 1);
  assert.equal(s.llamadas.reportes, 2);
  assert.equal(s.filas.get(uuid).estado, 'enviado');
});
