import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { crearCita, consultarDisponibilidad, obtenerMisCitas } from '../services/api';
import { confirmarCitaDeBorrador } from '../services/citasBorradores';
import { horarioPasadoMexico, inicioDiaMexicoLocal } from '../services/fechaCitas';

// Obtener el inicio del día actual
const obtenerFechaMinima = () => {
  return inicioDiaMexicoLocal();
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
  const [horarios, setHorarios] = useState([]);
  const [consultando, setConsultando] = useState(false);
  const [verificacionPendiente, setVerificacionPendiente] = useState(false);
  const envioEnCurso = useRef(false);

  const cargarHorarios = useCallback(async (dia) => {
    setConsultando(true);
    try {
      const resultado = await consultarDisponibilidad(token, { fecha: dia });
      const disponibles = resultado.filter((item) => item.disponible).map((item) => item.hora);
      setHorarios(disponibles);
      return disponibles;
    } catch (_) {
      setHorarios([]);
      throw new Error('No se pudieron consultar los horarios disponibles.');
    } finally { setConsultando(false); }
  }, [token]);

  useFocusEffect(useCallback(() => {
    if (fecha) void cargarHorarios(formatearFechaSQL(fecha)).catch(() => {});
  }, [fecha, cargarHorarios]));

  // COMPROBAR SI UN HORARIO YA PASÓ
  const horarioPasado = (fechaSeleccionada, horario) => {
    if (!fechaSeleccionada) return false;
    return horarioPasadoMexico(formatearFechaSQL(fechaSeleccionada), horario);
  };

  // SELECCIONAR FECHA DEL CALENDARIO
  const seleccionarFecha = async (evento, fechaSeleccionada) => {

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

    try {
      const disponibles = await cargarHorarios(formatearFechaSQL(seleccion));
      if (!disponibles.length) {
        setFecha(null); setHora('');
        Alert.alert('Fecha no disponible',
          'El administrador no habilitó horarios libres para ese día.');
        return;
      }
      setFecha(seleccion);
      setHora('');
    } catch (error) { Alert.alert('Disponibilidad', error.message); }
  };

  // NAVEGAR A REPORTES
  
const volverAInicio = () => {
  // Buscar la pantalla Inicio que ya existe
  // en el historial de navegación.
  const estadoNavegacion = navigation.getState();

  const pantallaInicio = estadoNavegacion.routes.find(
    (pantalla) => pantalla.name === 'Inicio'
  );

  // Recuperar los parámetros originales del Inicio.
  const parametrosInicio = pantallaInicio?.params || {};

  // Conservar tanto el token como los datos del inquilino.
  const parametrosActualizados = {
    ...parametrosInicio,
    token: token || parametrosInicio.token,
  };

  // Regresar a Inicio sin perder la sesión.
  navigation.popTo('Inicio', parametrosActualizados);
};


  // GUARDAR CITA EN NEON
  const guardarCita = async () => {

    if (guardando || envioEnCurso.current || verificacionPendiente) return;

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

    envioEnCurso.current = true;
    let disponibles;
    try { disponibles = await cargarHorarios(fechaLimpia); }
    catch (error) { envioEnCurso.current = false;
      Alert.alert('Disponibilidad', error.message); return; }
    if (!disponibles.includes(hora)) {
      envioEnCurso.current = false;
      Alert.alert('Horario ocupado', 'El horario cambió. Elige uno disponible.');
      return;
    }

    setGuardando(true);

    try {

      // Guardar la cita asociada al reporte
      const resultado = await crearCita(token, {
        id_reporte: idReporte,
        fecha_cita: fechaLimpia,
        hora_cita: hora,
        observaciones: observaciones.trim(),
      });

      if (!Number.isSafeInteger(Number(resultado?.cita?.id_cita)) ||
          Number(resultado.cita.id_reporte) !== Number(idReporte)) {
        throw new Error('No se pudo verificar la cita creada para este reporte.');
      }

      // La cita ya está confirmada por la API. Si falla la limpieza local,
      // Borradores volverá a conciliarla al abrir la pantalla.
      try {
        await confirmarCitaDeBorrador(token, idReporte, resultado.cita);
      } catch (_) { /* Conservar la cita remota y reintentar la conciliación. */ }

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
      if (error?.name === 'SesionExpiradaError') return;
      if (error?.status && error.status !== 409) {
        Alert.alert('No se pudo programar',
          'Revisa la fecha, el horario y el reporte antes de reintentar.');
        return;
      }
      try {
        const citas = await obtenerMisCitas(token);
        const confirmada = citas.find((item) => Number(item.id_reporte) === Number(idReporte) &&
          item.fecha_cita === fechaLimpia && item.hora_cita === hora &&
          ['programada', 'confirmada'].includes(item.estado));
        if (confirmada) {
          try { await confirmarCitaDeBorrador(token, idReporte, confirmada); }
          catch (_) { /* Borradores volverá a conciliar. */ }
          Alert.alert('Cita solicitada',
            'La cita quedó registrada y pendiente de confirmación administrativa.',
            [{ text: 'Aceptar', onPress: volverAInicio }]);
          return;
        }
        if (!error?.status) {
          setVerificacionPendiente(true);
          Alert.alert('Resultado por verificar',
            'No pudimos confirmar si se registró la cita. Comprueba su estado antes de reintentar.');
          return;
        }
      } catch (_) {
        if (error?.status) {
          Alert.alert('No se pudo programar',
            'El horario no está disponible. Consulta tus citas antes de reintentar.');
        } else {
          setVerificacionPendiente(true);
          Alert.alert('Resultado por verificar',
            'No se pudo comprobar si la cita quedó registrada. Comprueba el estado al recuperar internet.');
        }
        return;
      }
      Alert.alert('No se pudo programar',
        error?.status === 409 ? 'El horario ya no está disponible.' :
          'Revisa los datos o inténtalo nuevamente.');

    } finally {
      setGuardando(false);
      envioEnCurso.current = false;
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

          {consultando ? <ActivityIndicator color="#23558C" /> :
            horarios.length === 0 ? <Text style={styles.hint}>
              No hay horarios disponibles para esta fecha.</Text> : null}
          {horarios.map((opcion) => {

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
            Solo se muestran horarios habilitados y libres.
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
        {verificacionPendiente && <TouchableOpacity style={styles.submitButton}
          onPress={async () => {
            try {
              const citas = await obtenerMisCitas(token);
              const existente = citas.find((item) => Number(item.id_reporte) === Number(idReporte) &&
                ['programada', 'confirmada'].includes(item.estado));
              if (existente) {
                setVerificacionPendiente(false);
                Alert.alert('Cita encontrada', 'La cita ya está registrada.',
                  [{ text: 'Aceptar', onPress: volverAInicio }]);
              } else {
                setVerificacionPendiente(false);
                Alert.alert('Sin cita registrada', 'Puedes volver a solicitar el horario.');
              }
            } catch (_) { Alert.alert('Sin conexión', 'Inténtalo al recuperar internet.'); }
          }}><Text style={styles.submitText}>Comprobar estado</Text></TouchableOpacity>}
        <TouchableOpacity
          style={[
            styles.submitButton,
            guardando && styles.disabled,
          ]}
          onPress={guardarCita}
          disabled={guardando || verificacionPendiente || consultando}
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
