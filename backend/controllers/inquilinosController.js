const pool = require('../config/db');

// Obtener todos los inquilinos (uso interno de desarrollo)
const obtenerInquilinos = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id_inquilino, nombre, apellido, correo, activo
       FROM inquilinos
       ORDER BY id_inquilino ASC`
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar inquilinos:', error.message);
    res.status(500).json({
      mensaje: 'Error al obtener inquilinos'
    });
  }
};

module.exports = { obtenerInquilinos };
