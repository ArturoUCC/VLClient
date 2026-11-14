import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BienvenidaScreen from './src/screens/BienvenidaScreen';
import LoginScreen from './src/screens/LoginScreen';
import RecuperarPasswordScreen from './src/screens/RecuperarPasswordScreen';
import InicioScreen from './src/screens/InicioScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import PagosScreen from './src/screens/PagosScreen';
import ReportesScreen from './src/screens/ReportesScreen';
import NuevoReporteScreen from './src/screens/NuevoReporteScreen';
import NuevaCitaScreen from './src/screens/NuevaCitaScreen';
import NotificacionesScreen from './src/screens/NotificacionesScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
