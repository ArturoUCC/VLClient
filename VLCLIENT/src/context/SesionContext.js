import { createContext } from 'react';

export const SesionContext = createContext({
  activarSesion: () => {},
  terminarSesion: () => {},
});
