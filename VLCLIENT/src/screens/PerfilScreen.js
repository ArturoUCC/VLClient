
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function PerfilScreen({ navigation }) {
  const [notificaciones, setNotificaciones] = useState(true);

  // Datos de ejemplo para el Sprint 1
  const inquilino = {
    nombre: 'Carlos Mendoza Ruiz',
    correo: 'carlos.mendoza@ejemplo.com',
    edificio: 'Torre B',
    departamento: 'Número 304',
    inicioContrato: '15 de octubre de 2024',
    vencimientoContrato: '30 de septiembre de 2027',
  };

  const cerrarSesion = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Bienvenida' }],
            }),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* DATOS DEL INQUILINO */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>CM</Text>
          </View>

          <Text style={styles.name}>{inquilino.nombre}</Text>
          <Text style={styles.email}>{inquilino.correo}</Text>
        </View>

        {/* DATOS DEL CONTRATO */}
        <Text style={styles.sectionTitle}>Mi contrato</Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Edificio / Torre</Text>
            <Text style={styles.infoValue}>{inquilino.edificio}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Departamento</Text>
            <Text style={styles.infoValue}>{inquilino.departamento}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Inicio de contrato</Text>
            <Text style={styles.infoValue}>{inquilino.inicioContrato}</Text>
          </View>

          <View style={[styles.infoRow, styles.lastRow]}>
            <Text style={styles.infoLabel}>Vencimiento</Text>
            <Text style={styles.infoValue}>
              {inquilino.vencimientoContrato}
            </Text>
          </View>
        </View>

        {/* CONFIGURACIÓN */}
        <Text style={styles.sectionTitle}>Configuración</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() =>
              Alert.alert(
                'Cambiar contraseña',
                'Esta función estará disponible al integrar la autenticación.'
              )
            }
          >
            <Ionicons name="lock-closed-outline" size={21} color="#23558C" />
            <Text style={styles.optionText}>Cambiar contraseña</Text>
            <Ionicons name="chevron-forward" size={19} color="#94A3B8" />
          </TouchableOpacity>

          <View style={[styles.optionRow, styles.lastRow]}>
            <Ionicons name="notifications-outline" size={21} color="#23558C" />
            <Text style={styles.optionText}>Notificaciones</Text>

            <Switch
              value={notificaciones}
              onValueChange={setNotificaciones}
              trackColor={{ false: '#CBD5E1', true: '#A3C9E8' }}
              thumbColor={notificaciones ? '#23558C' : '#F1F5F9'}
            />
          </View>
        </View>

        {/* CERRAR SESIÓN */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={cerrarSesion}
        >
          <Ionicons name="log-out-outline" size={21} color="#DC2626" />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>VLClient — Versión 1.0.0</Text>
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
