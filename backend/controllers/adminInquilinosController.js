const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { evaluarPassword } = require('../utils/passwordPolicy');
const { fechaValida } = require('./disponibilidadController');

const registrarInquilino = async (req, res) => {
  const { nombre, apellido, correo, telefono, password, confirmacion,
    id_propiedad, fecha_inicio, fecha_fin, renta_acordada } = req.body || {};
  const propiedadId = Number(id_propiedad);
  const correoNormalizado = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  // Un decimal como string evita redondeos previos de Number en JavaScript.
  const renta = typeof renta_acordada === 'string' ? renta_acordada : '';
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100 ||
      typeof apellido !== 'string' || !apellido.trim() || apellido.trim().length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado) ||
      correoNormalizado.length > 150 ||
      telefono != null && (typeof telefono !== 'string' || telefono.length > 20) ||
      !evaluarPassword(password).valida || confirmacion !== password ||
      !Number.isSafeInteger(propiedadId) || propiedadId <= 0 ||
      !fechaValida(fecha_inicio) || !fechaValida(fecha_fin) ||
      fecha_fin <= fecha_inicio ||
      !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(renta)) {
    return res.status(400).json({ mensaje: 'Datos de registro inválidos' });
  }
  let client;
  let transaccion = false;
  try {
    const hash = await bcrypt.hash(password, 12);
    client = await pool.connect();
    await client.query('BEGIN'); transaccion = true;
    // El bloqueo de la propiedad serializa dos altas concurrentes para ella.
    const propiedad = await client.query(
      `SELECT id_propiedad,estado FROM propiedades
       WHERE id_propiedad=$1 FOR UPDATE`, [propiedadId]);
    if (!propiedad.rows.length) {
      await client.query('ROLLBACK'); transaccion = false;
      return res.status(404).json({ mensaje: 'Propiedad no encontrada' });
    }
    if (propiedad.rows[0].estado !== 'disponible') {
      await client.query('ROLLBACK'); transaccion = false;
      return res.status(409).json({ mensaje: 'La propiedad no está disponible' });
    }
    const ocupado = await client.query(
      `SELECT 1 FROM contratos WHERE id_propiedad=$1 AND estado='activo' LIMIT 1`,
      [propiedadId]);
    if (ocupado.rows.length) {
      await client.query('ROLLBACK'); transaccion = false;
      return res.status(409).json({ mensaje: 'La propiedad ya tiene contrato activo' });
    }
    const correoExistente = await client.query(
      `SELECT 1 FROM inquilinos WHERE lower(correo)=lower($1) LIMIT 1`,
      [correoNormalizado]);
    if (correoExistente.rows.length) {
      await client.query('ROLLBACK'); transaccion = false;
      return res.status(409).json({ mensaje: 'El correo ya está registrado' });
    }
    const alta = await client.query(
      `INSERT INTO inquilinos
       (nombre,apellido,correo,password_hash,telefono,activo,sesion_version,
        recordatorio_renta_dias)
       VALUES($1,$2,$3,$4,$5,TRUE,0,5)
       RETURNING id_inquilino,nombre,apellido,correo,activo,recordatorio_renta_dias`,
      [nombre.trim(), apellido.trim(), correoNormalizado, hash,
        telefono?.trim() || null]);
    const contrato = await client.query(
      `INSERT INTO contratos
       (id_inquilino,id_propiedad,fecha_inicio,fecha_fin,renta_acordada,estado)
       VALUES($1,$2,$3,$4,$5,'activo') RETURNING id_contrato`,
      [alta.rows[0].id_inquilino, propiedadId, fecha_inicio, fecha_fin, renta]);
    await client.query(`UPDATE propiedades SET estado='rentada' WHERE id_propiedad=$1`,
      [propiedadId]);
    await client.query(
      `INSERT INTO bitacora_administrativa
       (id_administrador,accion,entidad,entidad_id,detalles)
       VALUES($1,'crear_inquilino','inquilinos',$2,$3::jsonb)`,
      [req.administrador.id_administrador, alta.rows[0].id_inquilino,
        JSON.stringify({ id_contrato: contrato.rows[0].id_contrato,
          id_propiedad: propiedadId })]);
    await client.query('COMMIT'); transaccion = false;
    return res.status(201).json({ inquilino: alta.rows[0],
      contrato: { id_contrato: contrato.rows[0].id_contrato,
        id_propiedad: propiedadId, fecha_inicio, fecha_fin,
        renta_acordada: renta, estado: 'activo' } });
  } catch (error) {
    if (transaccion && client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'El correo o la propiedad ya está en uso' });
    }
    if (['23503','23514','22001','22003'].includes(error.code)) {
      return res.status(400).json({ mensaje: 'Datos incompatibles con el registro' });
    }
    return res.status(503).json({ mensaje: 'No se pudo registrar al inquilino' });
  } finally { if (client) client.release(); }
};

const listarInquilinos = async (req, res) => {
  const pagina = Number(req.query.pagina || 1);
  const limite = Number(req.query.limite || 20);
  const estado = req.query.estado || 'todos';
  const busqueda = String(req.query.buscar || '').trim();
  if (!Number.isSafeInteger(pagina) || pagina < 1 ||
      !Number.isSafeInteger(limite) || limite < 1 || limite > 50 ||
      !['todos','activos','inactivos'].includes(estado) || busqueda.length > 100) {
    return res.status(400).json({ mensaje: 'Filtros inválidos' });
  }
  try {
    const resultado = await pool.query(
      `SELECT i.id_inquilino, i.nombre, i.apellido, i.correo, i.activo,
              c.id_contrato, c.estado AS estado_contrato,
              TO_CHAR(c.fecha_inicio,'YYYY-MM-DD') AS fecha_inicio,
              TO_CHAR(c.fecha_fin,'YYYY-MM-DD') AS fecha_fin,
              p.id_propiedad, p.nombre AS propiedad, p.direccion,
              COUNT(*) OVER()::integer AS total
       FROM inquilinos i
       LEFT JOIN LATERAL (
         SELECT id_contrato,id_propiedad,estado,fecha_inicio,fecha_fin
         FROM contratos WHERE id_inquilino=i.id_inquilino
         ORDER BY (estado='activo') DESC, fecha_inicio DESC LIMIT 1
       ) c ON TRUE
       LEFT JOIN propiedades p ON p.id_propiedad=c.id_propiedad
       WHERE ($1='todos' OR i.activo=($1='activos'))
         AND ($2='' OR i.nombre ILIKE '%' || $2 || '%'
           OR i.apellido ILIKE '%' || $2 || '%'
           OR i.correo ILIKE '%' || $2 || '%')
       ORDER BY i.id_inquilino DESC LIMIT $3 OFFSET $4`,
      [estado, busqueda, limite, (pagina - 1) * limite]);
    return res.json({ total: resultado.rows[0]?.total || 0,
      inquilinos: resultado.rows.map(({ total, ...fila }) => fila) });
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudieron consultar los inquilinos' });
  }
};

const detalleInquilino = async (req, res) => {
  const id = Number(req.params.idInquilino);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: 'Inquilino inválido' });
  }
  try {
    const consultas = await Promise.all([
      pool.query(`SELECT id_inquilino,nombre,apellido,correo,telefono,activo,
          fecha_registro,recordatorio_renta_dias
        FROM inquilinos WHERE id_inquilino=$1`, [id]),
      pool.query(`SELECT c.id_contrato,c.id_propiedad,c.estado,c.renta_acordada,
          TO_CHAR(c.fecha_inicio,'YYYY-MM-DD') AS fecha_inicio,
          TO_CHAR(c.fecha_fin,'YYYY-MM-DD') AS fecha_fin,
          p.nombre AS propiedad,p.direccion,p.edificio,p.numero_departamento
        FROM contratos c JOIN propiedades p ON p.id_propiedad=c.id_propiedad
        WHERE c.id_inquilino=$1 ORDER BY c.fecha_inicio DESC LIMIT 100`, [id]),
      pool.query(`SELECT ec.id_estado_cuenta,ec.mes,ec.fecha_limite,ec.total,
          ec.estado,COALESCE(SUM(pg.monto),0) AS total_pagado,
          ec.total-COALESCE(SUM(pg.monto),0) AS saldo
        FROM estados_de_cuenta ec JOIN contratos c ON c.id_contrato=ec.id_contrato
        LEFT JOIN pagos pg ON pg.id_estado_cuenta=ec.id_estado_cuenta
        WHERE c.id_inquilino=$1
        GROUP BY ec.id_estado_cuenta ORDER BY ec.fecha_limite DESC LIMIT 100`, [id]),
      pool.query(`SELECT r.id_reporte,r.id_contrato,r.titulo,r.descripcion,
          r.categoria,r.estado,r.fecha_reporte,
          COALESCE(json_agg(json_build_object('id_foto',rf.id_foto,
            'url_foto',rf.url_foto) ORDER BY rf.id_foto)
            FILTER (WHERE rf.id_reporte IS NOT NULL),'[]') AS fotos
        FROM reportes r JOIN contratos c ON c.id_contrato=r.id_contrato
        LEFT JOIN reporte_fotos rf ON rf.id_reporte=r.id_reporte
        WHERE c.id_inquilino=$1 GROUP BY r.id_reporte
        ORDER BY r.fecha_reporte DESC LIMIT 100`, [id]),
      pool.query(`SELECT ci.id_cita,ci.id_reporte,
          TO_CHAR(ci.fecha_cita,'YYYY-MM-DD') AS fecha_cita,
          TO_CHAR(ci.hora_cita,'HH24:MI') AS hora_cita,
          ci.estado,ci.reagendado_estado,ci.reagendado_solicitado_at,
          ci.reagendado_usado_at,ci.segundo_horario_no_disponible_at
        FROM citas ci JOIN reportes r ON r.id_reporte=ci.id_reporte
        JOIN contratos c ON c.id_contrato=r.id_contrato
        WHERE c.id_inquilino=$1 ORDER BY ci.fecha_cita DESC LIMIT 100`, [id]),
    ]);
    if (!consultas[0].rows.length) {
      return res.status(404).json({ mensaje: 'Inquilino no encontrado' });
    }
    return res.json({ inquilino: consultas[0].rows[0],
      contratos: consultas[1].rows, estados_cuenta: consultas[2].rows,
      reportes: consultas[3].rows.map((reporte) => ({ ...reporte,
        fotos: reporte.fotos.map((foto) => ({ ...foto,
          url_miniatura: typeof foto.url_foto === 'string' &&
            /^https:\/\/res\.cloudinary\.com\//.test(foto.url_foto)
            ? foto.url_foto.replace('/upload/',
              '/upload/c_limit,w_320,h_320,q_auto,f_auto/') : foto.url_foto,
        })),
      })), citas: consultas[4].rows });
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudo consultar el detalle' });
  }
};

module.exports = { listarInquilinos, detalleInquilino, registrarInquilino };
