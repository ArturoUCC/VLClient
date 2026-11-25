import React, { useContext, useRef, useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerContentScrollView,
  DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { SesionContext } from '../context/SesionContext';
import { cerrarSesionAdmin } from '../services/api';
import { AdminInicio, AdminInquilinos, AdminDetalleInquilino,
  AdminCalendario, AdminCitas, AdminRegistro,
  AdminPerfil } from './AdminScreens';

const Drawer = createDrawerNavigator();

export default function AdminArea({ navigation, route }) {
  const token = route.params?.token;
  const { terminarSesion } = useContext(SesionContext);
  const cerrando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const salir = async () => {
    if (cerrando.current) return;
    cerrando.current = true;
    setOcupado(true);
    try {
      await cerrarSesionAdmin(token);
    } catch (_) {
      Alert.alert('Sesión cerrada en este dispositivo',
        'No se pudo confirmar el cierre en el servidor. La sesión local se eliminó.');
    } finally {
      terminarSesion();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      cerrando.current = false;
      setOcupado(false);
    }
  };
  const pantalla = (Componente) => (props) => <Componente {...props} token={token} />;
  return <Drawer.Navigator initialRouteName="InicioAdmin"
    screenOptions={({ route }) => ({ headerTintColor: '#23558C',
      headerStyle: { backgroundColor: '#F3F7FB' },
      drawerActiveTintColor: '#23558C', drawerActiveBackgroundColor: '#EAF2F9',
      drawerInactiveTintColor: '#334155', drawerItemStyle: { borderRadius: 10 },
      drawerStyle: { backgroundColor: '#FFFFFF', width: 290 },
      drawerIcon: ({ color, size }) => <Ionicons color={color} size={size}
        name={{ InicioAdmin: 'grid-outline', InquilinosAdmin: 'people-outline',
          CalendarioAdmin: 'calendar-outline', CitasAdmin: 'time-outline',
          RegistroAdmin: 'person-add-outline', PerfilAdmin: 'person-circle-outline',
          DetalleInquilinoAdmin: 'document-text-outline' }[route.name] || 'ellipse-outline'} /> })}
    drawerContent={(props) => <DrawerContentScrollView {...props}>
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Image source={require('../../assets/images/logo-viveslara-notexto.png')}
          style={{ width: 58, height: 58 }} resizeMode="contain" />
        <Text style={{ color: '#173D68', fontSize: 18, fontWeight: '700',
          marginTop: 8 }}>Vives Lara</Text>
        <Text style={{ color: '#64748B' }}>Administración</Text>
      </View>
      <DrawerItemList {...props} />
      <DrawerItem label={ocupado ? 'Cerrando sesión…' : 'Cerrar sesión'}
        onPress={salir} inactiveTintColor="#23558C" disabled={ocupado}
        icon={({ color, size }) => <Ionicons name="log-out-outline"
          color={color} size={size} />} />
    </DrawerContentScrollView>}>
    <Drawer.Screen name="InicioAdmin" options={{ title: 'Inicio' }}>
      {pantalla(AdminInicio)}
    </Drawer.Screen>
    <Drawer.Screen name="InquilinosAdmin" options={{ title: 'Inquilinos' }}>
      {pantalla(AdminInquilinos)}
    </Drawer.Screen>
    <Drawer.Screen name="CalendarioAdmin"
      options={{ title: 'Calendario y disponibilidad' }}>
      {pantalla(AdminCalendario)}
    </Drawer.Screen>
    <Drawer.Screen name="CitasAdmin" options={{ title: 'Gestión de citas' }}>
      {pantalla(AdminCitas)}
    </Drawer.Screen>
    <Drawer.Screen name="RegistroAdmin" options={{ title: 'Registrar inquilino' }}>
      {pantalla(AdminRegistro)}
    </Drawer.Screen>
    <Drawer.Screen name="PerfilAdmin" options={{ title: 'Mi perfil' }}>
      {pantalla(AdminPerfil)}
    </Drawer.Screen>
    <Drawer.Screen name="DetalleInquilinoAdmin"
      options={{ title: 'Detalle de inquilino', drawerItemStyle: { display: 'none' } }}>
      {pantalla(AdminDetalleInquilino)}
    </Drawer.Screen>
  </Drawer.Navigator>;
}
