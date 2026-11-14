import React, { useState, useCallback, useEffect } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { observarRotacionPush } from '../services/pushDispositivo';
import {
  obtenerMiEstadoCuenta,
  obtenerMisReportes,
  obtenerMisNotificaciones,
} from '../services/api';

export default function InicioScreen({ navigation, route }) {
  const { token, inquilino } = route.params || {};
  useEffect(() => observarRotacionPush(token), [token]);
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);

  // Estado de cuenta
  const [estadoCuenta, setEstadoCuenta] = useState(null);
  const [cargandoCuenta, setCargandoCuenta] = useState(true);
  const [errorCuenta, setErrorCuenta] = useState('');

  // Reportes reales
  const [reportes, setReportes] = useState([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [errorReportes, setErrorReportes] = useState('');

  // Actualización manual
  const [actualizando, setActualizando] = useState(false);

  // CONSULTAR ESTADO DE CUENTA
  const cargarEstadoCuenta = useCallback(async () => {
    if (!token) {
      setErrorCuenta('No se encontró una sesión válida.');
      setEstadoCuenta(null);
      setCargandoCuenta(false);
      return;
    }

    try {
      setErrorCuenta('');
      const datos = await obtenerMiEstadoCuenta(token);
      setEstadoCuenta(datos);
    } catch (error) {
      setErrorCuenta(
        error.message || 'No se pudo consultar el estado de cuenta.'
      );
      setEstadoCuenta(null);
    } finally {
      setCargandoCuenta(false);
    }
  }, [token]);

  // CONSULTAR REPORTES REALES
  const cargarReportes = useCallback(async () => {
    if (!token) {
      setErrorReportes('No se encontró una sesión válida.');
      setReportes([]);
      setCargandoReportes(false);
      return;
    }

    try {
      setErrorReportes('');

      const datos = await obtenerMisReportes(token);

      const reportesOrdenados = [...datos].sort((a, b) => {
        const fechaA = new Date(a.fecha_reporte || 0).getTime();
        const fechaB = new Date(b.fecha_reporte || 0).getTime();

        if (fechaB !== fechaA) {
          return fechaB - fechaA;
        }

        return Number(b.id_reporte) - Number(a.id_reporte);
      });

      setReportes(reportesOrdenados.slice(0, 3));
    } catch (error) {
      setErrorReportes(
        error.message || 'No se pudieron consultar los reportes.'
      );
      setReportes([]);
    } finally {
      setCargandoReportes(false);
    }
  }, [token]);

  // CONSULTAR NOTIFICACIONES PENDIENTES
  const cargarResumenNotificaciones = useCallback(async () => {
    if (!token) {
      setNotificacionesNoLeidas(0);
      return;
    }

    try {
      const datos = await obtenerMisNotificaciones(token);
      const pendientes = Number(datos?.no_leidas);

      if (Number.isFinite(pendientes) && pendientes >= 0) {
        setNotificacionesNoLeidas(pendientes);
      } else {
        const lista = Array.isArray(datos?.notificaciones)
          ? datos.notificaciones
          : [];
        setNotificacionesNoLeidas(
          lista.filter((notificacion) => !notificacion.leida).length
        );
      }
    } catch (error) {
      // Si falla la consulta, no mostramos un indicador desactualizado.
      setNotificacionesNoLeidas(0);
      console.log('Error al consultar notificaciones:', error.message);
    }
  }, [token]);

  // CONSULTAR LOS SERVICIOS DE INICIO
  const cargarDatos = useCallback(async (esActualizacion = false) => {
    if (esActualizacion) {
      setActualizando(true);
    }

    try {
      await Promise.all([
        cargarEstadoCuenta(),
        cargarReportes(),
        cargarResumenNotificaciones(),
      ]);
    } finally {
      if (esActualizacion) {
        setActualizando(false);
      }
    }
  }, [cargarEstadoCuenta, cargarReportes, cargarResumenNotificaciones]);

  // ACTUALIZAR AL VOLVER A INICIO
  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [cargarDatos])
  );

  // DESLIZAR HACIA ABAJO PARA ACTUALIZAR
  const actualizar = () => {
    cargarDatos(true);
  };

  // FORMATO DE MONEDA
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

  // FORMATO DE FECHA
  const formatoFecha = (valor) => {
    if (!valor) return 'No disponible';

    const texto = String(valor);

    // Fechas de PostgreSQL con formato YYYY-MM-DD
    const partes = texto.slice(0, 10).split('-');

    if (partes.length === 3) {
      const [anio, mes, dia] = partes.map(Number);
      const fecha = new Date(anio, mes - 1, dia);

      if (!Number.isNaN(fecha.getTime())) {
        return fecha.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    }

    return texto;
  };

  // NOMBRE DEL INQUILINO
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

  // ETIQUETAS PARA LOS ESTADOS DE REPORTES
  const obtenerEstadoReporte = (estado) => {
    switch (String(estado || '').toLowerCase()) {
      case 'resuelto':
        return {
          texto: 'Resuelto',
          color: '#16A34A',
          fondo: '#DCFCE7',
        };

      case 'en_proceso':
        return {
          texto: 'En proceso',
          color: '#2563EB',
          fondo: '#DBEAFE',
        };

      default:
        return {
          texto: 'Pendiente',
          color: '#B45309',
          fondo: '#FEF3C7',
        };
    }
  };

  // ICONOS SEGÚN LA CATEGORÍA
  const obtenerIconoReporte = (categoria) => {
    switch (categoria) {
      case 'plomeria':
        return 'water-outline';

      case 'electricidad':
        return 'flash-outline';

      case 'estructura':
        return 'business-outline';

      case 'electrodomesticos':
        return 'tv-outline';

      case 'limpieza':
        return 'sparkles-outline';

      default:
        return 'construct-outline';
    }
  };

  // MOSTRAR DETALLE DEL ESTADO DE CUENTA
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

  // NAVEGACIÓN
  const abrirReportes = () => {
    navigation.navigate('Reportes', { token });
  };

  const abrirPerfil = () => {
    navigation.navigate('Perfil', { inquilino, token });
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom']}
    >
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
    <Text style={styles.saludo}>
      Bienvenido,
    </Text>

    <Text style={styles.nombre}>
      {nombreMostrar}
    </Text>
  </View>

  {/* CAMPANITA DE NOTIFICACIONES */}
  <TouchableOpacity
    style={styles.botonNotificaciones}
    onPress={() =>
      navigation.navigate('Notificaciones', {
        token,
      })
    }
  >
    <Ionicons
      name="notifications-outline"
      size={26}
      color="#23558C"
    />

    {notificacionesNoLeidas > 0 && (
      <View style={styles.puntoNotificacion} />
    )}
  </TouchableOpacity>

  {/* AVATAR DEL USUARIO */}
  <TouchableOpacity
    style={styles.avatar}
    onPress={abrirPerfil}
  >
    <Text style={styles.avatarText}>
      {iniciales}
    </Text>
  </TouchableOpacity>
</View>


        {/* ESTADO DE CUENTA REAL */}
        <View style={styles.cuotaCard}>
          <Text style={styles.cuotaLabel}>
            Tu último estado de cuenta
          </Text>

          {cargandoCuenta ? (
            <View style={styles.cargandoContainer}>
              <ActivityIndicator
                size="large"
                color="#FFFFFF"
              />

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
                Fecha límite: {formatoFecha(
                  estadoCuenta.fecha_limite
                )}
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

          {!!errorCuenta && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTexto}>
                {errorCuenta}
              </Text>

              <TouchableOpacity onPress={cargarEstadoCuenta}>
                <Text style={styles.reintentar}>
                  Reintentar consulta
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ACCESOS RÁPIDOS */}
        <Text style={styles.sectionTitle}>
          Accesos rápidos
        </Text>

        <View style={styles.accesos}>
          <TouchableOpacity
            style={styles.accesoCard}
            onPress={() => navigation.navigate('Pagos', { token })}
          >
            <Ionicons
              name="card-outline"
              size={27}
              color="#23558C"
            />

            <Text style={styles.accesoText}>
              Mis pagos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accesoCard}
            onPress={abrirReportes}
          >
            <Ionicons
              name="construct-outline"
              size={27}
              color="#23558C"
            />

            <Text style={styles.accesoText}>
              Reportes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accesoCard}
            onPress={abrirPerfil}
          >
            <Ionicons
              name="person-outline"
              size={27}
              color="#23558C"
            />

            <Text style={styles.accesoText}>
              Perfil
            </Text>
          </TouchableOpacity>
        </View>

        {/* ÚLTIMOS REPORTES REALES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Últimos reportes
          </Text>

          <TouchableOpacity onPress={abrirReportes}>
            <Text style={styles.verTodos}>
              Ver todos →
            </Text>
          </TouchableOpacity>
        </View>

        {cargandoReportes ? (
          <View style={styles.reporteCard}>
            <ActivityIndicator
              size="small"
              color="#23558C"
            />

            <Text style={styles.mensajeReportes}>
              Cargando reportes...
            </Text>
          </View>
        ) : errorReportes ? (
          <View style={styles.reporteCard}>
            <View style={styles.reporteIcon}>
              <Ionicons
                name="alert-circle-outline"
                size={23}
                color="#DC2626"
              />
            </View>

            <View style={styles.reporteInfo}>
              <Text style={styles.reporteTitulo}>
                No se pudieron cargar los reportes
              </Text>

              <Text style={styles.reporteFecha}>
                {errorReportes}
              </Text>

              <TouchableOpacity onPress={cargarReportes}>
                <Text style={styles.reintentarReportes}>
                  Reintentar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : reportes.length === 0 ? (
          <View style={styles.reporteCard}>
            <View style={styles.reporteIcon}>
              <Ionicons
                name="document-text-outline"
                size={23}
                color="#23558C"
              />
            </View>

            <View style={styles.reporteInfo}>
              <Text style={styles.reporteTitulo}>
                No tienes reportes registrados
              </Text>

              <Text style={styles.reporteFecha}>
                Los reportes que crees aparecerán aquí.
              </Text>

              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('NuevoReporte', { token })
                }
              >
                <Text style={styles.reintentarReportes}>
                  Crear un reporte →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          reportes.map((reporte) => {
            const estado = obtenerEstadoReporte(reporte.estado);

            return (
              <TouchableOpacity
                key={reporte.id_reporte}
                style={styles.reporteCard}
                onPress={abrirReportes}
              >
                <View style={styles.reporteIcon}>
                  <Ionicons
                    name={obtenerIconoReporte(reporte.categoria)}
                    size={23}
                    color="#23558C"
                  />
                </View>

                <View style={styles.reporteInfo}>
                  <Text style={styles.reporteTitulo}>
                    {reporte.titulo}
                  </Text>

                  <Text style={styles.reporteFecha}>
                    {formatoFecha(reporte.fecha_reporte)}
                  </Text>

                  <View
                    style={[
                      styles.reporteEstado,
                      { backgroundColor: estado.fondo },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reporteEstadoTexto,
                        { color: estado.color },
                      ]}
                    >
                      {estado.texto}
                    </Text>
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            );
          })
        )}

      </ScrollView>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons
            name="home"
            size={23}
            color="#23558C"
          />
          <Text style={styles.navTextActive}>
            Inicio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={abrirReportes}
        >
          <Ionicons
            name="document-text-outline"
            size={23}
            color="#94A3B8"
          />
          <Text style={styles.navText}>
            Reportes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={abrirPerfil}
        >
          <Ionicons
            name="person-outline"
            size={23}
            color="#94A3B8"
          />
          <Text style={styles.navText}>
            Perfil
          </Text>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  verTodos: {
    fontSize: 12,
    color: '#23558C',
    fontWeight: 'bold',
  },
  reporteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  reporteIcon: {
    width: 43,
    height: 43,
    borderRadius: 10,
    backgroundColor: '#EAF2F9',
    justifyContent: 'center',
    alignItems: 'center',
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
  reporteEstado: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  reporteEstadoTexto: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  mensajeReportes: {
    fontSize: 12,
    color: '#64748B',
  },
  reintentarReportes: {
    fontSize: 12,
    color: '#23558C',
    fontWeight: 'bold',
    marginTop: 10,
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
  botonNotificaciones: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EAF2F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  puntoNotificacion: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
