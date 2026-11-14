import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import {
  backendDisponible, crearReporte, subirFotoReporteIdempotente, obtenerMiPerfil,
} from './api';
import {
  listarBorradores, recuperarSincronizaciones, reclamarBorrador,
  guardarProgreso, cambiarEstadoBorrador, fotosFaltantes,
} from './borradoresReporte';
import { crearMotorSincronizacion } from './motorSincronizacionReportes';

const observadores = new Set();
const notificar = () => observadores.forEach((avisar) => {
  try { avisar(); } catch (_) { /* La vista no debe detener la cola. */ }
});
export const observarSincronizacion = (avisar) => {
  observadores.add(avisar);
  return () => observadores.delete(avisar);
};

const motor = crearMotorSincronizacion({
  backendDisponible,
  verificarPropietario: async (token) => (await obtenerMiPerfil(token)).id_inquilino,
  estadoRed: Network.getNetworkStateAsync,
  crearReporte,
  subirFotoReporteIdempotente,
  listarBorradores,
  recuperarSincronizaciones,
  reclamarBorrador,
  guardarProgreso,
  cambiarEstadoBorrador,
  fotosFaltantes,
  nuevaClave: Crypto.randomUUID,
  notificar,
});

export const sincronizarBorradores = (token, idInquilino) =>
  motor.ejecutar(token, idInquilino);
