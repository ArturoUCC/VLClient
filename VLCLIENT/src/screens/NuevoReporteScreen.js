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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { crearReporte } from '../services/api';

const CATEGORIAS = [
  { valor: 'plomeria', nombre: 'Plomería', icono: 'water-outline' },
  { valor: 'electricidad', nombre: 'Electricidad', icono: 'flash-outline' },
  { valor: 'estructura', nombre: 'Estructura', icono: 'business-outline' },
  { valor: 'electrodomesticos', nombre: 'Electrodomésticos', icono: 'tv-outline' },
  { valor: 'limpieza', nombre: 'Limpieza', icono: 'sparkles-outline' },
  { valor: 'otro', nombre: 'Otro', icono: 'ellipsis-horizontal-outline' },
];

export default function NuevoReporteScreen({ navigation, route }) {
  const token = route.params?.token;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviarReporte = async () => {
    if (enviando) return;

    if (!titulo.trim()) {
      Alert.alert('Campo obligatorio', 'Escribe el título del reporte.');
      return;
    }

    if (!descripcion.trim()) {
      Alert.alert('Campo obligatorio', 'Describe el desperfecto.');
      return;
    }

    if (!categoria) {
      Alert.alert('Campo obligatorio', 'Selecciona una categoría.');
      return;
    }

    if (titulo.trim().length > 150) {
      Alert.alert('Título demasiado largo', 'El máximo es de 150 caracteres.');
      return;
    }

    if (descripcion.trim().length > 2000) {
      Alert.alert('Descripción demasiado larga', 'El máximo es de 2000 caracteres.');
      return;
    }

    if (!token) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar sesión.');
      return;
    }

    setEnviando(true);

    try {
      const resultado = await crearReporte(token, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria,
      });

      Alert.alert(
        'Reporte registrado',
        `Tu reporte #${resultado.reporte.id_reporte} se registró correctamente.`,
        [
          {
            text: 'Aceptar',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Error al registrar',
        error.message || 'No fue posible guardar el reporte.'
      );
    } finally {
      setEnviando(false);
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Ionicons
              name="construct-outline"
              size={35}
              color="#23558C"
            />
            <Text style={styles.title}>Nuevo reporte</Text>
            <Text style={styles.subtitle}>
              Describe el problema que presenta tu vivienda.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Título del reporte *</Text>

            <TextInput
              style={styles.input}
              placeholder="Ej. Fuga de agua en la cocina"
              placeholderTextColor="#94A3B8"
              value={titulo}
              onChangeText={setTitulo}
              maxLength={150}
              editable={!enviando}
            />

            <Text style={styles.contador}>{titulo.length}/150</Text>

            <Text style={styles.label}>Categoría *</Text>

            <View style={styles.categorias}>
              {CATEGORIAS.map((item) => {
                const seleccionada = categoria === item.valor;

                return (
                  <TouchableOpacity
                    key={item.valor}
                    style={[
                      styles.categoriaButton,
                      seleccionada && styles.categoriaSeleccionada,
                    ]}
                    onPress={() => setCategoria(item.valor)}
                    disabled={enviando}
                  >
                    <Ionicons
                      name={item.icono}
                      size={21}
                      color={seleccionada ? '#FFFFFF' : '#23558C'}
                    />

                    <Text
                      style={[
                        styles.categoriaText,
                        seleccionada && styles.categoriaTextSeleccionada,
                      ]}
                    >
                      {item.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Descripción del problema *</Text>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Explica dónde está el desperfecto, desde cuándo ocurre y qué sucede..."
              placeholderTextColor="#94A3B8"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              textAlignVertical="top"
              maxLength={2000}
              editable={!enviando}
            />

            <Text style={styles.contador}>
              {descripcion.length}/2000
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#23558C"
            />

            <Text style={styles.infoText}>
              El reporte se asociará a tu contrato activo.
              Su estado inicial será Pendiente y su prioridad será Media.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              enviando && styles.submitDisabled,
            ]}
            onPress={enviarReporte}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="send-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.submitText}>
                  Enviar reporte
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={enviando}
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
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
    backgroundColor: '#F5F7FA',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 45,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 17,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    marginBottom: 5,
  },
  textArea: {
    height: 135,
    marginTop: 2,
  },
  contador: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginBottom: 22,
  },
  categorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 24,
  },
  categoriaButton: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE7F2',
    backgroundColor: '#F8FAFC',
  },
  categoriaSeleccionada: {
    backgroundColor: '#23558C',
    borderColor: '#23558C',
  },
  categoriaText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flexShrink: 1,
  },
  categoriaTextSeleccionada: {
    color: '#FFFFFF',
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
    borderRadius: 12,
    paddingVertical: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  submitDisabled: {
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
