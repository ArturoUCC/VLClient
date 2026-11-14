const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');

const filas = new Map();
const archivos = new Set(['cache/foto.jpg']);
const directorios = new Set();
let secuencia = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++secuencia).padStart(12, '0')}`;
const base = {
  async execAsync(sql) { assert.match(sql, /CREATE TABLE IF NOT EXISTS borradores_reporte/); },
  async runAsync(sql, ...params) {
    if (sql.includes('INSERT INTO borradores_reporte')) {
      const [id, idInquilino, titulo, descripcion, categoria, fotosJson,
        idReporte, estado, fecha] = params;
      if (filas.has(id) && filas.get(id).id_inquilino !== idInquilino) {
        return { changes: 0 };
      }
      filas.set(id, { id, id_inquilino: idInquilino, titulo, descripcion,
        categoria, fotos_json: fotosJson, id_reporte: idReporte,
        estado, fecha_actualizacion: fecha });
      return { changes: 1 };
    }
    if (sql.includes('DELETE FROM borradores_reporte')) {
      const [id, owner, idReporte] = params;
      if (filas.get(id)?.id_inquilino !== owner ||
          (idReporte !== undefined &&
            (filas.get(id)?.estado !== 'enviado' ||
             filas.get(id)?.id_reporte !== idReporte)) ||
          (idReporte === undefined &&
            !['borrador', 'enviado'].includes(filas.get(id)?.estado))) return { changes: 0 };
      filas.delete(id);
      return { changes: 1 };
    }
    if (sql.includes('UPDATE borradores_reporte')) {
      if (sql.includes("SET estado = 'pendiente_sincronizacion'")) {
        const [owner] = params;
        for (const fila of filas.values()) if (fila.id_inquilino === owner &&
            ['sincronizando_idempotente', 'error_reintentar'].includes(fila.estado)) {
          fila.estado = 'pendiente_sincronizacion';
        }
        return { changes: 1 };
      }
      if (sql.includes('SET id_reporte = ?')) {
        const [idReporte, fotosJson, estado, fecha, id, owner] = params;
        const fila = filas.get(id);
        if (!fila || fila.id_inquilino !== owner ||
            fila.estado !== 'sincronizando_idempotente') return { changes: 0 };
        Object.assign(fila, { id_reporte: idReporte, fotos_json: fotosJson,
          estado, fecha_actualizacion: fecha });
        return { changes: 1 };
      }
      if (sql.includes("estado = 'sincronizando_idempotente'")) {
        const [id, owner] = params;
        const fila = filas.get(id);
        if (!fila || fila.id_inquilino !== owner ||
            fila.estado !== 'pendiente_sincronizacion') return { changes: 0 };
        fila.estado = 'sincronizando_idempotente';
        return { changes: 1 };
      }
      const [estado, fecha, id, owner, desde] = params;
      const fila = filas.get(id);
      if (!fila || fila.id_inquilino !== owner || fila.estado !== desde) return { changes: 0 };
      Object.assign(fila, { estado, fecha_actualizacion: fecha });
      return { changes: 1 };
    }
    throw new Error('SQL inesperado');
  },
  async getFirstAsync(sql, id, owner) {
    assert.match(sql, /id_inquilino = \?/);
    const fila = filas.get(id);
    return fila?.id_inquilino === owner ? fila : null;
  },
  async getAllAsync(sql, owner, idReporte) {
    assert.match(sql, /id_inquilino = \?/);
    if (sql.includes('SELECT id FROM borradores_reporte')) {
      return [...filas.values()].filter((fila) => fila.id_inquilino === owner &&
        fila.id_reporte === idReporte && fila.estado === 'enviado')
        .map((fila) => ({ id: fila.id }));
    }
    return [...filas.values()].filter((fila) => fila.id_inquilino === owner);
  },
};
class Directory {
  constructor(...partes) { this.uri = partes.map((p) => p.uri || p).join('/'); }
  get exists() { return directorios.has(this.uri); }
  create() { directorios.add(this.uri); }
  delete() {
    for (const archivo of archivos) if (archivo.startsWith(this.uri + '/')) archivos.delete(archivo);
    directorios.delete(this.uri);
  }
}
class File {
  constructor(...partes) { this.uri = partes.map((p) => p.uri || p).join('/'); }
  get exists() { return archivos.has(this.uri); }
  get name() { return this.uri.split('/').at(-1); }
  async copy(destino) { assert.ok(this.exists); archivos.add(destino.uri); }
  delete() { archivos.delete(this.uri); }
}

const ruta = path.resolve(__dirname, '../src/services/borradoresReporte.js');
const codigo = babel.transformSync(fs.readFileSync(ruta, 'utf8'), {
  babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'expo-sqlite') return { openDatabaseAsync: async () => base };
  if (request === 'expo-crypto') return { randomUUID: uuid };
  if (request === 'expo-file-system') return {
    Directory, File, Paths: { document: { uri: 'documentos' } },
  };
  return originalLoad.call(this, request, parent, isMain);
};
const modulo = new Module(ruta, module);
modulo.filename = ruta;
modulo.paths = module.paths;
modulo._compile(codigo, ruta);
Module._load = originalLoad;
const servicio = modulo.exports;

test('el texto y la foto quedan persistentes y visibles solo al propietario', async () => {
  const id = servicio.crearIdBorrador();
  await servicio.guardarBorrador({ id, id_inquilino: 1,
    titulo: 'Fuga', descripcion: 'En cocina', estado: 'borrador' });
  const foto = await servicio.copiarFotoBorrador(id, 1, { uri: 'cache/foto.jpg' });
  await servicio.guardarBorrador({ id, id_inquilino: 1,
    titulo: 'Fuga editada', descripcion: 'En cocina', fotos: [foto],
    estado: 'pendiente_sincronizacion' });
  assert.equal((await servicio.obtenerBorrador(id, 1)).titulo, 'Fuga editada');
  assert.equal((await servicio.listarBorradores(1)).length, 1);
  assert.equal((await servicio.listarBorradores(2)).length, 0);
  assert.equal(await servicio.obtenerBorrador(id, 2), null);
  await assert.rejects(servicio.guardarBorrador({ id, id_inquilino: 2 }),
    /otra cuenta/);
  assert.equal(servicio.fotosFaltantes([foto]).length, 0);
  await assert.rejects(servicio.eliminarBorrador(id, 1), /pendiente/);
  await servicio.cambiarEstadoBorrador(id, 1, 'pendiente_sincronizacion', 'enviado');
  await servicio.eliminarBorrador(id, 1);
  assert.equal((await servicio.listarBorradores(1)).length, 0);
  assert.equal(servicio.fotosFaltantes([foto]).length, 1);
});

test('la cola guarda progreso y recupera una sincronización interrumpida', async () => {
  const id = servicio.crearIdBorrador();
  await servicio.guardarBorrador({ id, id_inquilino: 1,
    titulo: 'Tubería', descripcion: 'Fuga', categoria: 'plomeria',
    estado: 'pendiente_sincronizacion' });
  assert.equal(await servicio.reclamarBorrador(id, 2), null);
  assert.equal((await servicio.reclamarBorrador(id, 1)).estado,
    'sincronizando_idempotente');
  await assert.rejects(servicio.eliminarBorrador(id, 1), /pendiente/);
  await servicio.guardarProgreso(id, 1, { id_reporte: 42,
    fotos: [{ uri: 'foto', clave_idempotencia: uuid(), enviada: false }] });
  await servicio.recuperarSincronizaciones(1);
  const recuperado = await servicio.obtenerBorrador(id, 1);
  assert.equal(recuperado.id_reporte, 42);
  assert.equal(recuperado.estado, 'pendiente_sincronizacion');
  assert.equal(recuperado.fotos.length, 1);
  await assert.rejects(servicio.eliminarBorrador(id, 1), /pendiente/);
  await servicio.cambiarEstadoBorrador(id, 1, 'pendiente_sincronizacion', 'enviado');
  await servicio.eliminarBorrador(id, 1);
});

test('solo se retira el borrador enviado del propietario y reporte de la cita', async () => {
  const id13 = servicio.crearIdBorrador();
  const id14 = servicio.crearIdBorrador();
  const idPendiente = servicio.crearIdBorrador();
  const foto = await servicio.copiarFotoBorrador(id13, 1, { uri: 'cache/foto.jpg' });
  for (const [id, idReporte, fotos] of [[id13, 13, [foto]], [id14, 14, []]]) {
    await servicio.guardarBorrador({ id, id_inquilino: 1, id_reporte: idReporte,
      titulo: 'Reporte', estado: 'enviado', fotos });
  }
  await servicio.guardarBorrador({ id: idPendiente, id_inquilino: 1,
    id_reporte: 13, titulo: 'Fotos pendientes', estado: 'pendiente_sincronizacion' });
  assert.equal(await servicio.retirarBorradorConCita(13, 2), 0);
  assert.ok(await servicio.obtenerBorrador(id13, 1));
  assert.equal(await servicio.retirarBorradorConCita(13, 1), 1);
  assert.equal(await servicio.obtenerBorrador(id13, 1), null);
  assert.ok(await servicio.obtenerBorrador(id14, 1));
  assert.ok(await servicio.obtenerBorrador(idPendiente, 1));
  assert.equal(servicio.fotosFaltantes([foto]).length, 1);
});
