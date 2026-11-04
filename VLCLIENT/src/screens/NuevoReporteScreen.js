
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import {
  crearReporte,
  subirFotosReporte,
} from '../services/api';


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
  const [fotografias, setFotografias] = useState([]);

  
const seleccionarFotografias = async () => {
  const espaciosDisponibles = 5 - fotografias.length;

  if (espaciosDisponibles <= 0) {
    Alert.alert(
      'Límite alcanzado',
      'Solo puedes adjuntar hasta 5 fotografías.'
    );
    return;
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: espaciosDisponibles,
    quality: 0.7,
  });

  if (!resultado.canceled) {
    setFotografias((anteriores) => [
      ...anteriores,
      ...resultado.assets.slice(0, 5 - anteriores.length),
    ]);
  }
};

const tomarFotografia = async () => {
  if (fotografias.length >= 5) {
    Alert.alert('Límite alcanzado', 'Solo puedes adjuntar 5 fotografías.');
    return;
  }

  const permiso = await ImagePicker.requestCameraPermissionsAsync();

  if (!permiso.granted) {
    Alert.alert(
      'Permiso necesario',
      'Debes permitir el acceso a la cámara.'
    );
    return;
  }

  const resultado = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  });

  if (!resultado.canceled) {
    setFotografias((anteriores) => [
      ...anteriores,
      resultado.assets[0],
    ].slice(0, 5));
  }
};

const quitarFotografia = (indice) => {
  setFotografias((anteriores) =>
    anteriores.filter((_, i) => i !== indice)
  );
};


  

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

  if (titulo.trim().length > 150 || descripcion.trim().length > 2000) {
    Alert.alert('Texto demasiado largo', 'Revisa el título y la descripción.');
    return;
  }

  if (!token) {
    Alert.alert('Sesión inválida', 'Inicia sesión nuevamente.');
    return;
  }

  if (fotografias.length > 5) {
    Alert.alert('Límite excedido', 'Solo puedes adjuntar 5 fotografías.');
    return;
  }

  setEnviando(true);

  let reporteCreado = null;

  const continuarACita = (idReporte) => {
    navigation.replace('NuevaCita', {
      token,
      idReporte,
      tituloReporte: titulo.trim(),
    });
  };

  try {
    // 1. Guardar el reporte en Neon
    const resultado = await crearReporte(token, {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      categoria,
    });

    reporteCreado = resultado.reporte;

    if (!reporteCreado?.id_reporte) {
      throw new Error('No se recibió el identificador del reporte.');
    }

    // 2. Subir las fotos a Cloudinary
    if (fotografias.length > 0) {
      try {
        await subirFotosReporte(
          token,
          reporteCreado.id_reporte,
          fotografias
        );
      } catch (errorFotos) {
        Alert.alert(
          'Reporte guardado, fotografías pendientes',
          `El reporte #${reporteCreado.id_reporte} ya existe, pero no se pudieron confirmar las fotografías.\n\n${errorFotos.message}\n\nPuedes continuar con tu cita sin crear otro reporte.`,
          [
            {
              text: 'Continuar a la cita',
              onPress: () =>
                continuarACita(reporteCreado.id_reporte),
            },
          ]
        );
        return;
      }
    }

    // 3. Continuar directamente con la cita
    continuarACita(reporteCreado.id_reporte);

  } catch (error) {
    if (reporteCreado?.id_reporte) {
      Alert.alert(
        'Reporte creado',
        `El reporte #${reporteCreado.id_reporte} ya está registrado. Evita volver a enviarlo.`,
        [
          {
            text: 'Continuar a la cita',
            onPress: () =>
              continuarACita(reporteCreado.id_reporte),
          },
        ]
      );
    } else {
      Alert.alert(
        'Error al registrar reporte',
        error.message || 'No se pudo guardar el reporte.'
      );
    }
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
        {/* ENCABEZADO */}
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

        {/* INFORMACIÓN DEL REPORTE */}
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

          <Text style={styles.contador}>
            {titulo.length}/150
          </Text>

          {/* CATEGORÍA */}
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

          {/* DESCRIPCIÓN */}
          <Text style={styles.label}>
            Descripción del problema *
          </Text>

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

        {/* FOTOGRAFÍAS DEL DESPERFECTO */}
        <View style={styles.fotosCard}>
          <Text style={styles.fotosTitulo}>
            Fotografías del desperfecto
          </Text>

          <Text style={styles.fotosSubtitulo}>
            Adjunta hasta 5 fotografías ({fotografias.length}/5)
          </Text>

          {/* BOTONES GALERÍA Y CÁMARA */}
          <View style={styles.fotosBotones}>
            <TouchableOpacity
              style={styles.fotoBoton}
              onPress={seleccionarFotografias}
              disabled={enviando || fotografias.length >= 5}
            >
              <Ionicons
                name="images-outline"
                size={24}
                color="#23558C"
              />

              <Text style={styles.fotoBotonTexto}>
                Galería
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fotoBoton}
              onPress={tomarFotografia}
              disabled={enviando || fotografias.length >= 5}
            >
              <Ionicons
                name="camera-outline"
                size={24}
                color="#23558C"
              />

              <Text style={styles.fotoBotonTexto}>
                Cámara
              </Text>
            </TouchableOpacity>
          </View>

          {/* VISTA PREVIA DE LAS FOTOGRAFÍAS */}
          <View style={styles.fotosPreview}>
            {fotografias.map((foto, indice) => (
              <View
                key={`${foto.uri}-${indice}`}
                style={styles.fotoContenedor}
              >
                <Image
                  source={{ uri: foto.uri }}
                  style={styles.fotoImagen}
                />

                {/* ELIMINAR FOTOGRAFÍA */}
                <TouchableOpacity
                  style={styles.quitarFoto}
                  onPress={() => quitarFotografia(indice)}
                  disabled={enviando}
                >
                  <Ionicons
                    name="close-circle"
                    size={26}
                    color="#DC2626"
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* INFORMACIÓN ADICIONAL */}
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

        {/* ENVIAR REPORTE */}
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

        {/* CANCELAR */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={enviando}
        >
          <Text style={styles.cancelText}>
            Cancelar
          </Text>
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
  
fotosCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  padding: 18,
  marginBottom: 17,
},
fotosTitulo: {
  fontSize: 14,
  fontWeight: '600',
  color: '#334155',
},
fotosSubtitulo: {
  fontSize: 12,
  color: '#64748B',
  marginTop: 6,
  marginBottom: 15,
},
fotosBotones: {
  flexDirection: 'row',
  gap: 10,
},
fotoBoton: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 16,
  backgroundColor: '#EAF2F9',
  borderRadius: 12,
  gap: 7,
},
fotoBotonTexto: {
  color: '#23558C',
  fontSize: 13,
  fontWeight: '600',
},
fotosPreview: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 15,
},
fotoContenedor: {
  width: 90,
  height: 90,
  position: 'relative',
},
fotoImagen: {
  width: 90,
  height: 90,
  borderRadius: 10,
},
quitarFoto: {
  position: 'absolute',
  top: -8,
  right: -8,
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
},

});
