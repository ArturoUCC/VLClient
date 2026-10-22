
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginInquilino } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);

  
const iniciarSesion = async () => {
  if (cargando) return;

  if (!correo.trim() || !password.trim()) {
    Alert.alert(
      'Campos incompletos',
      'Ingresa tu correo y contraseña.'
    );
    return;
  }

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!correoValido.test(correo.trim())) {
    Alert.alert(
      'Correo inválido',
      'Ingresa un correo electrónico válido.'
    );
    return;
  }

  setCargando(true);

  try {
    const respuesta = await loginInquilino(
      correo.trim(),
      password
    );

    // El token se pasa temporalmente por navegación.
    // Después implementaremos su almacenamiento seguro.
    navigation.replace('Inicio', {
      token: respuesta.token,
      inquilino: respuesta.inquilino
    });

  } catch (error) {
    Alert.alert(
      'Error de inicio de sesión',
      error.message === 'Network request failed'
        ? 'No se pudo conectar con el servidor. Revisa la red y el backend.'
        : error.message
    );
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

          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>
            Ingresa a tu cuenta de inquilino
          </Text>

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
              onChangeText={setCorreo}
            />

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#9AA8B5"
                secureTextEntry={!mostrarPassword}
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                onPress={() => setMostrarPassword(!mostrarPassword)}
                accessibilityRole="button"
                accessibilityLabel={
                  mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
              >
                <Text style={styles.showText}>
                  {mostrarPassword ? 'Ocultar' : 'Mostrar'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() =>
                Alert.alert(
                  'Recuperar contraseña',
                  'Esta función se implementará próximamente.'
                )
              }
            >
              <Text style={styles.forgotText}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            
<TouchableOpacity
  style={[styles.button, cargando && { opacity: 0.6 }]}
  onPress={iniciarSesion}
  disabled={cargando}
>
  <Text style={styles.buttonText}>
    {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
  </Text>
</TouchableOpacity>

          </View>

          <Text style={styles.footer}>
            Al ingresar aceptas los términos y condiciones de Vives Lara.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
  },
  form: {
    width: '100%',
  },
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 10,
    backgroundColor: '#F9FBFD',
    marginBottom: 15,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#243746',
  },
  showText: {
    color: '#23558C',
    fontSize: 13,
    fontWeight: '600',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotText: {
    color: '#2871AE',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#23558C',
    paddingVertical: 17,
    borderRadius: 11,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 45,
    color: '#98A5B3',
    fontSize: 12,
    textAlign: 'center',
  },
});
