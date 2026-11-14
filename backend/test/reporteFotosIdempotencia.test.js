const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const fotos = new Map();
const recursos = new Map();
let uploads = 0;
let fallarRespuesta = false;
let fallarInsercion = false;
let fallarUpload = false;
const pool = {
  async query(sql, params) {
    if (sql.includes('FROM reportes r')) {
      return { rows: params[0] === 4 && params[1] === 1 ? [{ id_reporte: 4 }] : [] };
    }
    if (sql.includes('FROM reporte_fotos')) {
      return { rows: fotos.has(params[1]) ? [fotos.get(params[1])] : [] };
    }
    throw new Error('Consulta inesperada');
  },
  async connect() {
    return {
      release() {},
      async query(sql, params) {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
        if (sql.includes('FROM reportes r')) return pool.query(sql, params);
        if (sql.includes('SELECT * FROM reporte_fotos')) return pool.query(sql, params);
        if (sql.includes('COUNT(*)')) return { rows: [{ total: fotos.size }] };
        if (sql.includes('INSERT INTO reporte_fotos')) {
          if (fallarInsercion) throw new Error('Base interrumpida');
          const [idReporte, url, nombre, clave] = params;
          if (fotos.has(clave)) return { rows: [] };
          const fila = { id_foto: fotos.size + 1, id_reporte: idReporte,
            url_foto: url, nombre_archivo: nombre, clave_idempotencia: clave };
          fotos.set(clave, fila);
          return { rows: [fila] };
        }
        throw new Error('Consulta inesperada');
      },
    };
  },
};
const cloudinary = {
  uploader: {
    upload_stream(options, callback) {
      return { end() {
        uploads++;
        if (fallarUpload) {
          callback(new Error('Cloudinary indisponible'));
          return;
        }
        const imagen = { public_id: options.public_id,
          secure_url: `https://res.cloudinary.com/demo/image/upload/${options.public_id}.jpg` };
        recursos.set(options.public_id, imagen);
        callback(fallarRespuesta ? new Error('Respuesta perdida') : null,
          fallarRespuesta ? null : imagen);
      } };
    },
  },
  api: { async resource(id) {
    if (!recursos.has(id)) throw new Error('No existe');
    return recursos.get(id);
  } },
};
const original = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return pool;
  if (request === '../config/cloudinary') return cloudinary;
  if (request === '../utils/validarImagen') return { imagenValida: () => true };
  return original.call(this, request, parent, isMain);
};
const { subirFotoIdempotente } = require('../controllers/reporteFotosIdempotenteController');
Module._load = original;
const clave = '00000000-0000-4000-8000-000000000002';
const solicitud = (owner = 1, buffer = Buffer.from('foto')) => ({
  usuario: { id_inquilino: owner }, params: { idReporte: '4' },
  body: { clave_idempotencia: clave },
  files: [{ originalname: 'foto.jpg', buffer }],
});
const respuesta = () => ({ statusCode: 200,
  status(codigo) { this.statusCode = codigo; return this; },
  json(cuerpo) { this.body = cuerpo; return this; },
});

test('la propiedad se verifica antes de contactar Cloudinary', async () => {
  const res = respuesta();
  await subirFotoIdempotente(solicitud(2), res);
  assert.equal(res.statusCode, 404);
  assert.equal(uploads, 0);
});

test('se recupera un upload cuya respuesta se perdió y el reenvío no duplica', async () => {
  fallarRespuesta = true;
  const primero = respuesta();
  await subirFotoIdempotente(solicitud(), primero);
  assert.equal(primero.statusCode, 201);
  fallarRespuesta = false;
  const segundo = respuesta();
  await subirFotoIdempotente(solicitud(), segundo);
  assert.equal(segundo.statusCode, 200);
  assert.equal(fotos.size, 1);
  assert.equal(uploads, 1);
});

test('la misma clave con bytes distintos se rechaza sin sobrescribir', async () => {
  const res = respuesta();
  await subirFotoIdempotente(solicitud(1, Buffer.from('otra foto')), res);
  assert.equal(res.statusCode, 409);
  assert.equal(fotos.size, 1);
  assert.equal(uploads, 1);
});

test('un fallo real de Cloudinary no crea la fila de fotografía', async () => {
  const otraClave = '00000000-0000-4000-8000-000000000005';
  const req = solicitud(); req.body.clave_idempotencia = otraClave;
  fallarUpload = true;
  const res = respuesta();
  await subirFotoIdempotente(req, res);
  fallarUpload = false;
  assert.equal(res.statusCode, 503);
  assert.equal(fotos.has(otraClave), false);
});

test('si la base falla después de Cloudinary, un reintento recupera el recurso', async () => {
  const otraClave = '00000000-0000-4000-8000-000000000003';
  fallarInsercion = true;
  const req = solicitud(); req.body.clave_idempotencia = otraClave;
  const res = respuesta();
  await subirFotoIdempotente(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(fotos.size, 1);
  fallarInsercion = false;
  const segundo = respuesta();
  await subirFotoIdempotente(req, segundo);
  assert.equal(segundo.statusCode, 201);
  assert.equal(fotos.size, 2);
});

test('dos cargas simultáneas de la misma clave no crean dos fotografías', async () => {
  const otraClave = '00000000-0000-4000-8000-000000000004';
  const req = solicitud(); req.body.clave_idempotencia = otraClave;
  const respuestas = [respuesta(), respuesta()];
  await Promise.all(respuestas.map((res) => subirFotoIdempotente(req, res)));
  assert.equal(fotos.has(otraClave), true);
  assert.equal(fotos.size, 3);
  assert.ok(respuestas.some((res) => res.statusCode === 201));
});
