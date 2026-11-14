
import React, { useEffect, useRef, useState } from 'react';
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
  crearIdBorrador, guardarBorrador, obtenerBorrador,
  copiarFotoBorrador, quitarFotoBorrador, fotosFaltantes,
  cambiarEstadoBorrador,
} from '../services/borradoresReporte';
import { sincronizarBorradores, observarSincronizacion } from '../services/sincronizarReportes';


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
  const idInquilino = route.params?.idInquilino;
  const idBorrador = useRef(route.params?.idBorrador || crearIdBorrador()).current;

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fotografias, setFotografias] = useState([]);
  const [listo, setListo] = useState(false);
  const [estadoBorrador, setEstadoBorrador] = useState('borrador');
  const [idReporteGuardado, setIdReporteGuardado] = useState(null);
  const [errorLocal, setErrorLocal] = useState('');
  const guardado = useRef(Promise.resolve());

  const persistir = (datos) => {
    const tarea = guardado.current.then(() => guardarBorrador({
      id: idBorrador, id_inquilino: idInquilino, ...datos,
    }));
    guardado.current = tarea.catch(() => {});
    return tarea;
  };

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        if (!Number.isSafeInteger(Number(idInquilino)) || Number(idInquilino) <= 0) {
          throw new Error('Inicia sesión para abrir tus borradores.');
        }
        const existente = route.params?.idBorrador
          ? await obtenerBorrador(idBorrador, idInquilino) : null;
        if (route.params?.idBorrador && !existente) {
          throw new Error('Borrador no encontrado para esta cuenta.');
        }
        if (activo && existente) {
          if (existente.estado === 'sincronizando') {
            existente.estado = existente.id_reporte ? 'error' : 'error_ambiguo';
            await guardarBorrador(existente);
          }
          setTitulo(existente.titulo);
          setDescripcion(existente.descripcion);
          setCategoria(existente.categoria);
          setFotografias(existente.fotos);
          setEstadoBorrador(existente.estado);
          setIdReporteGuardado(existente.id_reporte);
          if (fotosFaltantes(existente.fotos).length) {
            setErrorLocal('Una o más fotografías ya no están disponibles. Quítalas y vuelve a adjuntarlas.');
          }
        }
        if (activo) setListo(true);
      } catch (error) {
        if (activo) setErrorLocal(error.message);
      }
    })();
    return () => { activo = false; };
  }, [idBorrador, idInquilino]);

  useEffect(() => {
    if (!listo || estadoBorrador !== 'borrador') return;
    void persistir({ titulo, descripcion, categoria, fotos: fotografias,
      estado: estadoBorrador, id_reporte: null })
      .then(() => setErrorLocal((anterior) => anterior ===
        'No se pudo guardar el borrador en este dispositivo.' ? '' : anterior))
      .catch(() => setErrorLocal('No se pudo guardar el borrador en este dispositivo.'));
  }, [listo, titulo, descripcion, categoria, fotografias, estadoBorrador, idReporteGuardado]);

  useEffect(() => observarSincronizacion(() => {
    void obtenerBorrador(idBorrador, idInquilino).then((actual) => {
      if (!actual || actual.estado === 'borrador') return;
      setEstadoBorrador(actual.estado);
      setIdReporteGuardado(actual.id_reporte);
      setFotografias(actual.fotos);
    }).catch(() => {});
  }), [idBorrador, idInquilino]);

  const salirGuardando = async () => {
    if (!listo) return;
    try {
      if (estadoBorrador === 'borrador') {
        await persistir({ titulo, descripcion, categoria, fotos: fotografias,
          estado: estadoBorrador, id_reporte: idReporteGuardado });
      }
      navigation.goBack();
    } catch (_) {
      Alert.alert('No se pudo guardar', 'Revisa el espacio disponible e inténtalo de nuevo.');
    }
  };

  const agregarFotos = async (fotos) => {
    const copiadas = [];
    try {
      for (const foto of fotos) {
        copiadas.push(await copiarFotoBorrador(idBorrador, idInquilino, foto));
      }
      setFotografias((anteriores) => [...anteriores, ...copiadas].slice(0, 5));
      setErrorLocal('');
    } catch (error) {
      copiadas.forEach(quitarFotoBorrador);
      Alert.alert('Fotografía no guardada', error.message);
    }
  };

  
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
    await agregarFotos(resultado.assets.slice(0, espaciosDisponibles));
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
    await agregarFotos([resultado.assets[0]]);
  }
};

const quitarFotografia = (indice) => {
  quitarFotoBorrador(fotografias[indice]);
  setErrorLocal('');
  setFotografias((anteriores) =>
    anteriores.filter((_, i) => i !== indice)
  );
};


  

const enviarReporte = async () => {
  if (enviando || !listo || !token) return;
  if (estadoBorrador === 'enviado' && idReporteGuardado) {
    navigation.replace('NuevaCita', { token, idReporte: idReporteGuardado, tituloReporte: titulo.trim() });
    return;
  }
  if (['error_ambiguo', 'error', 'sincronizando', 'sincronizando_idempotente'].includes(estadoBorrador)) {
    Alert.alert('Borrador pendiente', 'Espera a que termine la sincronización o revisa el reporte antes de enviarlo.');
    return;
  }
  if (estadoBorrador === 'borrador') {
    if (!titulo.trim() || !descripcion.trim() || !categoria) {
      Alert.alert('Campos obligatorios', 'Completa el título, la descripción y la categoría.');
      return;
    }
    if (titulo.trim().length > 150 || descripcion.trim().length > 2000) {
      Alert.alert('Texto demasiado largo', 'Revisa el título y la descripción.');
      return;
    }
  }
  if (fotografias.length > 5 || fotosFaltantes(fotografias).length) {
    Alert.alert('Fotografías pendientes', 'Comprueba que las fotografías estén guardadas en este dispositivo.');
    return;
  }
  setEnviando(true);
  try {
    if (estadoBorrador === 'borrador') {
      await persistir({ titulo, descripcion, categoria, fotos: fotografias,
        estado: 'pendiente_sincronizacion', id_reporte: idReporteGuardado });
      setEstadoBorrador('pendiente_sincronizacion');
    } else if (estadoBorrador === 'error_reintentar') {
      const cambiado = await cambiarEstadoBorrador(
        idBorrador, idInquilino, 'error_reintentar', 'pendiente_sincronizacion'
      );
      if (!cambiado) throw new Error('El borrador cambió de estado. Vuelve a abrirlo.');
      setEstadoBorrador('pendiente_sincronizacion');
    }
    const resultado = await sincronizarBorradores(token, idInquilino);
    const actual = await obtenerBorrador(idBorrador, idInquilino);
    if (actual) {
      setEstadoBorrador(actual.estado);
      setIdReporteGuardado(actual.id_reporte);
      setFotografias(actual.fotos);
    }
    if (actual?.estado === 'enviado') {
      Alert.alert('Reporte enviado', 'El reporte y sus fotografías se confirmaron correctamente.', [
        { text: 'Continuar a la cita', onPress: () => navigation.replace('NuevaCita', {
          token, idReporte: actual.id_reporte, tituloReporte: titulo.trim(),
        }) },
      ]);
    } else if (resultado.estado === 'sin_conexion') {
      Alert.alert('Guardado sin conexión', 'El reporte se sincronizará al recuperar la conexión mientras VLClient esté abierta.');
    } else if (resultado.estado === 'sesion_vencida') {
      Alert.alert('Sesión vencida', 'Inicia sesión nuevamente con la misma cuenta para sincronizar el reporte.');
    } else if (resultado.estado === 'otra_cuenta') {
      Alert.alert('Cuenta distinta', 'Inicia sesión con el propietario de este borrador para sincronizarlo.');
    } else if (resultado.estado !== 'en_curso') {
      Alert.alert('Sincronización pendiente', 'El reporte permanece guardado. Podrás reintentarlo desde este dispositivo.');
    }
  } catch (error) {
    Alert.alert('No se pudo sincronizar', error.message || 'Inténtalo nuevamente.');
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
          <Text style={{ color: '#23558C', marginTop: 8 }}>
            {estadoBorrador === 'pendiente_sincronizacion' ? 'Pendiente de sincronización' :
              ['sincronizando', 'sincronizando_idempotente'].includes(estadoBorrador) ? 'Sincronizando' :
              estadoBorrador === 'enviado' ? 'Enviado' :
              estadoBorrador === 'error_reintentar' ? 'Error: toca Reintentar' :
              estadoBorrador === 'error_ambiguo' ? 'Error: resultado sin confirmar' :
              estadoBorrador === 'error' ? 'Error: revisa el borrador' : 'Borrador'}
          </Text>
          {!!errorLocal && <Text style={{ color: '#B91C1C', marginTop: 8 }}>{errorLocal}</Text>}
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
            editable={!enviando && estadoBorrador === 'borrador'}
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
                  disabled={enviando || estadoBorrador !== 'borrador'}
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
            editable={!enviando && estadoBorrador === 'borrador'}
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
              disabled={enviando || !listo || estadoBorrador !== 'borrador' || fotografias.length >= 5}
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
              disabled={enviando || !listo || estadoBorrador !== 'borrador' || fotografias.length >= 5}
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
                  disabled={enviando || estadoBorrador !== 'borrador'}
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
          disabled={enviando || !listo ||
            ['error_ambiguo', 'error', 'sincronizando', 'sincronizando_idempotente'].includes(estadoBorrador)}
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
                {estadoBorrador === 'error_reintentar' ? 'Reintentar envío' :
                  estadoBorrador === 'enviado' ? 'Continuar a la cita' : 'Enviar reporte'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {estadoBorrador === 'enviado' && !!idReporteGuardado && (
          <TouchableOpacity style={styles.submitButton}
            onPress={() => navigation.replace('NuevaCita', {
              token, idReporte: idReporteGuardado, tituloReporte: titulo.trim(),
            })}>
            <Text style={styles.submitText}>Continuar con el reporte #{idReporteGuardado}</Text>
          </TouchableOpacity>
        )}

        {/* CANCELAR */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={salirGuardando}
          disabled={enviando}
        >
          <Text style={styles.cancelText}>
            Guardar borrador y volver
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
