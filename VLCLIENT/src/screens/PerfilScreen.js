import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { obtenerMiPerfil, actualizarRecordatorioRenta } from '../services/api';
import {
  desactivarPushAlSalir,
  registrarPushTrasLogin,
  leerPreferenciaPush,
  guardarPreferenciaPush,
  pushRemotoHabilitado,
} from '../services/pushDispositivo';
import { SesionContext } from '../context/SesionContext';
import { cerrarSesionLocal } from '../services/cierreSesion';

export default function PerfilScreen({ navigation, route }) {
  const { terminarSesion } = useContext(SesionContext);
  const [notificaciones, setNotificaciones] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState('');
  const [diasRecordatorio, setDiasRecordatorio] = useState(null);
  const [guardandoRecordatorio, setGuardandoRecordatorio] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [cambiandoPush, setCambiandoPush] = useState(false);

  // Token recibido desde la pantalla Inicio
  const token = route.params?.token;

  const cargarPerfil = useCallback(async () => {
    if (!token) {
      setError('No se encontró una sesión válida.');
      setCargando(false);
      setActualizando(false);
      return;
    }

    try {
      setError('');

      const datos = await obtenerMiPerfil(token);
      setPerfil(datos);
      setDiasRecordatorio(Number(datos.recordatorio_renta_dias));
    } catch (err) {
      setError(err.message || 'No se pudo consultar tu perfil.');
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

  useEffect(() => {
    if (pushRemotoHabilitado) {
      void leerPreferenciaPush().then(setNotificaciones).catch(() => {});
    }
  }, []);

  const cambiarPush = async (habilitar) => {
    if (!pushRemotoHabilitado || cambiandoPush) return;
    setCambiandoPush(true);
    try {
      if (habilitar) {
        await guardarPreferenciaPush(true);
        setNotificaciones(true);
        const resultado = await registrarPushTrasLogin(token);
        if (resultado === 'sin_permiso') {
          await guardarPreferenciaPush(false);
          setNotificaciones(false);
          Alert.alert('Permiso denegado',
            'Activa las notificaciones para VLClient en los ajustes del dispositivo.');
        } else if (resultado === 'no_disponible') {
          Alert.alert('Push no disponible',
            'Los avisos remotos requieren una compilación compatible y la configuración Expo/EAS.');
        }
      } else {
        await desactivarPushAlSalir(token);
        await guardarPreferenciaPush(false);
        setNotificaciones(false);
      }
    } catch (_) {
      Alert.alert('No se pudo actualizar', habilitar
        ? 'No se pudo registrar este dispositivo. Se reintentará al volver a iniciar sesión.'
        : 'No se pudo desactivar este dispositivo. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setCambiandoPush(false);
    }
  };

  const actualizar = () => {
    setActualizando(true);
    cargarPerfil();
  };

  const guardarRecordatorio = async () => {
    if (guardandoRecordatorio || !Number.isInteger(diasRecordatorio) ||
        diasRecordatorio < 1 || diasRecordatorio > 31 || !token) return;
    setGuardandoRecordatorio(true);
    try {
      const resultado = await actualizarRecordatorioRenta(token, diasRecordatorio);
      setPerfil((anterior) => ({
        ...anterior,
        recordatorio_renta_dias: resultado.recordatorio_renta_dias,
      }));
      setDiasRecordatorio(resultado.recordatorio_renta_dias);
      Alert.alert('Preferencia guardada',
        `Recibirás el recordatorio de renta con ${resultado.recordatorio_renta_dias} días de anticipación.`);
    } catch (err) {
      Alert.alert('No se pudo guardar', err.message || 'Inténtalo de nuevo.');
    } finally {
      setGuardandoRecordatorio(false);
    }
  };

  const formatoFecha = (fecha) => {
    if (!fecha) return 'No disponible';

    const partes = String(fecha).slice(0, 10).split('-');

    if (partes.length !== 3) return String(fecha);

    const [anio, mes, dia] = partes.map(Number);

    if (!anio || !mes || !dia) return String(fecha);

    return new Date(anio, mes - 1, dia).toLocaleDateString(
      'es-MX',
      {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }
    );
  };

  const nombreCompleto = perfil
    ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
    : 'Inquilino';

  const iniciales = nombreCompleto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('');

  const mostrarValor = (valor) => {
    return valor === null || valor === undefined || valor === ''
      ? 'No disponible'
      : String(valor);
  };

  const cerrarSesion = () => {
    if (cerrandoSesion) return;
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            setCerrandoSesion(true);
            // El cierre local nunca depende de la red ni de la API push.
            cerrarSesionLocal(token, desactivarPushAlSalir, terminarSesion,
              () => navigation.reset({
                index: 0,
                routes: [{ name: 'Bienvenida' }],
              }));
            setCerrandoSesion(false);
          },
        },
      ]
    );
  };

  const InfoRow = ({ titulo, valor, ultimo = false }) => (
    <View style={[styles.infoRow, ultimo && styles.lastRow]}>
      <Text style={styles.infoLabel}>{titulo}</Text>
      <Text style={styles.infoValue}>{mostrarValor(valor)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
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

        {cargando ? (
          <View style={styles.cargandoContainer}>
            <ActivityIndicator size="large" color="#23558C" />
            <Text style={styles.cargandoTexto}>
              Cargando información del perfil...
            </Text>
          </View>
        ) : (
          <>
            {/* DATOS DEL INQUILINO */}
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {perfil ? iniciales : '?'}
                </Text>
              </View>

              <Text style={styles.name}>
                {perfil ? nombreCompleto : 'Perfil no disponible'}
              </Text>

              <Text style={styles.email}>
                {perfil ? mostrarValor(perfil.correo) : ''}
              </Text>
            </View>

            {!!error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={actualizar}>
                  <Text style={styles.retryText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            )}

            {perfil && (
              <>
                {/* DATOS PERSONALES */}
                <Text style={styles.sectionTitle}>
                  Mis datos personales
                </Text>

                <View style={styles.card}>
                  <InfoRow
                    titulo="Nombre completo"
                    valor={nombreCompleto}
                  />

                  <InfoRow
                    titulo="Correo electrónico"
                    valor={perfil.correo}
                  />

                  <InfoRow
                    titulo="Teléfono"
                    valor={perfil.telefono}
                    ultimo
                  />
                </View>

                {/* DATOS DEL CONTRATO */}
                <Text style={styles.sectionTitle}>Mi contrato</Text>

                <View style={styles.card}>
                  {perfil.id_contrato ? (
                    <>
                      <InfoRow
                        titulo="Propiedad"
                        valor={perfil.propiedad}
                      />

                      <InfoRow
                        titulo="Dirección"
                        valor={perfil.direccion}
                      />

                      <InfoRow
                        titulo="Edificio / Torre"
                        valor={perfil.edificio}
                      />

                      <InfoRow
                        titulo="Departamento"
                        valor={perfil.numero_departamento}
                      />

                      <InfoRow
                        titulo="Inicio de contrato"
                        valor={formatoFecha(perfil.fecha_inicio)}
                      />

                      <InfoRow
                        titulo="Vencimiento"
                        valor={formatoFecha(perfil.fecha_fin)}
                      />

                      <InfoRow
                        titulo="Estado del contrato"
                        valor={perfil.estado_contrato}
                        ultimo
                      />
                    </>
                  ) : (
                    <Text style={styles.sinContrato}>
                      No se encontró un contrato activo.
                    </Text>
                  )}
                </View>
              </>
            )}

            {/* CONFIGURACIÓN */}
            <Text style={styles.sectionTitle}>Configuración</Text>

            <View style={styles.card}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() =>
                  Alert.alert(
                    'Cambiar contraseña',
                    'Esta función todavía no está disponible.'
                  )
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={21}
                  color="#23558C"
                />
                <Text style={styles.optionText}>
                  Cambiar contraseña (próximamente)
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color="#94A3B8"
                />
              </TouchableOpacity>

              <View style={styles.optionRow}>
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color="#23558C"
                />

                <Text style={styles.optionText}>
                  {pushRemotoHabilitado
                    ? 'Avisos push remotos'
                    : 'Avisos push remotos (futura actualización)'}
                </Text>

                {pushRemotoHabilitado && <Switch
                  value={notificaciones}
                  onValueChange={cambiarPush}
                  disabled={cambiandoPush}
                  trackColor={{
                    false: '#CBD5E1',
                    true: '#A3C9E8',
                  }}
                  thumbColor={
                    notificaciones ? '#23558C' : '#F1F5F9'
                  }
                />}
              </View>

              {!pushRemotoHabilitado && <Text style={styles.recordatorioAyuda}>
                Tus notificaciones dentro de VLClient siguen disponibles.
              </Text>}

              {perfil && (
                <View style={styles.recordatorioContainer}>
                  <View style={styles.recordatorioTitulo}>
                    <Ionicons name="calendar-outline" size={21} color="#23558C" />
                    <Text style={styles.optionText}>Recordatorio de renta</Text>
                  </View>
                  <Text style={styles.recordatorioAyuda}>
                    Días antes del vencimiento de tu renta (1 a 31).
                  </Text>
                  <View style={styles.selectorDias}>
                    <TouchableOpacity
                      style={styles.selectorBoton}
                      onPress={() => setDiasRecordatorio((dias) => Math.max(1, dias - 1))}
                      disabled={guardandoRecordatorio || diasRecordatorio <= 1}
                      accessibilityRole="button"
                      accessibilityLabel="Reducir días de anticipación"
                      accessibilityState={{ disabled: guardandoRecordatorio || diasRecordatorio <= 1 }}
                    >
                      <Text style={styles.selectorSimbolo}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.diasValor}>{diasRecordatorio} días</Text>
                    <TouchableOpacity
                      style={styles.selectorBoton}
                      onPress={() => setDiasRecordatorio((dias) => Math.min(31, dias + 1))}
                      disabled={guardandoRecordatorio || diasRecordatorio >= 31}
                      accessibilityRole="button"
                      accessibilityLabel="Aumentar días de anticipación"
                      accessibilityState={{ disabled: guardandoRecordatorio || diasRecordatorio >= 31 }}
                    >
                      <Text style={styles.selectorSimbolo}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.guardarRecordatorio,
                      (guardandoRecordatorio || diasRecordatorio === perfil.recordatorio_renta_dias) &&
                        styles.guardarDeshabilitado]}
                    onPress={guardarRecordatorio}
                    disabled={guardandoRecordatorio ||
                      diasRecordatorio === perfil.recordatorio_renta_dias}
                    accessibilityRole="button"
                    accessibilityLabel="Guardar anticipación del recordatorio de renta"
                  >
                    {guardandoRecordatorio ? <ActivityIndicator color="#FFFFFF" /> :
                      <Text style={styles.guardarRecordatorioTexto}>Guardar anticipación</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* CERRAR SESIÓN */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={cerrarSesion}
              disabled={cerrandoSesion}
            >
              <Ionicons
                name="log-out-outline"
                size={21}
                color="#DC2626"
              />
              <Text style={styles.logoutText}>
                Cerrar sesión
              </Text>
            </TouchableOpacity>

            <Text style={styles.version}>
              VLClient — Versión 1.0.0
            </Text>
          </>
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
    paddingTop: 20,
    paddingBottom: 35,
  },
  cargandoContainer: {
    paddingVertical: 55,
    alignItems: 'center',
  },
  cargandoTexto: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 15,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#23558C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 27,
  },
  name: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  email: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 27,
  },
  infoRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    textAlign: 'right',
  },
  sinContrato: {
    paddingVertical: 18,
    color: '#64748B',
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 12,
    marginBottom: 22,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
  },
  retryText: {
    color: '#23558C',
    fontWeight: 'bold',
    marginTop: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  recordatorioContainer: { paddingVertical: 18 },
  recordatorioTitulo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordatorioAyuda: { color: '#64748B', fontSize: 12, marginTop: 8 },
  selectorDias: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 22, marginVertical: 17 },
  selectorBoton: { width: 44, height: 44, borderRadius: 10,
    borderColor: '#23558C', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  selectorSimbolo: { fontSize: 24, color: '#23558C', fontWeight: 'bold' },
  diasValor: { minWidth: 80, textAlign: 'center', color: '#1E293B',
    fontSize: 17, fontWeight: 'bold' },
  guardarRecordatorio: { minHeight: 46, backgroundColor: '#23558C',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  guardarDeshabilitado: { opacity: 0.45 },
  guardarRecordatorioTexto: { color: '#FFFFFF', fontWeight: 'bold' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 17,
    borderRadius: 12,
    gap: 10,
  },
  logoutText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 25,
  },
});
