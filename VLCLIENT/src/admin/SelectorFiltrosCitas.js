import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { obtenerInquilinosAdmin } from '../services/api';
import { etiquetaInquilino, combinarInquilinos } from './filtrosCitas';

const TAMANO = 30;

export function SelectorOpciones({ etiqueta, valor, opciones, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const seleccionado = opciones.find((opcion) => opcion.valor === valor);
  return <View style={s.campo}>
    <Text style={s.etiqueta}>{etiqueta}</Text>
    <TouchableOpacity style={s.selector} onPress={() => setAbierto(true)}
      accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${seleccionado?.texto || ''}`}>
      <Text style={s.selectorTexto}>{seleccionado?.texto || 'Seleccionar'}</Text>
      <Ionicons name="chevron-down-outline" size={18} color="#23558C" />
    </TouchableOpacity>
    <Modal visible={abierto} transparent animationType="fade"
      onRequestClose={() => setAbierto(false)}>
      <View style={s.fondo}><View style={s.panel}>
        <Text style={s.titulo}>{etiqueta}</Text>
        {opciones.map((opcion) => <TouchableOpacity key={opcion.valor || 'todos'}
          style={s.opcion} accessibilityRole="button"
          accessibilityState={{ selected: opcion.valor === valor }}
          onPress={() => { onChange(opcion.valor); setAbierto(false); }}>
          <Text style={s.opcionTexto}>{opcion.texto}</Text>
          {opcion.valor === valor && <Ionicons name="checkmark" size={20}
            color="#23558C" />}
        </TouchableOpacity>)}
        <TouchableOpacity onPress={() => setAbierto(false)}
          style={s.cerrar} accessibilityRole="button">
          <Text style={s.cerrarTexto}>Cerrar</Text>
        </TouchableOpacity>
      </View></View>
    </Modal>
  </View>;
}

export function SelectorInquilino({ token, revision, valor, seleccionado, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [inquilinos, setInquilinos] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const cache = useRef(new Map());
  useEffect(() => {
    cache.current.clear(); setInquilinos([]); setTotal(0); setPagina(1);
  }, [token, revision]);
  useEffect(() => {
    if (!abierto) return undefined;
    let activo = true;
    const clave = `${buscar.trim().toLowerCase()}:${pagina}`;
    const cargar = async () => {
      setCargando(true); setError('');
      let pendiente;
      try {
        pendiente = cache.current.get(clave);
        if (!pendiente) {
          pendiente = obtenerInquilinosAdmin(token, { buscar: buscar.trim(),
            estado: 'todos', pagina: String(pagina), limite: String(TAMANO) });
          cache.current.set(clave, pendiente);
        }
        const datos = await pendiente;
        if (!activo) return;
        cache.current.set(clave, datos);
        setTotal(datos.total);
        setInquilinos((actual) => combinarInquilinos(actual,
          datos.inquilinos, pagina === 1));
      } catch (_) {
        if (cache.current.get(clave) === pendiente) cache.current.delete(clave);
        if (activo) setError('No se pudieron consultar los inquilinos.');
      } finally { if (activo) setCargando(false); }
    };
    const temporizador = setTimeout(() => { void cargar(); }, pagina === 1 ? 280 : 0);
    return () => { activo = false; clearTimeout(temporizador); };
  }, [abierto, buscar, pagina, token, intento]);
  const cambiarBusqueda = (texto) => {
    setBuscar(texto); setPagina(1); setInquilinos([]); setTotal(0);
  };
  const elegir = (item) => {
    onChange(item ? String(item.id_inquilino) : '', item || null);
    setAbierto(false);
  };
  return <View style={s.campo}>
    <Text style={s.etiqueta}>Inquilino</Text>
    <TouchableOpacity style={s.selector} onPress={() => setAbierto(true)}
      accessibilityRole="button" accessibilityLabel={valor && seleccionado ?
        `Inquilino: ${etiquetaInquilino(seleccionado)}` : 'Todos los inquilinos'}>
      <Text style={s.selectorTexto} numberOfLines={1}>{valor && seleccionado ?
        etiquetaInquilino(seleccionado) : 'Todos los inquilinos'}</Text>
      <Ionicons name="chevron-down-outline" size={18} color="#23558C" />
    </TouchableOpacity>
    <Modal visible={abierto} transparent animationType="slide"
      onRequestClose={() => setAbierto(false)}>
      <KeyboardAvoidingView style={s.fondo}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.panelGrande}>
        <Text style={s.titulo}>Seleccionar inquilino</Text>
        <TextInput style={s.buscar} value={buscar} onChangeText={cambiarBusqueda}
          placeholder="Buscar por nombre o apellido" autoCapitalize="words"
          maxLength={100}
          accessibilityLabel="Buscar inquilinos" />
        <TouchableOpacity style={s.opcion} onPress={() => elegir(null)}
          accessibilityRole="button">
          <Text style={s.opcionTexto}>Todos los inquilinos</Text>
        </TouchableOpacity>
        {error && <TouchableOpacity onPress={() => setIntento((n) => n + 1)}
          style={s.cerrar} accessibilityRole="button">
          <Text style={s.error}>{error} Toca para reintentar.</Text>
        </TouchableOpacity>}
        <FlatList data={inquilinos} keyExtractor={(item) => String(item.id_inquilino)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={!cargando && !error ?
            <Text style={s.vacio}>No se encontraron inquilinos.</Text> : null}
          renderItem={({ item }) => <TouchableOpacity style={s.opcion}
            onPress={() => elegir(item)} accessibilityRole="button"
            accessibilityLabel={etiquetaInquilino(item)}>
            <Text style={s.opcionTexto}>{item.nombre} {item.apellido}</Text>
            <Text style={s.secundario}>{item.propiedad || 'Sin propiedad'} ·
              #{item.id_inquilino}</Text>
          </TouchableOpacity>}
          ListFooterComponent={<>
            {cargando && <ActivityIndicator color="#23558C" />}
            {!cargando && inquilinos.length < total &&
              <TouchableOpacity style={s.cerrar} onPress={() => setPagina(pagina + 1)}
                accessibilityRole="button">
                <Text style={s.cerrarTexto}>Cargar más</Text>
              </TouchableOpacity>}
          </>} />
        <TouchableOpacity onPress={() => setAbierto(false)}
          style={s.cerrar} accessibilityRole="button">
          <Text style={s.cerrarTexto}>Cerrar</Text>
        </TouchableOpacity>
      </View></KeyboardAvoidingView>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  campo: { marginBottom: 12 },
  etiqueta: { color: '#475569', fontSize: 14, marginBottom: 7, fontWeight: '600' },
  selector: { minHeight: 48, backgroundColor: '#FFFFFF', borderColor: '#CBD5E1',
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between' },
  selectorTexto: { color: '#173D68', fontSize: 15, flex: 1, marginRight: 8 },
  fondo: { flex: 1, backgroundColor: '#10263DBB', justifyContent: 'center',
    padding: 18 },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18 },
  panelGrande: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    maxHeight: '82%', minHeight: 300 },
  titulo: { fontSize: 19, fontWeight: '700', color: '#173D68', marginBottom: 12 },
  opcion: { minHeight: 48, justifyContent: 'center', paddingVertical: 10,
    paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#EAF2F9' },
  opcionTexto: { color: '#173D68', fontSize: 15 },
  secundario: { color: '#64748B', fontSize: 13, marginTop: 3 },
  buscar: { minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 10, paddingHorizontal: 12, marginBottom: 8, color: '#173D68' },
  cerrar: { minHeight: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EAF2F9', borderRadius: 10, marginTop: 10 },
  cerrarTexto: { color: '#23558C', fontWeight: '700' },
  error: { color: '#B91C1C', padding: 10 },
  vacio: { color: '#64748B', padding: 16, textAlign: 'center' },
});
