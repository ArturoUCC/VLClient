import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { SesionContext } from './src/context/SesionContext';
import { obtenerMisNotificaciones, configurarManejadorSesionExpirada } from './src/services/api';
import {
  extraerIdNotificacion,
  claveInteraccion,
  consultarAvisoPropio,
} from './src/services/pushRespuesta';

import BienvenidaScreen from './src/screens/BienvenidaScreen';
import LoginScreen from './src/screens/LoginScreen';
import RecuperarPasswordScreen from './src/screens/RecuperarPasswordScreen';
import InicioScreen from './src/screens/InicioScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import PagosScreen from './src/screens/PagosScreen';
import ReportesScreen from './src/screens/ReportesScreen';
import NuevoReporteScreen from './src/screens/NuevoReporteScreen';
import BorradoresReporteScreen from './src/screens/BorradoresReporteScreen';
import NuevaCitaScreen from './src/screens/NuevaCitaScreen';
import NotificacionesScreen from './src/screens/NotificacionesScreen';
import ReagendarCitaScreen from './src/screens/ReagendarCitaScreen';

const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const [sesionToken, setSesionToken] = useState(null);
  const tokenRef = useRef(null);
  const pendienteRef = useRef(null);
  const procesandoRef = useRef(false);
  const interaccionesRef = useRef(new Set());

  const navegarAlAviso = useCallback(async () => {
    const pendiente = pendienteRef.current;
    const token = tokenRef.current;
    if (!pendiente || !token || procesandoRef.current || !navigationRef.isReady()) return;
    const ruta = navigationRef.getCurrentRoute()?.name;
    if (!ruta || ['Bienvenida', 'Login', 'RecuperarPassword'].includes(ruta)) return;

    procesandoRef.current = true;
    try {
      const aviso = await consultarAvisoPropio(
        token, pendiente.id, obtenerMisNotificaciones
      );
      if (pendienteRef.current !== pendiente || tokenRef.current !== token) return;
      if (!aviso) {
        pendienteRef.current = null;
        await Notifications.clearLastNotificationResponseAsync();
        return;
      }
      if (!navigationRef.isReady() ||
          ['Bienvenida', 'Login', 'RecuperarPassword'].includes(
            navigationRef.getCurrentRoute()?.name)) return;

      pendienteRef.current = null;
      navigationRef.navigate('Notificaciones', {
        token,
        idNotificacionSeleccionada: pendiente.id,
      });
      await Notifications.clearLastNotificationResponseAsync();
    } catch (_) {
      // Si la red o la sesión falla, se conserva el identificador para reintentar.
    } finally {
      procesandoRef.current = false;
      if (pendienteRef.current && pendienteRef.current !== pendiente) {
        void navegarAlAviso();
      }
    }
  }, [navigationRef]);

  const recibirPulsacion = useCallback((respuesta) => {
    const id = extraerIdNotificacion(respuesta);
    if (!id) return;
    const clave = claveInteraccion(respuesta, id);
    if (interaccionesRef.current.has(clave)) return;
    interaccionesRef.current.add(clave);
    if (interaccionesRef.current.size > 50) {
      interaccionesRef.current.delete(interaccionesRef.current.values().next().value);
    }
    pendienteRef.current = { id };
    void navegarAlAviso();
  }, [navegarAlAviso]);

  useEffect(() => {
    const suscripcion = Notifications.addNotificationResponseReceivedListener(
      recibirPulsacion
    );
    void Notifications.getLastNotificationResponseAsync()
      .then((respuesta) => { if (respuesta) recibirPulsacion(respuesta); })
      .catch(() => {});
    return () => suscripcion.remove();
  }, [recibirPulsacion]);

  useEffect(() => { void navegarAlAviso(); }, [sesionToken, navegarAlAviso]);

  const activarSesion = useCallback((token) => {
    tokenRef.current = token;
    setSesionToken(token);
  }, []);
  const terminarSesion = useCallback(() => {
    tokenRef.current = null;
    pendienteRef.current = null;
    interaccionesRef.current.clear();
    setSesionToken(null);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, []);
  useEffect(() => {
    configurarManejadorSesionExpirada((token) => {
      if (tokenRef.current !== token) return;
      terminarSesion();
      if (navigationRef.isReady()) {
        navigationRef.resetRoot({ index: 0, routes: [{ name: 'Login' }] });
      }
    });
    return () => configurarManejadorSesionExpirada(null);
  }, [navigationRef, terminarSesion]);
  const sesion = useMemo(() => ({ activarSesion, terminarSesion }),
    [activarSesion, terminarSesion]);

  return (
    <SesionContext.Provider value={sesion}>
    <NavigationContainer ref={navigationRef} onReady={() => void navegarAlAviso()}
      onStateChange={() => void navegarAlAviso()}>
      <Stack.Navigator initialRouteName="Bienvenida">
        <Stack.Screen
          name="Bienvenida"
          component={BienvenidaScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Iniciar sesión' }}
        />

        <Stack.Screen
          name="RecuperarPassword"
          component={RecuperarPasswordScreen}
          options={{ title: 'Recuperar contraseña' }}
        />

        <Stack.Screen
          name="Inicio"
          component={InicioScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Perfil"
          component={PerfilScreen}
          options={{ title: 'Mi perfil' }}
        />

        <Stack.Screen
         name="Pagos"
         component={PagosScreen}
         options={{ title: 'Mis pagos' }}
        />

        <Stack.Screen
         name="Reportes"
         component={ReportesScreen}
         options={{ title: 'Mis reportes' }}
        />

        <Stack.Screen
         name="NuevoReporte"
         component={NuevoReporteScreen}
         options={{ title: 'Nuevo reporte' }}
        />

        <Stack.Screen name="BorradoresReporte" component={BorradoresReporteScreen}
          options={{ title: 'Borradores de mantenimiento' }} />

        <Stack.Screen
         name="NuevaCita"
         component={NuevaCitaScreen}
         options={{ title: 'Programar cita' }}
        />

        <Stack.Screen
         name="Notificaciones"
         component={NotificacionesScreen}
         options={{ title: 'Mis notificaciones' }}
        />

        <Stack.Screen
          name="ReagendarCita"
          component={ReagendarCitaScreen}
          options={{ title: 'Reagendar cita' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </SesionContext.Provider>
  );
}
