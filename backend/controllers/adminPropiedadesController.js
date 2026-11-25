const pool = require('../config/db');

const buscarPropiedades = async (req, res) => {
  const buscar = String(req.query.buscar || '').trim();
  if (buscar.length > 100) return res.status(400).json({ mensaje: 'Búsqueda demasiado larga' });
  try {
    const resultado = await pool.query(
      `SELECT p.id_propiedad,p.nombre,p.direccion,p.edificio,p.numero_departamento,
              p.renta_mensual,p.estado,
              NOT EXISTS (SELECT 1 FROM contratos c
                WHERE c.id_propiedad=p.id_propiedad AND c.estado='activo') AS sin_contrato_activo,
              (p.estado='disponible' AND NOT EXISTS
                (SELECT 1 FROM contratos c WHERE c.id_propiedad=p.id_propiedad
                  AND c.estado='activo')) AS disponible
       FROM propiedades p
       WHERE ($1='' OR p.nombre ILIKE '%' || $1 || '%'
         OR p.direccion ILIKE '%' || $1 || '%')
       ORDER BY p.nombre,p.id_propiedad LIMIT 50`, [buscar]);
    return res.json({ propiedades: resultado.rows });
  } catch (_) {
    return res.status(503).json({ mensaje: 'No se pudieron consultar las propiedades' });
  }
};

module.exports = { buscarPropiedades };
