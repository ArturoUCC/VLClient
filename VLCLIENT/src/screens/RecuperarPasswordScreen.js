import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { solicitarRecuperacionPassword } from '../services/api';

const MENSAJE_CONFIRMACION =
  'Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu contraseña.';

export default function RecuperarPasswordScreen({ navigation }) {
  const [correo, setCorreo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState('');

  const enviarSolicitud = async () => {
    if (cargando || confirmado) return;

    const correoNormalizado = correo.trim();
    if (
      correoNormalizado.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)
    ) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setError('');
    setCargando(true);
    try {
      await solicitarRecuperacionPassword(correoNormalizado);
      setConfirmado(true);
    } catch (_) {
      setError('No se pudo enviar la solicitud. Inténtalo más tarde.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require('../../assets/images/logo-viveslara-notexto.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>
            {confirmado
              ? 'Revisa tu correo para continuar.'
              : 'Ingresa el correo de tu cuenta de inquilino.'}
          </Text>

          {confirmado ? (
            <View style={styles.confirmacion}>
              <Text style={styles.confirmacionTexto}>{MENSAJE_CONFIRMACION}</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#9AA8B5"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={correo}
                onChangeText={(valor) => {
                  setCorreo(valor);
                  if (error) setError('');
                }}
                editable={!cargando}
                accessibilityLabel="Correo electrónico"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, cargando && styles.buttonDisabled]}
                onPress={enviarSolicitud}
                disabled={cargando}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>
                  {cargando ? 'Enviando solicitud...' : 'Enviar enlace de recuperación'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 35,
  },
  logo: {
    width: 70,
    height: 70,
    alignSelf: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#23558C',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    marginBottom: 35,
    lineHeight: 22,
  },
  form: { width: '100%' },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 52,
    fontSize: 15,
    marginBottom: 23,
    color: '#243746',
    backgroundColor: '#F9FBFD',
  },
  button: {
    backgroundColor: '#23558C',
    paddingVertical: 17,
    paddingHorizontal: 12,
    borderRadius: 11,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  error: {
    color: '#A83232',
    fontSize: 14,
    marginBottom: 18,
  },
  confirmacion: {
    padding: 18,
    borderRadius: 10,
    backgroundColor: '#EFF6FC',
    borderWidth: 1,
    borderColor: '#D9E7F3',
  },
  confirmacionTexto: {
    color: '#23558C',
    fontSize: 15,
    lineHeight: 23,
  },
  backButton: {
    alignSelf: 'center',
    marginTop: 28,
    paddingVertical: 12,
  },
  backText: {
    color: '#2871AE',
    fontSize: 14,
    fontWeight: '600',
  },
});
