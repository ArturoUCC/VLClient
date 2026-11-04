import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { obtenerMisReportes } from '../services/api';

export default function ReportesScreen({ navigation, route }) {
  const token = route.params?.token;

  const [reportes, setReportes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');

  const cargarReportes = useCallback(async () => {
    if (!token) {
      setError('No hay una sesión válida.');
      setCargando(false);
      setActualizando(false);
      return;
    }

    try {
      setError('');
      const datos = await obtenerMisReportes(token);
      setReportes(datos);
    } catch (err) {
      setError(err.message || 'Error al cargar reportes.');
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [token]);

  useFocusEffect(
  useCallback(() => {
    cargarReportes();
  }, [cargarReportes])
);

  const formatoFecha = (valor) => {
    if (!valor) return 'Sin fecha';

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
      return String(valor);
    }

    return fecha.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const colorEstado = (estado) => {
    switch (String(estado || '').toLowerCase()) {
      case 'resuelto':
      case 'cerrado':
        return '#16A34A';
      case 'en_proceso':
      case 'en proceso':
        return '#2563EB';
      default:
        return '#D97706';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={() => {
              setActualizando(true);
              cargarReportes();
            }}
            tintColor="#23558C"
          />
        }
      >
        <View style={styles.header}>
          <Ionicons
            name="construct-outline"
            size={35}
            color="#23558C"
          />

          <Text style={styles.title}>
            Mis reportes
          </Text>

          <Text style={styles.subtitle}>
            Consulta el estado de tus solicitudes
            de mantenimiento.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('NuevoReporte', { token })}
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color="#FFFFFF"
          />
          <Text style={styles.createText}>
            Crear nuevo reporte
          </Text>
        </TouchableOpacity>

        {cargando ? (
          <ActivityIndicator
            size="large"
            color="#23558C"
          />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="alert-circle-outline"
              size={36}
              color="#DC2626"
            />

            <Text style={styles.emptyText}>
              {error}
            </Text>

            <TouchableOpacity onPress={cargarReportes}>
              <Text style={styles.retryText}>
                Reintentar
              </Text>
            </TouchableOpacity>
          </View>
        ) : reportes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="document-text-outline"
              size={42}
              color="#94A3B8"
            />

            <Text style={styles.emptyTitle}>
              No tienes reportes registrados
            </Text>

            <Text style={styles.emptyText}>
              Aquí aparecerán tus solicitudes de
              mantenimiento cuando las registres.
            </Text>
          </View>
        ) : (
          reportes.map((reporte) => (
            <View
              key={reporte.id_reporte}
              style={styles.reportCard}
            >
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>
                  {reporte.titulo}
                </Text>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        colorEstado(reporte.estado) + '18',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: colorEstado(reporte.estado),
                      },
                    ]}
                  >
                    {reporte.estado || 'Sin estado'}
                  </Text>
                </View>
              </View>

              <Text style={styles.description}>
                {reporte.descripcion || 'Sin descripción'}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.detail}>
                Categoría: {reporte.categoria || 'General'}
              </Text>

              <Text style={styles.detail}>
                Prioridad: {reporte.prioridad || 'No asignada'}
              </Text>

              <Text style={styles.detail}>
                Fecha: {formatoFecha(
                  reporte.fecha_reporte ||
                  reporte.fecha_creacion
                )}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  createButton: {
    backgroundColor: '#23558C',
    borderRadius: 13,
    paddingVertical: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 25,
  },
  createText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  description: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  detail: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 5,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 25,
    borderRadius: 14,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  retryText: {
    color: '#23558C',
    fontWeight: 'bold',
  },
});
