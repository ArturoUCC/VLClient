import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { SesionContext } from './src/context/SesionContext';
import { obtenerMisNotificaciones, configurarManejadorSesionExpirada,
  obtenerMiPerfil, obtenerPerfilAdmin } from './src/services/api';
import { borrarSesion, leerSesion } from './src/services/sesionPersistida';
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
import AdminArea from './src/admin/AdminArea';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  const [sesionRol, setSesionRol] = useState(null);
  const tokenRef = useRef(null);
  const rolRef = useRef(null);
  const pendienteRef = useRef(null);
  const procesandoRef = useRef(false);
  const interaccionesRef = useRef(new Set());
  const restauracionRef = useRef(false);

  const navegarAlAviso = useCallback(async () => {
    const pendiente = pendienteRef.current;
    const token = tokenRef.current;
    if (!pendiente || !token || rolRef.current !== 'inquilino' ||
        procesandoRef.current || !navigationRef.isReady()) return;
    const ruta = navigationRef.getCurrentRoute()?.name;
    if (!ruta || ['Bienvenida', 'Login', 'RecuperarPassword',
      'AdminArea'].includes(ruta)) return;

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

  const activarSesion = useCallback((token, rol = 'inquilino') => {
    tokenRef.current = token;
    rolRef.current = rol;
    setSesionToken(token);
    setSesionRol(rol);
  }, []);
  const terminarSesion = useCallback(() => {
    tokenRef.current = null;
    rolRef.current = null;
    pendienteRef.current = null;
    interaccionesRef.current.clear();
    setSesionToken(null);
    setSesionRol(null);
    void borrarSesion().catch(() => {});
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, []);
  const restaurarSesion = useCallback(async () => {
    if (restauracionRef.current) return;
    restauracionRef.current = true;
    try {
      const guardada = await leerSesion();
      if (!guardada || tokenRef.current) return;
      const perfil = guardada.rol === 'administrador'
        ? await obtenerPerfilAdmin(guardada.token)
        : await obtenerMiPerfil(guardada.token);
      if (tokenRef.current || !navigationRef.isReady()) return;
      activarSesion(guardada.token, guardada.rol);
      navigationRef.resetRoot({ index: 0, routes: [guardada.rol === 'administrador'
        ? { name: 'AdminArea', params: { token: guardada.token,
          administrador: perfil } }
        : { name: 'Inicio', params: { token: guardada.token,
          inquilino: perfil } }] });
    } catch (error) {
      // Solo una sesión revocada se elimina. Un fallo de red permite reintentar.
      if (error?.name === 'SesionExpiradaError') {
        void borrarSesion().catch(() => {});
      }
    }
  }, [activarSesion, navigationRef]);
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
  const sesion = useMemo(() => ({ activarSesion, terminarSesion, sesionRol }),
    [activarSesion, terminarSesion, sesionRol]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SesionContext.Provider value={sesion}>
    <NavigationContainer ref={navigationRef} onReady={() => {
      void restaurarSesion(); void navegarAlAviso();
    }}
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
        <Stack.Screen name="AdminArea" component={AdminArea}
          options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
    </SesionContext.Provider>
    </GestureHandlerRootView>
  );
}
