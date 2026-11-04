import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BienvenidaScreen from './src/screens/BienvenidaScreen';
import LoginScreen from './src/screens/LoginScreen';
import InicioScreen from './src/screens/InicioScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import PagosScreen from './src/screens/PagosScreen';
import ReportesScreen from './src/screens/ReportesScreen';
import NuevoReporteScreen from './src/screens/NuevoReporteScreen';

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}