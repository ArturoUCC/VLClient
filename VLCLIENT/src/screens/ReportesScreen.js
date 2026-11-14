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
import { useEffect } from 'react';
import { Image } from 'react-native';

import {
  obtenerFotosReporte,
  obtenerMisCitas,
} from '../services/api';

export default function ReportesScreen({ navigation, route }) {
  const token = route.params?.token;

  const [reportes, setReportes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [fotosPorReporte, setFotosPorReporte] = useState({});
  const [citasPorReporte, setCitasPorReporte] = useState({});
  const [cargandoDetalles, setCargandoDetalles] = useState(false);    

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

  const presentarEstadoCita = (estado) => {
    switch (String(estado || '').toLowerCase()) {
      case 'programada':
        return { texto: 'Pendiente de confirmación', color: '#92400E', fondo: '#FEF3C7' };
      case 'confirmada':
        return { texto: 'Confirmada', color: '#166534', fondo: '#DCFCE7' };
      default:
        return { texto: estado || 'Sin estado', color: '#475569', fondo: '#F1F5F9' };
    }
  };

  
useEffect(() => {
  let activo = true;

  const cargarDetallesReportes = async () => {
    if (!token || !Array.isArray(reportes) || reportes.length === 0) {
      if (activo) {
        setFotosPorReporte({});
        setCitasPorReporte({});
        setCargandoDetalles(false);
      }
      return;
    }

    setCargandoDetalles(true);

    try {
      // Consultar todas las citas del inquilino
      const promesaCitas = obtenerMisCitas(token).catch((error) => {
  console.error('Error al consultar citas:', error.message);
  return [];
});

      // Consultar las fotografías de cada reporte
      const promesasFotos = reportes.map(async (reporte) => {
        try {
          const resultado = await obtenerFotosReporte(
            token,
            reporte.id_reporte
          );

          const fotos = Array.isArray(resultado)
            ? resultado
            : resultado.fotos || [];

          return {
            idReporte: reporte.id_reporte,
            fotos,
          };
        } catch (error) {
          console.error(
            `Error al consultar fotos del reporte #${reporte.id_reporte}:`,
            error.message
          );

          return {
            idReporte: reporte.id_reporte,
            fotos: null,
          };
        }
      });

      const [resultadoCitas, resultadosFotos] =
        await Promise.all([
          promesaCitas,
          Promise.all(promesasFotos),
        ]);

      if (!activo) return;

      const nuevasFotos = {};

      resultadosFotos.forEach(({ idReporte, fotos }) => {
        nuevasFotos[idReporte] = fotos;
      });

      setFotosPorReporte(nuevasFotos);

      // Agrupar citas por reporte
      const nuevasCitas = {};

      const citas = Array.isArray(resultadoCitas)
        ? resultadoCitas
        : resultadoCitas.citas || [];

      citas.forEach((cita) => {
        const id = cita.id_reporte;

        if (!nuevasCitas[id]) {
          nuevasCitas[id] = [];
        }

        nuevasCitas[id].push(cita);
      });

      setCitasPorReporte(nuevasCitas);

    } catch (error) {
      console.error(
        'Error al consultar citas:',
        error.message
      );

      if (activo) {
        setCitasPorReporte({});
      }
    } finally {
      if (activo) {
        setCargandoDetalles(false);
      }
    }
  };

  cargarDetallesReportes();

  return () => {
    activo = false;
  };
}, [token, reportes]);

const formatearFechaCita = (fecha) => {
  if (!fecha) return 'Sin fecha';

  // El backend devuelve YYYY-MM-DD
  const partes = String(fecha).slice(0, 10).split('-');

  if (partes.length !== 3) return String(fecha);

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
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
          

reportes.map((reporte) => {
  const fotos = fotosPorReporte[reporte.id_reporte];
  const citas = citasPorReporte[reporte.id_reporte] || [];

  // Preferir una cita activa si existe
  const cita =
    citas.find((item) =>
      ['programada', 'confirmada'].includes(item.estado)
    ) || citas[0];
  const estadoCita = cita ? presentarEstadoCita(cita.estado) : null;

  return (
    <View
      key={reporte.id_reporte}
      style={styles.reportCard}
    >
      {/* ENCABEZADO DEL REPORTE */}
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
              { color: colorEstado(reporte.estado) },
            ]}
          >
            {reporte.estado || 'Sin estado'}
          </Text>
        </View>
      </View>

      {/* DESCRIPCIÓN */}
      <Text style={styles.description}>
        {reporte.descripcion || 'Sin descripción'}
      </Text>

      <View style={styles.divider} />

      {/* DETALLES */}
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

      {/* FOTOGRAFÍAS DEL REPORTE */}
      <View style={styles.seccionDetalles}>
        <Text style={styles.seccionTitulo}>
          Fotografías del reporte
        </Text>

        {cargandoDetalles && fotos === undefined ? (
          <Text style={styles.sinDatos}>
            Cargando fotografías...
          </Text>
        ) : fotos === null ? (
          <Text style={styles.sinDatos}>
            No se pudieron cargar las fotografías.
          </Text>
        ) : fotos && fotos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fotosContainer}
          >
            {fotos.map((foto) => (
              <Image
                key={foto.id_foto}
                source={{ uri: foto.url_foto }}
                style={styles.fotoReporte}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.sinDatos}>
            Este reporte no tiene fotografías.
          </Text>
        )}
      </View>

      {/* CITA DE MANTENIMIENTO */}
      <View style={styles.seccionDetalles}>
        <Text style={styles.seccionTitulo}>
          Cita de mantenimiento
        </Text>

        {cargandoDetalles &&
        citasPorReporte[reporte.id_reporte] === undefined ? (
          <Text style={styles.sinDatos}>
            Cargando cita...
          </Text>
        ) : cita ? (
          <View style={styles.citaInfo}>
            <Text style={styles.citaDetalle}>
              Fecha: {formatearFechaCita(cita.fecha_cita)}
            </Text>

            <Text style={styles.citaDetalle}>
              Hora: {String(cita.hora_cita).slice(0, 5)}
            </Text>

            <View style={styles.citaEstadoFila}>
              <Text style={styles.citaDetalle}>Estado:</Text>
              <View style={[styles.citaEstadoBadge, { backgroundColor: estadoCita.fondo }]}>
                <Text style={[styles.citaEstadoTexto, { color: estadoCita.color }]}>
                  {estadoCita.texto}
                </Text>
              </View>
            </View>

            {!!cita.observaciones && (
              <Text style={styles.citaDetalle}>
                Observaciones: {cita.observaciones}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.sinDatos}>
            Este reporte todavía no tiene una cita registrada.
          </Text>
        )}
      </View>
    </View>
  );
})


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
  citaButton: {
  backgroundColor: '#23558C',
  borderRadius: 10,
  paddingVertical: 13,
  marginTop: 15,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 9,
},
citaButtonText: {
  color: '#FFFFFF',
  fontSize: 13,
  fontWeight: 'bold',
},

seccionDetalles: {
  marginTop: 18,
  paddingTop: 14,
  borderTopWidth: 1,
  borderTopColor: '#E2E8F0',
},

seccionTitulo: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#23558C',
  marginBottom: 12,
},

fotosContainer: {
  gap: 10,
  paddingBottom: 5,
},

fotoReporte: {
  width: 145,
  height: 115,
  borderRadius: 10,
  backgroundColor: '#E2E8F0',
},

sinDatos: {
  fontSize: 12,
  color: '#64748B',
  fontStyle: 'italic',
  lineHeight: 19,
},

citaInfo: {
  backgroundColor: '#EAF2F9',
  borderRadius: 10,
  padding: 14,
},

citaDetalle: {
  fontSize: 13,
  color: '#334155',
  marginBottom: 7,
},

citaEstadoFila: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 7,
},
citaEstadoBadge: {
  borderRadius: 12,
  paddingHorizontal: 9,
  paddingVertical: 4,
  marginBottom: 7,
},
citaEstadoTexto: {
  fontSize: 12,
  fontWeight: 'bold',
},

});
