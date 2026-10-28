import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { obtenerMisPagos } from '../services/api';

export default function PagosScreen({ navigation, route }) {
  const token = route.params?.token;

  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');

  const cargarPagos = useCallback(async () => {
    if (!token) {
      setError('No se encontró una sesión válida.');
      setCargando(false);
      setActualizando(false);
      return;
    }

    try {
      setError('');
      const datos = await obtenerMisPagos(token);
      setPagos(datos);
    } catch (err) {
      setError(err.message || 'No se pudieron consultar los pagos.');
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarPagos();
  }, [cargarPagos]);

  const formatoMoneda = (cantidad) => {
    const numero = Number(cantidad);

    if (!Number.isFinite(numero)) return 'No disponible';

    return numero.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  };

  const formatoFecha = (valor, soloMes = false) => {
    if (!valor) return 'No disponible';

    const partes = String(valor).slice(0, 10).split('-');
    if (partes.length !== 3) return String(valor);

    const [anio, mes, dia] = partes.map(Number);
    const fecha = new Date(anio, mes - 1, dia);

    if (Number.isNaN(fecha.getTime())) return String(valor);

    return fecha.toLocaleDateString('es-MX', soloMes
      ? { month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'long', year: 'numeric' }
    );
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
              cargarPagos();
            }}
            colors={['#23558C']}
            tintColor="#23558C"
          />
        }
      >
        <View style={styles.header}>
          <Ionicons name="wallet-outline" size={30} color="#23558C" />
          <Text style={styles.title}>Mis pagos</Text>
          <Text style={styles.subtitle}>
            Consulta el historial de pagos de tus contratos.
          </Text>
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color="#23558C" />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={36} color="#DC2626" />
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={cargarPagos}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : pagos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={42} color="#94A3B8" />
            <Text style={styles.emptyTitle}>
              Todavía no hay pagos registrados
            </Text>
            <Text style={styles.emptyText}>
              Cuando se registren pagos en tu cuenta aparecerán aquí.
            </Text>
          </View>
        ) : (
          pagos.map((pago) => (
            <View key={pago.id_pago} style={styles.pagoCard}>
              <View style={styles.pagoHeader}>
                <View style={styles.iconBox}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={26}
                    color="#16A34A"
                  />
                </View>
                <View style={styles.pagoInfo}>
                  <Text style={styles.pagoMes}>
                    {formatoFecha(pago.mes, true)}
                  </Text>
                  <Text style={styles.pagoFecha}>
                    Pagado el {formatoFecha(pago.fecha_pago)}
                  </Text>
                </View>
                <Text style={styles.monto}>
                  {formatoMoneda(pago.monto)}
                </Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Propiedad</Text>
                <Text style={styles.detailValue}>
                  {pago.propiedad || 'No disponible'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Método</Text>
                <Text style={styles.detailValue}>
                  {pago.metodo_pago || 'No disponible'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Referencia</Text>
                <Text style={styles.detailValue}>
                  {pago.referencia || 'Sin referencia'}
                </Text>
              </View>
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
    marginBottom: 30,
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
    marginTop: 7,
  },
  pagoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 17,
    marginBottom: 14,
  },
  pagoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    backgroundColor: '#DCFCE7',
    padding: 9,
    borderRadius: 12,
  },
  pagoInfo: {
    flex: 1,
  },
  pagoMes: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    textTransform: 'capitalize',
  },
  pagoFecha: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  monto: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'right',
    flex: 1,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 25,
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
    color: '#64748B',
    textAlign: 'center',
    fontSize: 13,
  },
  retryText: {
    color: '#23558C',
    fontWeight: 'bold',
  },
});
