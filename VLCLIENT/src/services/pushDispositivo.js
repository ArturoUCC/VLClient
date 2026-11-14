import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { registrarDispositivoPush, desactivarDispositivoPush } from './api';

const CLAVE_INSTALACION = 'vlclient_push_instalacion_id';
const CLAVE_PREFERENCIA = 'vlclient_push_habilitado';
const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId;

const pushDisponible = () =>
  (Platform.OS === 'android' || Platform.OS === 'ios') &&
  Constants.appOwnership !== 'expo' && !!projectId;

const obtenerInstalacionId = async () => {
  let id = await SecureStore.getItemAsync(CLAVE_INSTALACION);
  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(CLAVE_INSTALACION, id);
  }
  return id;
};

export const leerPreferenciaPush = async () =>
  (await SecureStore.getItemAsync(CLAVE_PREFERENCIA)) !== 'false';

export const guardarPreferenciaPush = async (habilitado) =>
  SecureStore.setItemAsync(CLAVE_PREFERENCIA, habilitado ? 'true' : 'false');

export const registrarPushTrasLogin = async (token) => {
  if (!token || !pushDisponible()) return 'no_disponible';
  if (!(await leerPreferenciaPush())) return 'desactivado';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('avisos', {
      name: 'Avisos de Vives Lara',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  let permiso = await Notifications.getPermissionsAsync();
  if (!permiso.granted) permiso = await Notifications.requestPermissionsAsync();
  if (!permiso.granted) {
    await desactivarPushAlSalir(token);
    return 'sin_permiso';
  }

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const instalacionId = await obtenerInstalacionId();
  await registrarDispositivoPush(token, {
    instalacion_id: instalacionId,
    expo_push_token: expoPushToken,
    plataforma: Platform.OS,
    expo_project_id: projectId,
  });
  return 'registrado';
};

export const observarRotacionPush = (token) => {
  if (!token || !pushDisponible()) return () => {};
  const subscription = Notifications.addPushTokenListener(() => {
    // El evento puede contener un token nativo: solicitar de nuevo el de Expo.
    void registrarPushTrasLogin(token).catch(() => {});
  });
  return () => subscription.remove();
};

export const desactivarPushAlSalir = async (token) => {
  const instalacionId = await SecureStore.getItemAsync(CLAVE_INSTALACION);
  if (token && instalacionId) {
    await desactivarDispositivoPush(token, instalacionId);
  }
};
