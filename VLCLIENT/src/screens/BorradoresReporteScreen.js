import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { eliminarBorrador, listarBorradores, fotosFaltantes } from '../services/borradoresReporte';
import { observarSincronizacion } from '../services/sincronizarReportes';

const NOMBRES = {
  borrador: 'Borrador',
  pendiente_sincronizacion: 'Pendiente de sincronización',
  sincronizando: 'Sincronizando',
  sincronizando_idempotente: 'Sincronizando',
  enviado: 'Enviado',
  error_reintentar: 'Error: reintento disponible',
  error: 'Error',
  error_ambiguo: 'Error: resultado sin confirmar',
};

export default function BorradoresReporteScreen({ navigation, route }) {
  const { token, idInquilino } = route.params || {};
  const [borradores, setBorradores] = useState([]);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    try {
      setBorradores(await listarBorradores(idInquilino));
      setError('');
    } catch (_) {
      setError('No se pudieron consultar los borradores de este dispositivo.');
    }
  }, [idInquilino]);
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));
  useEffect(() => observarSincronizacion(() => { void cargar(); }), [cargar]);

  const eliminar = (borrador) => Alert.alert('Eliminar borrador',
    'Se eliminarán también las fotografías guardadas en este dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await eliminarBorrador(borrador.id, idInquilino);
          await cargar();
        } catch (_) {
          Alert.alert('No se pudo eliminar', 'Inténtalo de nuevo.');
        }
      } },
    ]);

  return <SafeAreaView style={styles.contenedor} edges={['bottom']}>
    <Text style={styles.titulo}>Borradores de mantenimiento</Text>
    <Text style={styles.ayuda}>Se guardan en este dispositivo y solo aparecen al iniciar sesión con su propietario.</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    <TouchableOpacity style={styles.boton} onPress={() =>
      navigation.navigate('NuevoReporte', { token, idInquilino })}>
      <Text style={styles.botonTexto}>Crear borrador</Text>
    </TouchableOpacity>
    <FlatList data={borradores} keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.ayuda}>No hay borradores guardados.</Text>}
      renderItem={({ item }) => <View style={styles.tarjeta}>
        <Text style={styles.nombre}>{item.titulo || 'Sin título'}</Text>
        <Text style={styles.estado}>{NOMBRES[item.estado] || 'Borrador'}</Text>
        {!!item.id_reporte && <Text style={styles.ayuda}>Reporte #{item.id_reporte} creado. Las fotos pendientes conservan sus claves para reintentar.</Text>}
        {fotosFaltantes(item.fotos).length > 0 &&
          <Text style={styles.error}>Falta una fotografía guardada.</Text>}
        <View style={styles.acciones}>
          <TouchableOpacity onPress={() => navigation.navigate('NuevoReporte', {
            token, idInquilino, idBorrador: item.id,
          })}><Text style={styles.enlace}>{item.estado === 'borrador' ? 'Editar' : 'Abrir / revisar'}</Text></TouchableOpacity>
          {['borrador', 'enviado'].includes(item.estado) &&
            <TouchableOpacity onPress={() => eliminar(item)}>
              <Text style={styles.eliminar}>Eliminar</Text>
            </TouchableOpacity>}
        </View>
      </View>}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  titulo: { fontSize: 22, fontWeight: '700', color: '#23558C', marginBottom: 8 },
  ayuda: { color: '#64748B', fontSize: 13, marginBottom: 12 },
  error: { color: '#B91C1C', marginBottom: 12 },
  boton: { backgroundColor: '#23558C', padding: 15, borderRadius: 10, marginBottom: 20 },
  botonTexto: { color: '#FFFFFF', textAlign: 'center', fontWeight: '700' },
  tarjeta: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12 },
  nombre: { color: '#1E293B', fontWeight: '700', fontSize: 16 },
  estado: { color: '#23558C', marginVertical: 8 },
  acciones: { flexDirection: 'row', justifyContent: 'space-between' },
  enlace: { color: '#23558C', fontWeight: '700' },
  eliminar: { color: '#B91C1C', fontWeight: '700' },
});
