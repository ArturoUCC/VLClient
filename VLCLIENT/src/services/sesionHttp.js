class SesionExpiradaError extends Error {
  constructor() {
    super('Tu sesión terminó. Inicia sesión nuevamente.');
    this.name = 'SesionExpiradaError';
  }
}

let alExpirarSesion = null;
const configurarManejadorSesionExpirada = (manejador) => {
  alExpirarSesion = manejador;
};

const comprobarSesion = (respuesta, opciones) => {
  const autorizacion = opciones?.headers?.Authorization;
  if (respuesta.status === 401 && typeof autorizacion === 'string' &&
      autorizacion.startsWith('Bearer ')) {
    alExpirarSesion?.(autorizacion.slice(7));
    throw new SesionExpiradaError();
  }
  return respuesta;
};

module.exports = {
  SesionExpiradaError,
  configurarManejadorSesionExpirada,
  comprobarSesion,
};
