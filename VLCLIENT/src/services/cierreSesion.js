// La salida local se completa sin esperar el resultado de una petición remota.
const cerrarSesionLocal = (token, desactivarDispositivo, limpiarSesion, volverAlInicio) => {
  void Promise.resolve().then(() => desactivarDispositivo(token)).catch(() => {});
  limpiarSesion();
  volverAlInicio();
};

module.exports = { cerrarSesionLocal };
