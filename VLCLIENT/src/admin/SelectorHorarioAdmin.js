import React, { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generarHorarios, horarioHabilitado } from './horariosAdmin';

const opciones = generarHorarios();

export default function SelectorHorarioAdmin({ valor, horarios, onChange, disabled }) {
  const [abierto, setAbierto] = useState(false);
  return <View>
    <Text style={s.etiqueta}>Nuevo horario · intervalos de 30 minutos</Text>
    <TouchableOpacity style={s.selector} onPress={() => setAbierto(true)}
      disabled={disabled} accessibilityRole="button"
      accessibilityLabel={valor ? `Horario seleccionado: ${valor}` : 'Seleccionar horario'}>
      <Text style={s.valor}>{valor || 'Seleccionar hora (HH:mm)'}</Text>
      <Ionicons name="chevron-down-outline" size={20} color="#23558C" />
    </TouchableOpacity>
    <Modal visible={abierto} transparent animationType="fade"
      onRequestClose={() => setAbierto(false)}>
      <View style={s.fondo}>
        <View style={s.panel}>
          <Text style={s.titulo}>Selecciona una hora</Text>
          <FlatList data={opciones} keyExtractor={(hora) => hora}
            initialNumToRender={12}
            renderItem={({ item }) => {
              const existente = horarioHabilitado(horarios, item);
              return <TouchableOpacity style={s.opcion} disabled={existente}
                accessibilityRole="button"
                accessibilityState={{ disabled: existente, selected: valor === item }}
                accessibilityLabel={`${item}${existente ? ', ya habilitado' : ''}`}
                onPress={() => { onChange(item); setAbierto(false); }}>
                <Text style={[s.hora, existente && s.noDisponible]}>{item}</Text>
                {existente ? <Text style={s.noDisponible}>Ya habilitado</Text> :
                  valor === item ? <Ionicons name="checkmark" size={20}
                    color="#23558C" /> : null}
              </TouchableOpacity>;
            }} />
          <TouchableOpacity style={s.cerrar} onPress={() => setAbierto(false)}
            accessibilityRole="button" accessibilityLabel="Cerrar selector de horario">
            <Text style={s.cerrarTexto}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  etiqueta: { fontSize: 14, color: '#475569', marginBottom: 10 },
  selector: { minHeight: 48, backgroundColor: '#FFFFFF', borderWidth: 1,
    borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8 },
  valor: { color: '#173D68', fontSize: 15 },
  fondo: { flex: 1, backgroundColor: '#10263DBB', justifyContent: 'center',
    padding: 18 },
  panel: { maxHeight: '78%', backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 18 },
  titulo: { fontSize: 19, fontWeight: '700', color: '#173D68', marginBottom: 10 },
  opcion: { minHeight: 48, paddingHorizontal: 12, borderBottomWidth: 1,
    borderBottomColor: '#EAF2F9', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between' },
  hora: { color: '#173D68', fontSize: 16, fontWeight: '600' },
  noDisponible: { color: '#94A3B8', fontSize: 13 },
  cerrar: { minHeight: 48, borderRadius: 10, backgroundColor: '#EAF2F9',
    alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  cerrarTexto: { color: '#23558C', fontWeight: '700' },
});
