import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { obtenerMisCitas, obtenerMisNotificaciones, reagendarCita } from '../services/api';

const HORARIOS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00',
];

const fechaSQL = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

const inicioHoy = () => {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  return fecha;
};

export default function ReagendarCitaScreen({ navigation, route }) {
  const { token, idCita, idNotificacion } = route.params || {};
  const [cita, setCita] = useState(null);
  const [disponible, setDisponible] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [fecha, setFecha] = useState(null);
  const [hora, setHora] = useState('');
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  useFocusEffect(useCallback(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      setError('');
      try {
        if (!token || !idCita || !idNotificacion) {
          throw new Error('No se encontró la cita o la sesión.');
        }
        const [citas, avisos] = await Promise.all([
          obtenerMisCitas(token), obtenerMisNotificaciones(token),
        ]);
        if (!activo) return;
        const encontrada = citas.find((item) => Number(item.id_cita) === Number(idCita));
        const aviso = (avisos.notificaciones || []).find(
          (item) => Number(item.id_notificacion) === Number(idNotificacion) &&
            Number(item.id_cita) === Number(idCita) &&
            item.accion_tipo === 'reagendar_cita'
        );
        if (!encontrada || !aviso) {
          throw new Error('Solicitud de reagendado no encontrada.');
        }
        setCita(encontrada);
        setDisponible(Boolean(aviso.reagendar_disponible) &&
          encontrada.reagendado_estado === 'solicitado');
      } catch (err) {
        if (activo) setError(err.message || 'No se pudo consultar la cita.');
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [token, idCita, idNotificacion]));

  const horarioPasado = (fechaElegida, opcion) => {
    if (!fechaElegida) return true;
    const ahora = new Date();
    const seleccion = new Date(fechaElegida);
    const [h, m] = opcion.split(':').map(Number);
    seleccion.setHours(h, m, 0, 0);
    return seleccion <= ahora;
  };

  const confirmar = async () => {
    if (guardando || !disponible) return;
    if (!fecha || !hora) {
      Alert.alert('Datos incompletos', 'Selecciona una fecha y un horario.');
      return;
    }
    const nuevaFecha = fechaSQL(fecha);
    if (horarioPasado(fecha, hora) || fecha < inicioHoy()) {
      Alert.alert('Horario no válido', 'Selecciona una fecha y hora futuras.');
      return;
    }
    if (nuevaFecha === cita.fecha_cita && hora === cita.hora_cita) {
      Alert.alert('Mismo horario', 'Selecciona una fecha u hora diferente.');
      return;
    }
    setGuardando(true);
    try {
      const resultado = await reagendarCita(token, idCita, {
        id_notificacion: idNotificacion,
        fecha_cita: nuevaFecha,
        hora_cita: hora,
      });
      setCita(resultado.cita);
      setDisponible(false);
      Alert.alert(
        'Cita reagendada',
        'El nuevo horario quedó pendiente de confirmación administrativa.',
        [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('No se pudo reagendar', err.message || 'Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="calendar-outline" size={38} color="#23558C" />
          <Text style={styles.title}>Reagendar cita</Text>
          <Text style={styles.subtitle}>Elige un nuevo horario para tu visita de mantenimiento.</Text>
        </View>

        {cargando ? <ActivityIndicator color="#23558C" size="large" /> : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Cita #{cita.id_cita}</Text>
              <Text style={styles.info}>Reporte: {cita.titulo_reporte || `#${cita.id_reporte}`}</Text>
              <Text style={styles.info}>Fecha y hora anterior: {cita.fecha_cita} a las {cita.hora_cita}</Text>
              {!disponible && <Text style={styles.error}>Esta oportunidad ya no está disponible.</Text>}
            </View>

            {disponible && (
              <View style={styles.card}>
                <Text style={styles.label}>Nueva fecha</Text>
                <TouchableOpacity
                  style={styles.fechaBoton}
                  onPress={() => setMostrarCalendario(true)}
                  disabled={guardando}
                  accessibilityRole="button"
                  accessibilityLabel="Seleccionar nueva fecha"
                >
                  <Text style={styles.info}>{fecha ? fecha.toLocaleDateString('es-MX') : 'Seleccionar fecha'}</Text>
                  <Ionicons name="calendar-outline" size={22} color="#23558C" />
                </TouchableOpacity>
                {mostrarCalendario && (
                  <View>
                    <DateTimePicker
                      value={fecha || inicioHoy()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      minimumDate={inicioHoy()}
                      onChange={(evento, seleccion) => {
                        if (Platform.OS === 'android') setMostrarCalendario(false);
                        if (evento.type === 'dismissed' || !seleccion) return;
                        const elegida = new Date(seleccion);
                        elegida.setHours(0, 0, 0, 0);
                        if (elegida < inicioHoy()) return;
                        setFecha(elegida);
                        setHora('');
                      }}
                      locale="es-MX"
                      themeVariant="light"
                      accentColor="#23558C"
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity onPress={() => setMostrarCalendario(false)} style={styles.cerrar}>
                        <Text style={styles.link}>Listo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.label}>Nuevo horario</Text>
                <View style={styles.horarios}>
                  {HORARIOS.map((opcion) => {
                    const deshabilitado = !fecha || horarioPasado(fecha, opcion);
                    return (
                      <TouchableOpacity
                        key={opcion}
                        style={[styles.horaBoton, hora === opcion && styles.seleccionada,
                          deshabilitado && styles.deshabilitada]}
                        disabled={guardando || deshabilitado}
                        onPress={() => setHora(opcion)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: hora === opcion, disabled: !!deshabilitado }}
                      >
                        <Text style={[styles.horaTexto, hora === opcion && styles.textoSeleccionado]}>{opcion}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.hint}>Solo tienes una oportunidad para reagendar esta cita. El nuevo horario quedará pendiente de confirmación.</Text>
                <TouchableOpacity
                  style={[styles.guardar, guardando && styles.deshabilitada]}
                  onPress={confirmar}
                  disabled={guardando}
                  accessibilityRole="button"
                >
                  {guardando ? <ActivityIndicator color="#FFFFFF" /> :
                    <Text style={styles.guardarTexto}>Confirmar nuevo horario</Text>}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        <TouchableOpacity style={styles.cerrar} onPress={() => navigation.goBack()} disabled={guardando}>
          <Text style={styles.link}>Volver a notificaciones</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 22 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginBottom: 16 },
  label: { fontSize: 15, fontWeight: 'bold', color: '#23558C', marginBottom: 12 },
  info: { fontSize: 14, color: '#334155', marginBottom: 9 },
  error: { color: '#B91C1C', fontSize: 14, marginTop: 12 },
  fechaBoton: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  horarios: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  horaBoton: { borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9', paddingHorizontal: 15, paddingVertical: 12 },
  seleccionada: { backgroundColor: '#23558C', borderColor: '#23558C' },
  horaTexto: { color: '#334155', fontWeight: '600' },
  textoSeleccionado: { color: '#FFFFFF' },
  deshabilitada: { opacity: 0.4 },
  hint: { color: '#64748B', fontSize: 12, lineHeight: 19, marginBottom: 20 },
  guardar: { backgroundColor: '#23558C', borderRadius: 12, minHeight: 50,
    alignItems: 'center', justifyContent: 'center' },
  guardarTexto: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  cerrar: { alignItems: 'center', paddingVertical: 15 },
  link: { color: '#23558C', fontWeight: '600' },
});
