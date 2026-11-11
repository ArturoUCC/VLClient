import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import {
  obtenerMisNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from '../services/api';

const iconos = {
  reporte: 'construct-outline',
  cita: 'calendar-outline',
  pago: 'wallet-outline',
  general: 'notifications-outline',
};

export default function NotificacionesScreen({ route }) {
  const { token } = route.params || {};

  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const cargarNotificaciones = useCallback(async (
    mostrarCarga = true
  ) => {
    if (!token) {
      setError('No hay una sesión válida.');
      setCargando(false);
      return;
    }

    if (mostrarCarga) setCargando(true);
    setError('');

    try {
      const resultado = await obtenerMisNotificaciones(token);

      setNotificaciones(resultado.notificaciones || []);

    } catch (err) {
      setError(err.message || 'Error al cargar notificaciones');
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargarNotificaciones();
    }, [cargarNotificaciones])
  );

  const marcarLeida = async (notificacion) => {
    if (notificacion.leida || procesando) return;

    setProcesando(true);

    try {
      await marcarNotificacionLeida(
        token,
        notificacion.id_notificacion
      );

      setNotificaciones((anteriores) =>
        anteriores.map((item) =>
          item.id_notificacion === notificacion.id_notificacion
            ? { ...item, leida: true }
            : item
        )
      );

    } catch (err) {
      Alert.alert(
        'Error',
        err.message || 'No se pudo marcar como leída'
      );
    } finally {
      setProcesando(false);
    }
  };

  const marcarTodas = async () => {
    if (procesando) return;

    setProcesando(true);

    try {
      await marcarTodasNotificacionesLeidas(token);

      setNotificaciones((anteriores) =>
        anteriores.map((item) => ({
          ...item,
          leida: true,
        }))
      );

    } catch (err) {
      Alert.alert(
        'Error',
        err.message || 'No se pudieron actualizar'
      );
    } finally {
      setProcesando(false);
    }
  };

  const noLeidas = notificaciones.filter(
    (item) => !item.leida
  ).length;

  const formatearFecha = (valor) => {
    if (!valor) return '';

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
      return String(valor);
    }

    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const mostrarNotificacion = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.card,
        !item.leida && styles.cardNueva,
      ]}
      onPress={() => marcarLeida(item)}
      activeOpacity={0.8}
      disabled={procesando}
    >
      <View style={styles.fila}>
        <View style={styles.iconoContainer}>
          <Ionicons
            name={iconos[item.tipo] || iconos.general}
            size={23}
            color="#23558C"
          />
        </View>

        <View style={styles.textos}>
          <View style={styles.encabezadoCard}>
            <Text style={styles.tituloCard}>
              {item.titulo}
            </Text>

            {!item.leida && (
              <View style={styles.puntoNuevo} />
            )}
          </View>

          <Text style={styles.mensaje}>
            {item.mensaje}
          </Text>

          <Text style={styles.fecha}>
            {formatearFecha(item.fecha_creacion)}
          </Text>

          <Text style={styles.estado}>
            {item.leida
              ? 'Leída'
              : 'Toca para marcar como leída'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom']}
    >
      <FlatList
        data={notificaciones}
        keyExtractor={(item) =>
          String(item.id_notificacion)
        }
        renderItem={mostrarNotificacion}
        contentContainerStyle={styles.contenido}
        refreshing={actualizando}
        onRefresh={() => {
          setActualizando(true);
          cargarNotificaciones(false);
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Ionicons
              name="notifications-outline"
              size={42}
              color="#23558C"
            />

            <Text style={styles.titulo}>
              Mis notificaciones
            </Text>

            <Text style={styles.subtitulo}>
              Consulta los avisos de tu cuenta.
            </Text>

            <View style={styles.resumen}>
              <Text style={styles.contador}>
                {noLeidas} sin leer
              </Text>

              {noLeidas > 0 && (
                <TouchableOpacity
                  onPress={marcarTodas}
                  disabled={procesando}
                >
                  <Text style={styles.marcarTodas}>
                    Marcar todas como leídas
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          cargando ? (
            <ActivityIndicator
              size="large"
              color="#23558C"
            />
          ) : (
            <View style={styles.vacio}>
              <Ionicons
                name={error
                  ? 'alert-circle-outline'
                  : 'checkmark-circle-outline'}
                size={40}
                color="#94A3B8"
              />

              <Text style={styles.mensajeVacio}>
                {error || 'No tienes notificaciones.'}
              </Text>

              {!!error && (
                <TouchableOpacity
                  onPress={() => cargarNotificaciones()}
                >
                  <Text style={styles.marcarTodas}>
                    Reintentar
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contenido: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 12,
  },
  subtitulo: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  resumen: {
    width: '100%',
    marginTop: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  contador: {
    color: '#23558C',
    fontWeight: 'bold',
    fontSize: 15,
  },
  marcarTodas: {
    color: '#23558C',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardNueva: {
    backgroundColor: '#EAF2F9',
    borderColor: '#B5D0E9',
  },
  fila: {
    flexDirection: 'row',
    gap: 12,
  },
  iconoContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E2EDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textos: {
    flex: 1,
  },
  encabezadoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  tituloCard: {
    flex: 1,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  puntoNuevo: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  mensaje: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 20,
  },
  fecha: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 12,
  },
  estado: {
    fontSize: 12,
    color: '#23558C',
    marginTop: 7,
  },
  vacio: {
    alignItems: 'center',
    padding: 35,
    gap: 12,
  },
  mensajeVacio: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
  },
});
