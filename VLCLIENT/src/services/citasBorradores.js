import { obtenerMiPerfil, obtenerMisCitas } from './api';
import { retirarBorradorConCita } from './borradoresReporte';
import { crearConciliadorCitasBorradores } from './citasBorradoresCore';

const conciliador = crearConciliadorCitasBorradores({
  obtenerMiPerfil, obtenerMisCitas, retirarBorradorConCita,
});

export const confirmarCitaDeBorrador = conciliador.confirmar;
export const conciliarCitasDeBorradores = conciliador.conciliar;
