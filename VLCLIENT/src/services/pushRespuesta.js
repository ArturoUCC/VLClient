// Los datos del push son una referencia no confiable, nunca el contenido del aviso.
export const extraerIdNotificacion = (respuesta) => {
  const valor = respuesta?.notification?.request?.content?.data?.id_notificacion;
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const texto = String(valor);
  if (!/^[1-9]\d*$/.test(texto)) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) ? id : null;
};

export const claveInteraccion = (respuesta, idNotificacion) => {
  const identificador = respuesta?.notification?.request?.identifier;
  const accion = respuesta?.actionIdentifier;
  return typeof identificador === 'string' && identificador
    ? `${identificador}:${typeof accion === 'string' ? accion : ''}`
    : `aviso:${idNotificacion}`;
};

export const consultarAvisoPropio = async (token, idNotificacion, consultar) => {
  if (!token || !Number.isSafeInteger(idNotificacion) || idNotificacion <= 0) {
    return null;
  }
  const respuesta = await consultar(token);
  return (respuesta.notificaciones || []).find((aviso) =>
    Number(aviso.id_notificacion) === idNotificacion) || null;
};
