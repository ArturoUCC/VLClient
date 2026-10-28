import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { obtenerMiEstadoCuenta } from '../services/api';

export default function InicioScreen({ navigation, route }) {

  // Datos recibidos después del login
  const { token, inquilino } = route.params || {};

  const [estadoCuenta, setEstadoCuenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');

  const cargarEstadoCuenta = useCallback(async () => {
    if (!token) {
      setError('No se encontró una sesión válida. Inicia sesión nuevamente.');
      setCargando(false);
      return;
    }

    try {
      setError('');
      const datos = await obtenerMiEstadoCuenta(token);
      setEstadoCuenta(datos);
    } catch (err) {
      setError(err.message || 'No se pudo consultar el estado de cuenta.');
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarEstadoCuenta();
  }, [cargarEstadoCuenta]);

  const actualizar = () => {
    setActualizando(true);
    cargarEstadoCuenta();
  };

  const formatoMoneda = (cantidad) => {
    const numero = Number(cantidad);

    if (!Number.isFinite(numero)) {
      return 'No disponible';
    }

    return numero.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  };

  const formatoFecha = (fecha) => {
    if (!fecha) return 'No disponible';

    const fechaTexto = String(fecha);
    const fechaSoloDia = fechaTexto.slice(0, 10);
    const partes = fechaSoloDia.split('-');

    if (partes.length !== 3) return fechaTexto;

    const [anio, mes, dia] = partes.map(Number);

    if (!anio || !mes || !dia) return fechaTexto;

    const fechaLocal = new Date(anio, mes - 1, dia);

    return fechaLocal.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const nombreCompleto = estadoCuenta
    ? `${estadoCuenta.nombre || ''} ${estadoCuenta.apellido || ''}`.trim()
    : `${inquilino?.nombre || ''} ${inquilino?.apellido || ''}`.trim();

  const nombreMostrar = nombreCompleto || 'Inquilino';

  const iniciales = nombreMostrar
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('');

  const estadoPago = estadoCuenta?.estado || 'Sin información';

  const mostrarProximamente = (modulo) => {
    Alert.alert(
      modulo,
      'Este módulo se implementará en los siguientes sprints.'
    );
  };

  const mostrarDetalle = () => {
    if (!estadoCuenta) return;

    Alert.alert(
      'Detalle del estado de cuenta',
      `Propiedad: ${estadoCuenta.propiedad || 'No disponible'}\n\n` +
      `Mes: ${formatoFecha(estadoCuenta.mes)}\n\n` +
      `Renta: ${formatoMoneda(estadoCuenta.renta_base)}\n` +
      `Servicios: ${formatoMoneda(estadoCuenta.servicios)}\n` +
      `Cargos adicionales: ${formatoMoneda(estadoCuenta.cargos_adicionales)}\n\n` +
      `Total: ${formatoMoneda(estadoCuenta.total)}\n` +
      `Fecha límite: ${formatoFecha(estadoCuenta.fecha_limite)}\n` +
      `Estado: ${estadoPago}`,
      [{ text: 'Cerrar' }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={actualizando}
            onRefresh={actualizar}
            tintColor="#23558C"
            colors={['#23558C']}
          />
        }
      >

        {/* ENCABEZADO */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.saludo}>Bienvenido,</Text>
            <Text style={styles.nombre}>{nombreMostrar}</Text>
          </View>

          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Perfil', { inquilino, token })}
          >
            <Text style={styles.avatarText}>
              {iniciales}
            </Text>
          </TouchableOpacity>
        </View>

        {/* TARJETA DE CUOTA REAL */}
        <View style={styles.cuotaCard}>

          <Text style={styles.cuotaLabel}>
            Tu último estado de cuenta
          </Text>

          {cargando ? (
            <View style={styles.cargandoContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.cargandoTexto}>
                Consultando tu estado de cuenta...
              </Text>
            </View>
          ) : estadoCuenta ? (
            <>
              <Text style={styles.cuotaMonto}>
                {formatoMoneda(estadoCuenta.total)}
              </Text>

              <Text style={styles.cuotaFecha}>
                Fecha límite: {formatoFecha(estadoCuenta.fecha_limite)}
              </Text>

              <Text style={styles.cuotaFecha}>
                Propiedad: {estadoCuenta.propiedad || 'No disponible'}
              </Text>

              <View style={styles.cuotaFooter}>
                <View
                  style={[
                    styles.estadoBadge,
                    estadoPago.toLowerCase() === 'pagado' &&
                      styles.estadoPagado,
                  ]}
                >
                  <Text
                    style={[
                      styles.estadoText,
                      estadoPago.toLowerCase() === 'pagado' &&
                        styles.estadoPagadoTexto,
                    ]}
                  >
                    {estadoPago}
                  </Text>
                </View>

                <TouchableOpacity onPress={mostrarDetalle}>
                  <Text style={styles.verDetalle}>
                    Ver detalle →
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.cargandoTexto}>
              No hay información disponible.
            </Text>
          )}

          {!!error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTexto}>{error}</Text>
              <TouchableOpacity onPress={actualizar}>
                <Text style={styles.reintentar}>
                  Reintentar consulta
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

        {/* ACCESOS RÁPIDOS */}
        <Text style={styles.sectionTitle}>Accesos rápidos</Text>

        <View style={styles.accesos}>
          <TouchableOpacity
            style={styles.accesoCard}
            onPress={() => navigation.navigate('Pagos', { token })}
          >
            <Ionicons name="card-outline" size={27} color="#23558C" />
            <Text style={styles.accesoText}>Mis pagos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accesoCard}
            onPress={() => mostrarProximamente('Reportes')}
          >
            <Ionicons name="construct-outline" size={27} color="#23558C" />
            <Text style={styles.accesoText}>Reportes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accesoCard}
            onPress={() => navigation.navigate('Perfil', { inquilino, token })}
          >
            <Ionicons name="person-outline" size={27} color="#23558C" />
            <Text style={styles.accesoText}>Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* REPORTES DE EJEMPLO */}
        <Text style={styles.sectionTitle}>Reportes de ejemplo</Text>

        <View style={styles.reporteCard}>
          <View style={styles.reporteIcon}>
            <Ionicons name="water-outline" size={23} color="#23558C" />
          </View>

          <View style={styles.reporteInfo}>
            <Text style={styles.reporteTitulo}>
              Fuga en llave de cocina
            </Text>
            <Text style={styles.reporteFecha}>
              15 de octubre de 2026
            </Text>
            <Text style={styles.enProceso}>En proceso</Text>
          </View>
        </View>

        <View style={styles.reporteCard}>
          <View style={styles.reporteIcon}>
            <Ionicons name="bulb-outline" size={23} color="#23558C" />
          </View>

          <View style={styles.reporteInfo}>
            <Text style={styles.reporteTitulo}>
              Foco quemado en pasillo
            </Text>
            <Text style={styles.reporteFecha}>
              8 de octubre de 2026
            </Text>
            <Text style={styles.resuelto}>Resuelto</Text>
          </View>
        </View>

      </ScrollView>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <View style={styles.bottomNav}>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={23} color="#23558C" />
          <Text style={styles.navTextActive}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => mostrarProximamente('Reportes')}
        >
          <Ionicons name="document-text-outline" size={23} color="#94A3B8" />
          <Text style={styles.navText}>Reportes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Perfil', { inquilino, token })}
        >
          <Ionicons name="person-outline" size={23} color="#94A3B8" />
          <Text style={styles.navText}>Perfil</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  saludo: {
    fontSize: 13,
    color: '#64748B',
  },
  nombre: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#23558C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cuotaCard: {
    backgroundColor: '#23558C',
    borderRadius: 16,
    padding: 22,
    marginBottom: 30,
  },
  cuotaLabel: {
    color: '#DCEBFA',
    fontSize: 14,
  },
  cuotaMonto: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  cuotaFecha: {
    color: '#DCEBFA',
    fontSize: 12,
    marginTop: 5,
  },
  cuotaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  estadoBadge: {
    backgroundColor: '#FBBF24',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  estadoText: {
    color: '#78350F',
    fontSize: 12,
    fontWeight: 'bold',
  },
  estadoPagado: {
    backgroundColor: '#BBF7D0',
  },
  estadoPagadoTexto: {
    color: '#166534',
  },
  verDetalle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cargandoContainer: {
    paddingVertical: 22,
    alignItems: 'center',
  },
  cargandoTexto: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 12,
  },
  errorContainer: {
    marginTop: 14,
  },
  errorTexto: {
    color: '#FEE2E2',
    fontSize: 12,
  },
  reintentar: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 15,
  },
  accesos: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
  },
  accesoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 13,
  },
  accesoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 9,
  },
  reporteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reporteIcon: {
    width: 43,
    height: 43,
    borderRadius: 10,
    backgroundColor: '#EAF2F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  reporteInfo: {
    flex: 1,
  },
  reporteTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  reporteFecha: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  enProceso: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 5,
  },
  resuelto: {
    fontSize: 12,
    color: '#16A34A',
    marginTop: 5,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  navTextActive: {
    fontSize: 11,
    color: '#23558C',
    fontWeight: 'bold',
    marginTop: 4,
  },
});
