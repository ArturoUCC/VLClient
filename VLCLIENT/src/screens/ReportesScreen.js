import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet,
  Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { obtenerReportesResumen } from '../services/api';

const fechaVisible = (valor) => {
  if (!valor) return 'Sin fecha';
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-');
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : String(valor);
};

export default function ReportesScreen({ navigation, route }) {
  const token = route.params?.token;
  const idInquilino = route.params?.idInquilino;
  const [reportes, setReportes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  const pendiente = useRef(false);
  const fotoTiempos = useRef({});

  const cargar = useCallback(async (siguiente = 1) => {
    if (!token || pendiente.current) return;
    pendiente.current = true;
    const actual = ++version.current;
    if (siguiente === 1) setActualizando(true);
    else setCargandoMas(true);
    try {
      const inicio = Date.now();
      const datos = await obtenerReportesResumen(token, siguiente);
      if (actual !== version.current) return;
      if (__DEV__) console.info('Rendimiento reportes: API y datos',
        Date.now() - inicio, 'ms');
      setReportes((previos) => siguiente === 1 ? datos.reportes :
        [...previos, ...datos.reportes.filter((nuevo) =>
          !previos.some((previo) => previo.id_reporte === nuevo.id_reporte))]);
      setPagina(siguiente); setTotal(datos.total); setError('');
    } catch (_) {
      if (actual === version.current) setError('No se pudieron consultar los reportes.');
    } finally {
      if (actual === version.current) {
        pendiente.current = false;
        setCargando(false); setActualizando(false); setCargandoMas(false);
      }
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void cargar(1);
    return () => { version.current += 1; pendiente.current = false; };
  }, [cargar]));

  const encabezado = <View>
    <View style={s.header}>
      <Ionicons name="construct-outline" size={35} color="#23558C" />
      <Text style={s.titulo}>Mis reportes</Text>
      <Text style={s.subtitulo}>Consulta tus solicitudes de mantenimiento.</Text>
    </View>
    <TouchableOpacity style={s.boton} onPress={() => navigation.navigate('NuevoReporte',
      { token, idInquilino })} accessibilityRole="button">
      <Text style={s.botonTexto}>Crear nuevo reporte</Text>
    </TouchableOpacity>
    <TouchableOpacity style={s.boton} onPress={() => navigation.navigate('BorradoresReporte',
      { token, idInquilino })} accessibilityRole="button">
      <Text style={s.botonTexto}>Ver borradores guardados</Text>
    </TouchableOpacity>
    {error && <TouchableOpacity style={s.tarjeta} onPress={() => void cargar(1)}>
      <Text style={s.error}>{error} Pulsa para reintentar.</Text>
    </TouchableOpacity>}
  </View>;

  const renderizar = ({ item: reporte }) => {
    const fotos = reporte.fotos || [];
    const citas = reporte.citas || [];
    const cita = citas.find((c) => ['programada', 'confirmada'].includes(c.estado)) || citas[0];
    return <View style={s.tarjeta}>
      <View style={s.fila}>
        <Text style={s.tituloReporte}>{reporte.titulo}</Text>
        <Text style={s.estado}>{reporte.estado}</Text>
      </View>
      <Text style={s.descripcion}>{reporte.descripcion || 'Sin descripción'}</Text>
      <Text style={s.detalle}>Categoría: {reporte.categoria || 'General'}</Text>
      <Text style={s.detalle}>Prioridad: {reporte.prioridad || 'No asignada'}</Text>
      <Text style={s.detalle}>Fecha: {fechaVisible(reporte.fecha_reporte)}</Text>
      <Text style={s.seccion}>Fotografías del reporte</Text>
      {fotos.length && process.env.EXPO_PUBLIC_VLCLIENT_TEST_MODE === '1' ?
        <Text style={s.detalle}>Fotografías remotas deshabilitadas en pruebas.</Text> :
      fotos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {fotos.map((foto) => <Image key={foto.id_foto}
          source={{ uri: foto.url_miniatura || foto.url_foto }}
          onLoadStart={() => { fotoTiempos.current[foto.id_foto] = Date.now(); }}
          onLoadEnd={() => {
            if (__DEV__ && fotoTiempos.current[foto.id_foto]) {
              console.info('Rendimiento miniatura',
                Date.now() - fotoTiempos.current[foto.id_foto], 'ms');
            }
            delete fotoTiempos.current[foto.id_foto];
          }}
          style={s.foto} resizeMode="cover" />)}
      </ScrollView> : <Text style={s.detalle}>Sin fotografías.</Text>}
      <Text style={s.seccion}>Cita de mantenimiento</Text>
      {cita ? <View style={s.cita}>
        <Text style={s.detalle}>Fecha: {fechaVisible(cita.fecha_cita)}</Text>
        <Text style={s.detalle}>Hora: {cita.hora_cita}</Text>
        <Text style={s.detalle}>Estado: {cita.estado === 'programada'
          ? 'Pendiente de confirmación' : cita.estado}</Text>
        {!!cita.observaciones && <Text style={s.detalle}>
          Observaciones: {cita.observaciones}</Text>}
      </View> : <Text style={s.detalle}>Este reporte aún no tiene una cita.</Text>}
    </View>;
  };

  return <SafeAreaView style={s.pantalla} edges={['bottom']}>
    <FlatList data={reportes} keyExtractor={(item) => String(item.id_reporte)}
      renderItem={renderizar} contentContainerStyle={s.contenido}
      ListHeaderComponent={encabezado}
      ListEmptyComponent={cargando ? <ActivityIndicator color="#23558C" /> :
        !error ? <Text style={s.vacio}>No tienes reportes registrados.</Text> : null}
      ListFooterComponent={cargandoMas ? <ActivityIndicator color="#23558C" /> : null}
      refreshing={actualizando} onRefresh={() => void cargar(1)}
      onEndReachedThreshold={0.4} onEndReached={() => {
        if (!pendiente.current && reportes.length < total) void cargar(pagina + 1);
      }} />
  </SafeAreaView>;
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F5F7FA' },
  contenido: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  titulo: { fontSize: 23, fontWeight: 'bold', color: '#1E293B', marginTop: 10 },
  subtitulo: { fontSize: 13, color: '#64748B', marginTop: 7, textAlign: 'center' },
  boton: { backgroundColor: '#23558C', borderRadius: 13, padding: 16,
    alignItems: 'center', marginBottom: 12 },
  botonTexto: { color: '#FFFFFF', fontWeight: 'bold' },
  tarjeta: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginBottom: 14 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  tituloReporte: { color: '#1E293B', fontSize: 15, fontWeight: 'bold', flex: 1 },
  estado: { color: '#D97706', fontSize: 12, fontWeight: 'bold' },
  descripcion: { color: '#64748B', marginVertical: 12 },
  detalle: { color: '#475569', fontSize: 12, marginBottom: 5 },
  seccion: { color: '#23558C', fontWeight: 'bold', marginTop: 16, marginBottom: 10 },
  foto: { width: 145, height: 115, borderRadius: 10, marginRight: 10,
    backgroundColor: '#E2E8F0' },
  cita: { backgroundColor: '#EAF2F9', borderRadius: 10, padding: 14 },
  error: { color: '#B91C1C' },
  vacio: { textAlign: 'center', color: '#64748B', marginTop: 25 },
});
