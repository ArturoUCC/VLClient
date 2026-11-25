import * as SecureStore from 'expo-secure-store';

const CLAVE = 'vlclient-sesion-v1';
let operacion = Promise.resolve();

export const guardarSesion = (token, rol) => {
  if (!token || !['administrador', 'inquilino'].includes(rol)) {
    return Promise.reject(new Error('Sesión inválida'));
  }
  operacion = operacion.catch(() => {}).then(() =>
    SecureStore.setItemAsync(CLAVE, JSON.stringify({ token, rol })));
  return operacion;
};

export const borrarSesion = () => {
  operacion = operacion.catch(() => {}).then(() => SecureStore.deleteItemAsync(CLAVE));
  return operacion;
};

export const leerSesion = async () => {
  await operacion.catch(() => {});
  const valor = await SecureStore.getItemAsync(CLAVE);
  if (!valor) return null;
  try {
    const sesion = JSON.parse(valor);
    return typeof sesion.token === 'string' &&
      ['administrador', 'inquilino'].includes(sesion.rol) ? sesion : null;
  } catch (_) { return null; }
};
