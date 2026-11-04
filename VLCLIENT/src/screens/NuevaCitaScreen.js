import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { crearCita } from '../services/api';

// Horarios de prueba disponibles para solicitar citas
const HORARIOS = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
];

// Obtener el inicio del día actual
const obtenerFechaMinima = () => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
};

// Convertir fecha a formato YYYY-MM-DD para Neon
const formatearFechaSQL = (valor) => {
  if (!valor) return '';

  const anio = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
};

// Mostrar fecha en español
const formatearFechaVisible = (valor) => {
  if (!valor) return 'Seleccionar fecha';

  return valor.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export default function NuevaCitaScreen({ navigation, route }) {

  // Datos del reporte recibido
  const { token, idReporte, tituloReporte } = route.params || {};

  // Estados del formulario
  const [fecha, setFecha] = useState(null);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [hora, setHora] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  // COMPROBAR SI UN HORARIO YA PASÓ
  const horarioPasado = (fechaSeleccionada, horario) => {
    if (!fechaSeleccionada) return false;

    const hoy = new Date();

    const fechaHoy = formatearFechaSQL(hoy);
    const fechaElegida = formatearFechaSQL(fechaSeleccionada);

    if (fechaElegida < fechaHoy) {
      return true;
    }

    if (fechaElegida > fechaHoy) {
      return false;
    }

    const [horas, minutos] = horario.split(':').map(Number);

    const fechaHora = new Date(fechaSeleccionada);

    fechaHora.setHours(horas, minutos, 0, 0);

    return fechaHora <= hoy;
  };

  // SELECCIONAR FECHA DEL CALENDARIO
  const seleccionarFecha = (evento, fechaSeleccionada) => {

    // Android cierra el selector automáticamente
    if (Platform.OS === 'android') {
      setMostrarCalendario(false);
    }

    if (
      evento.type === 'dismissed' ||
      !fechaSeleccionada
    ) {
      return;
    }

    const seleccion = new Date(fechaSeleccionada);

    seleccion.setHours(0, 0, 0, 0);

    if (seleccion < obtenerFechaMinima()) {
      Alert.alert(
        'Fecha no válida',
        'No puedes seleccionar fechas anteriores a hoy.'
      );
      return;
    }

    setFecha(seleccion);

    // Limpiar la hora si ya no es válida
    setHora('');
  };

  // NAVEGAR A REPORTES
  const volverAInicio = () => {
  navigation.popTo('Inicio');
};

  // GUARDAR CITA EN NEON
  const guardarCita = async () => {

    if (guardando) return;

    // Validar sesión y reporte
    if (!token || !idReporte) {
      Alert.alert(
        'Error',
        'No se encontró el reporte o la sesión.'
      );
      return;
    }

    // Validar fecha seleccionada
    if (!fecha) {
      Alert.alert(
        'Fecha obligatoria',
        'Selecciona una fecha desde el calendario.'
      );
      return;
    }

    // Comprobar que la fecha no sea pasada
    if (fecha < obtenerFechaMinima()) {
      Alert.alert(
        'Fecha no válida',
        'No puedes programar citas en fechas anteriores.'
      );
      return;
    }

    // Validar hora
    if (!hora) {
      Alert.alert(
        'Horario obligatorio',
        'Selecciona un horario para tu cita.'
      );
      return;
    }

    // Comprobar que no haya pasado la hora seleccionada
    if (horarioPasado(fecha, hora)) {
      Alert.alert(
        'Horario no disponible',
        'La hora seleccionada ya pasó. Elige otra.'
      );
      return;
    }

    // Validar observaciones
    if (observaciones.trim().length > 500) {
      Alert.alert(
        'Texto demasiado largo',
        'Las observaciones no pueden superar 500 caracteres.'
      );
      return;
    }

    // Formato compatible con PostgreSQL
    const fechaLimpia = formatearFechaSQL(fecha);

    setGuardando(true);

    try {

      // Guardar la cita asociada al reporte
      const resultado = await crearCita(token, {
        id_reporte: idReporte,
        fecha_cita: fechaLimpia,
        hora_cita: hora,
        observaciones: observaciones.trim(),
      });

      // Mostrar confirmación
      Alert.alert(
        'Cita solicitada',
        `Tu solicitud de cita #${resultado.cita.id_cita} fue registrada correctamente.\n\n` +
        `Reporte: #${idReporte}\n` +
        `Fecha: ${formatearFechaVisible(fecha)}\n` +
        `Hora: ${hora}\n\n` +
        'La visita está pendiente de confirmación por parte del personal de mantenimiento.',
        [
          {
            text: 'Aceptar',
            onPress: volverAInicio,
          },
        ]
      );

    } catch (error) {

      Alert.alert(
        'No se pudo programar',
        error.message || 'Ocurrió un error al registrar la cita.'
      );

    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ENCABEZADO */}
        <View style={styles.header}>

          <Ionicons
            name="calendar-outline"
            size={36}
            color="#23558C"
          />

          <Text style={styles.title}>
            Programar cita
          </Text>

          <Text style={styles.subtitle}>
            Selecciona una fecha y horario para solicitar
            una visita de mantenimiento.
          </Text>

        </View>

        {/* REPORTE RELACIONADO */}
        <View style={styles.reporteCard}>

          <Text style={styles.infoLabel}>
            Reporte seleccionado
          </Text>

          <Text style={styles.reporteTitulo}>
            #{idReporte} — {tituloReporte || 'Mantenimiento'}
          </Text>

        </View>

        {/* FORMULARIO */}
        <View style={styles.card}>

          {/* FECHA */}
          <Text style={styles.label}>
            Fecha de la cita *
          </Text>

          <TouchableOpacity
            style={[
              styles.input,
              styles.fechaSelector,
            ]}
            onPress={() => setMostrarCalendario(true)}
            disabled={guardando}
          >

            <Text
              style={[
                styles.fechaTexto,
                !fecha && styles.fechaPlaceholder,
              ]}
            >
              {formatearFechaVisible(fecha)}
            </Text>

            <Ionicons
              name="calendar-outline"
              size={22}
              color="#23558C"
            />

          </TouchableOpacity>

          {/* CALENDARIO */}
          {mostrarCalendario && (

            <View style={styles.calendarioContainer}>

              <DateTimePicker
                value={fecha || obtenerFechaMinima()}
                mode="date"
                display={
                  Platform.OS === 'ios'
                    ? 'inline'
                    : 'default'
                }
                minimumDate={obtenerFechaMinima()}
                onChange={seleccionarFecha}
                locale="es-MX"
                themeVariant="light"
                accentColor="#23558C"
              />

              {Platform.OS === 'ios' && (

                <TouchableOpacity
                  style={styles.cerrarCalendario}
                  onPress={() => setMostrarCalendario(false)}
                >
                  <Text style={styles.cerrarCalendarioTexto}>
                    Listo
                  </Text>
                </TouchableOpacity>

              )}

            </View>

          )}

          <Text style={styles.hint}>
            Solo puedes seleccionar la fecha desde el calendario.
            No se permiten fechas anteriores a hoy.
          </Text>

          {/* HORARIO */}
          <Text style={styles.label}>
            Horario *
          </Text>

          <View style={styles.horarios}>

            {HORARIOS.map((opcion) => {

              const noDisponible =
                fecha && horarioPasado(fecha, opcion);

              const seleccionada = hora === opcion;

              return (

                <TouchableOpacity
                  key={opcion}
                  onPress={() => setHora(opcion)}
                  disabled={guardando || !fecha || noDisponible}
                  style={[
                    styles.horaBoton,
                    seleccionada && styles.horaSeleccionada,
                    (!fecha || noDisponible) &&
                      styles.horaDeshabilitada,
                  ]}
                >

                  <Text
                    style={[
                      styles.horaTexto,
                      seleccionada && styles.horaTextoSeleccionada,
                    ]}
                  >
                    {opcion}
                  </Text>

                </TouchableOpacity>

              );
            })}

          </View>

          <Text style={styles.hint}>
            Los horarios son solicitudes sujetas
            a disponibilidad.
          </Text>

          {/* OBSERVACIONES */}
          <Text style={styles.label}>
            Observaciones (opcional)
          </Text>

          <TextInput
            style={[
              styles.input,
              styles.textArea,
            ]}
            value={observaciones}
            onChangeText={setObservaciones}
            placeholder="Ej. Puedo recibir al personal por la mañana."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!guardando}
          />

          <Text style={styles.contador}>
            {observaciones.length}/500
          </Text>

        </View>

        {/* AVISO */}
        <View style={styles.infoCard}>

          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#23558C"
          />

          <Text style={styles.infoText}>
            Tu solicitud se asociará automáticamente
            al reporte #{idReporte}. La fecha y hora
            deberán ser confirmadas por mantenimiento.
          </Text>

        </View>

        {/* GUARDAR CITA */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            guardando && styles.disabled,
          ]}
          onPress={guardarCita}
          disabled={guardando}
        >

          {guardando ? (

            <ActivityIndicator color="#FFFFFF" />

          ) : (

            <>
              <Ionicons
                name="calendar-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text style={styles.submitText}>
                Solicitar cita
              </Text>
            </>

          )}

        </TouchableOpacity>

        {/* CANCELAR */}
        <TouchableOpacity
  style={styles.cancelButton}
  onPress={volverAInicio}
  disabled={guardando}
>
  <Text style={styles.cancelText}>
    Omitir cita por ahora
  </Text>
</TouchableOpacity>

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
    marginTop: 7,
    textAlign: 'center',
  },

  reporteCard: {
    backgroundColor: '#EAF2F9',
    padding: 18,
    borderRadius: 14,
    marginBottom: 18,
  },

  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 7,
  },

  reporteTitulo: {
    fontSize: 15,
    color: '#23558C',
    fontWeight: 'bold',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 10,
  },

  fechaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  fechaTexto: {
    fontSize: 14,
    color: '#1E293B',
  },

  fechaPlaceholder: {
    color: '#94A3B8',
  },

  calendarioContainer: {
    marginBottom: 15,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  cerrarCalendario: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  cerrarCalendarioTexto: {
    color: '#23558C',
    fontSize: 14,
    fontWeight: 'bold',
  },

  hint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 25,
  },

  horarios: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 25,
  },

  horaBoton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },

  horaSeleccionada: {
    backgroundColor: '#23558C',
    borderColor: '#23558C',
  },

  horaTexto: {
    color: '#334155',
    fontWeight: '600',
  },

  horaTextoSeleccionada: {
    color: '#FFFFFF',
  },

  horaDeshabilitada: {
    opacity: 0.35,
  },

  textArea: {
    height: 110,
  },

  contador: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
  },

  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EAF2F9',
    borderRadius: 12,
    padding: 15,
    gap: 10,
    marginBottom: 22,
  },

  infoText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 19,
    flex: 1,
  },

  submitButton: {
    backgroundColor: '#23558C',
    paddingVertical: 17,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  disabled: {
    opacity: 0.6,
  },

  submitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 17,
  },

  cancelText: {
    color: '#64748B',
    fontSize: 14,
  },

});
