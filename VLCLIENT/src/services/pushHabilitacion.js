// La primera versión conserva el código push, pero exige activación explícita.
const estaHabilitadoPushRemoto = (extra) =>
  extra?.pushRemotoHabilitado === true;

module.exports = { estaHabilitadoPushRemoto };
