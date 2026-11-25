const { evaluarPassword } = require('./passwordPolicy');

const fechaValida = (valor) => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d;
};

const validarRegistroInquilino = (campos, propiedad) => {
  const correo = campos.correo?.trim().toLowerCase() || '';
  if (typeof campos.nombre !== 'string' || !campos.nombre.trim() ||
      campos.nombre.trim().length > 100 ||
      typeof campos.apellido !== 'string' || !campos.apellido.trim() ||
      campos.apellido.trim().length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150 ||
      typeof campos.telefono !== 'string' || campos.telefono.length > 20 ||
      !evaluarPassword(campos.password).valida ||
      campos.confirmacion !== campos.password || !propiedad?.disponible ||
      !fechaValida(campos.fecha_inicio) || !fechaValida(campos.fecha_fin) ||
      campos.fecha_fin <= campos.fecha_inicio ||
      typeof campos.renta !== 'string' ||
      !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(campos.renta)) {
    return false;
  }
  return true;
};

module.exports = { validarRegistroInquilino };
