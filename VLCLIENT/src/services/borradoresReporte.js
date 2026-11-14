import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

let apertura;
const db = async () => {
  if (!apertura) {
    apertura = SQLite.openDatabaseAsync('vlclient-borradores.db').then(async (base) => {
      await base.execAsync(`CREATE TABLE IF NOT EXISTS borradores_reporte (
        id TEXT PRIMARY KEY NOT NULL,
        id_inquilino INTEGER NOT NULL,
        titulo TEXT NOT NULL DEFAULT '',
        descripcion TEXT NOT NULL DEFAULT '',
        categoria TEXT NOT NULL DEFAULT '',
        fotos_json TEXT NOT NULL DEFAULT '[]',
        id_reporte INTEGER,
        estado TEXT NOT NULL DEFAULT 'borrador',
        fecha_actualizacion TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS borradores_reporte_propietario_idx
        ON borradores_reporte(id_inquilino, fecha_actualizacion DESC);`);
      return base;
    }).catch((error) => { apertura = null; throw error; });
  }
  return apertura;
};

const propietarioValido = (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0;
const idValido = (id) => typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const comprobarPropiedad = (id, idInquilino) => {
  if (!idValido(id) || !propietarioValido(idInquilino)) {
    throw new Error('Borrador o inquilino inválido');
  }
};
const convertir = (fila) => fila && ({
  ...fila,
  fotos: JSON.parse(fila.fotos_json),
});

export const crearIdBorrador = () => Crypto.randomUUID();

export const guardarBorrador = async (borrador) => {
  comprobarPropiedad(borrador.id, borrador.id_inquilino);
  const base = await db();
  const fotos = Array.isArray(borrador.fotos) ? borrador.fotos : [];
  const resultado = await base.runAsync(
    `INSERT INTO borradores_reporte
       (id, id_inquilino, titulo, descripcion, categoria, fotos_json, id_reporte, estado, fecha_actualizacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       titulo = excluded.titulo, descripcion = excluded.descripcion,
       categoria = excluded.categoria, fotos_json = excluded.fotos_json,
       id_reporte = excluded.id_reporte, estado = excluded.estado,
       fecha_actualizacion = excluded.fecha_actualizacion
     WHERE borradores_reporte.id_inquilino = excluded.id_inquilino`,
    borrador.id, Number(borrador.id_inquilino), borrador.titulo || '',
    borrador.descripcion || '', borrador.categoria || '', JSON.stringify(fotos),
    borrador.id_reporte || null, borrador.estado || 'borrador', new Date().toISOString()
  );
  if (resultado.changes !== 1) throw new Error('El borrador pertenece a otra cuenta');
};

export const obtenerBorrador = async (id, idInquilino) => {
  comprobarPropiedad(id, idInquilino);
  const base = await db();
  return convertir(await base.getFirstAsync(
    'SELECT * FROM borradores_reporte WHERE id = ? AND id_inquilino = ?',
    id, Number(idInquilino)
  ));
};

export const listarBorradores = async (idInquilino) => {
  if (!propietarioValido(idInquilino)) throw new Error('Inquilino inválido');
  const base = await db();
  return (await base.getAllAsync(
    'SELECT * FROM borradores_reporte WHERE id_inquilino = ? ORDER BY fecha_actualizacion DESC',
    Number(idInquilino)
  )).map(convertir);
};

const carpeta = (id, idInquilino) =>
  new Directory(Paths.document, 'vlclient-borradores', String(Number(idInquilino)), id);

export const copiarFotoBorrador = async (id, idInquilino, foto) => {
  comprobarPropiedad(id, idInquilino);
  if (!foto?.uri || typeof foto.uri !== 'string') throw new Error('Fotografía inválida');
  const origen = new File(foto.uri);
  if (!origen.exists) throw new Error('La fotografía seleccionada ya no está disponible');
  const extension = /\.(jpe?g|png|webp|heic|heif)$/i.exec(foto.fileName || foto.uri)?.[1]?.toLowerCase() ||
    ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/heic': 'heic', 'image/heif': 'heif' }[foto.mimeType] || 'jpg');
  const destinoCarpeta = carpeta(id, idInquilino);
  destinoCarpeta.create({ idempotent: true, intermediates: true });
  const destino = new File(destinoCarpeta, `${Crypto.randomUUID()}.${extension}`);
  await origen.copy(destino);
  return { uri: destino.uri, nombre: destino.name,
    clave_idempotencia: Crypto.randomUUID(), enviada: false };
};

export const fotosFaltantes = (fotos) => (fotos || []).filter((foto) =>
  !foto?.enviada && (!foto?.uri || !new File(foto.uri).exists));

export const recuperarSincronizaciones = async (idInquilino) => {
  if (!propietarioValido(idInquilino)) return;
  const base = await db();
  await base.runAsync(
    `UPDATE borradores_reporte SET estado = 'pendiente_sincronizacion'
     WHERE id_inquilino = ?
       AND estado IN ('sincronizando_idempotente', 'error_reintentar')`,
    Number(idInquilino)
  );
};

export const reclamarBorrador = async (id, idInquilino) => {
  comprobarPropiedad(id, idInquilino);
  const base = await db();
  const resultado = await base.runAsync(
    `UPDATE borradores_reporte SET estado = 'sincronizando_idempotente'
     WHERE id = ? AND id_inquilino = ? AND estado = 'pendiente_sincronizacion'`,
    id, Number(idInquilino)
  );
  return resultado.changes === 1 ? obtenerBorrador(id, idInquilino) : null;
};

export const guardarProgreso = async (id, idInquilino, cambios) => {
  comprobarPropiedad(id, idInquilino);
  const base = await db();
  const actual = await obtenerBorrador(id, idInquilino);
  if (!actual || actual.estado !== 'sincronizando_idempotente') {
    throw new Error('El borrador ya no está sincronizando');
  }
  const resultado = await base.runAsync(
    `UPDATE borradores_reporte
     SET id_reporte = ?, fotos_json = ?, estado = ?, fecha_actualizacion = ?
     WHERE id = ? AND id_inquilino = ? AND estado = 'sincronizando_idempotente'`,
    cambios.id_reporte ?? actual.id_reporte,
    JSON.stringify(cambios.fotos ?? actual.fotos),
    cambios.estado || 'sincronizando_idempotente', new Date().toISOString(),
    id, Number(idInquilino)
  );
  if (resultado.changes !== 1) throw new Error('El estado del borrador cambió');
};

export const cambiarEstadoBorrador = async (id, idInquilino, desde, hacia) => {
  comprobarPropiedad(id, idInquilino);
  const base = await db();
  const resultado = await base.runAsync(
    `UPDATE borradores_reporte SET estado = ?, fecha_actualizacion = ?
     WHERE id = ? AND id_inquilino = ? AND estado = ?`,
    hacia, new Date().toISOString(), id, Number(idInquilino), desde
  );
  return resultado.changes === 1;
};

export const quitarFotoBorrador = (foto) => {
  if (foto?.uri) {
    const archivo = new File(foto.uri);
    if (archivo.exists) archivo.delete();
  }
};

export const eliminarBorrador = async (id, idInquilino) => {
  comprobarPropiedad(id, idInquilino);
  const base = await db();
  const resultado = await base.runAsync(
    `DELETE FROM borradores_reporte WHERE id = ? AND id_inquilino = ?
       AND estado IN ('borrador', 'enviado')`,
    id, Number(idInquilino)
  );
  if (resultado.changes !== 1) throw new Error('El borrador tiene un envío pendiente o no existe');
  const directorio = carpeta(id, idInquilino);
  if (directorio.exists) directorio.delete();
};
