import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { obtenerResumenAdmin, obtenerInquilinosAdmin,
  obtenerDetalleInquilinoAdmin, obtenerCitasAdmin, ejecutarAccionCitaAdmin,
  consultarDisponibilidad, cambiarFechaAdmin, cambiarHorarioAdmin,
  obtenerPerfilAdmin, buscarPropiedadesAdmin, registrarInquilinoAdmin } from '../services/api';
import { evaluarPassword } from '../services/passwordPolicy';
import { validarRegistroInquilino } from '../services/validarRegistroInquilino';
import { SelectorInquilino, SelectorOpciones } from './SelectorFiltrosCitas';
import { contarFiltrosActivos, parametrosCitas } from './filtrosCitas';
import { fuenteGaleria } from './fuenteGaleria';
import SelectorHorarioAdmin from './SelectorHorarioAdmin';
import { horarioHabilitado } from './horariosAdmin';

const Boton = ({ texto, onPress, disabled, secundario = false, icono }) =>
  <TouchableOpacity style={[s.boton, secundario && s.secundario,
    disabled && s.desactivado]} onPress={onPress} disabled={disabled}
    accessibilityRole="button" accessibilityLabel={texto}>
    {icono && <Ionicons name={icono} size={17}
      color={secundario ? '#23558C' : '#FFFFFF'} style={{ marginRight: 7 }} />}
    <Text style={[s.botonTexto, secundario && s.textoSecundario]}>{texto}</Text>
  </TouchableOpacity>;
const Contenedor = ({ children }) =>
  <SafeAreaView style={s.pantalla} edges={['bottom']}>{children}</SafeAreaView>;
const fechaSQL = (fecha) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1)
  .padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
const mesSQL = (fecha) => fechaSQL(fecha).slice(0, 7);
const PRUEBAS = process.env.EXPO_PUBLIC_VLCLIENT_TEST_MODE === '1';
const imagenesLocales = [require('../../assets/images/galeria-prueba-1.png'),
  require('../../assets/images/galeria-prueba-2.png')];
const coloresEstado = { programada: '#B45309', confirmada: '#166534',
  completada: '#23558C', cancelada: '#B91C1C', pendiente: '#B45309',
  activo: '#166534', inactivo: '#B91C1C', vencido: '#B91C1C',
  pagado: '#166534' };
const Estado = ({ valor }) => <Text style={[s.estado,
  { color: coloresEstado[valor] || '#475569' }]}>{valor || 'Sin estado'}</Text>;

function GaleriaReporte({ reporte }) {
  const [indice, setIndice] = useState(null);
  const [errores, setErrores] = useState({});
  const { width, height } = useWindowDimensions();
  const fotos = Array.isArray(reporte.fotos) ? reporte.fotos : [];
  const fuente = (foto, miniatura = false, posicion = 0) =>
    fuenteGaleria(foto, miniatura, posicion, PRUEBAS, imagenesLocales);
  return <>
    <Text style={s.etiqueta}>{fotos.length} fotografía(s) adjunta(s)</Text>
    {fotos.length === 0 ? <Text style={s.vacio}>Este reporte no tiene fotografías.</Text> :
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.galeria} accessibilityLabel="Fotografías del reporte">
        {fotos.map((foto, posicion) => <TouchableOpacity
          key={foto.id_foto || `${reporte.id_reporte}-${posicion}`}
          onPress={() => setIndice(posicion)} accessibilityRole="button"
          accessibilityLabel={`Ampliar fotografía ${posicion + 1} de ${fotos.length}`}>
          {errores[posicion] ? <View style={[s.foto, s.fotoError]}>
            <Ionicons name="image-outline" size={25} color="#64748B" />
            <Text style={s.errorImagen}>No disponible</Text>
          </View> : <Image source={fuente(foto, true, posicion)} style={s.foto}
            onError={() => setErrores((actual) => ({ ...actual,
              [posicion]: true }))} />}
        </TouchableOpacity>)}
      </ScrollView>}
    {PRUEBAS && fotos.length > 0 &&
      <Text style={s.etiqueta}>Imágenes locales de prueba; no son fotografías de producción.</Text>}
    <Modal visible={indice !== null} transparent animationType="fade"
      onRequestClose={() => setIndice(null)}>
      <View style={s.modalFondo}>
        <Boton texto="Cerrar galería" icono="close-outline" secundario
          onPress={() => setIndice(null)} />
        {indice !== null && fotos[indice] && <>
          <Text style={s.modalTitulo}>Reporte #{reporte.id_reporte} ·
            {indice + 1} de {fotos.length}</Text>
          {errores[indice] ? <Text style={s.modalTitulo}>Imagen no disponible</Text> :
            <Image source={fuente(fotos[indice], false, indice)}
              style={{ width: Math.min(width - 32, 700),
                height: Math.min(height * 0.52, 380) }}
              resizeMode="contain" onError={() => setErrores((actual) =>
                ({ ...actual, [indice]: true }))} />}
          {PRUEBAS && <Text style={s.modalTitulo}>Imagen local de prueba</Text>}
          <View style={s.fila}>
            <Boton texto="Anterior" secundario icono="chevron-back-outline"
              disabled={indice === 0} onPress={() => setIndice(indice - 1)} />
            <Boton texto="Siguiente" secundario icono="chevron-forward-outline"
              disabled={indice === fotos.length - 1}
              onPress={() => setIndice(indice + 1)} />
          </View>
        </>}
      </View>
    </Modal>
  </>;
}

export function AdminInicio({ navigation, token }) {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let activo = true;
    obtenerResumenAdmin(token).then((datos) => { if (activo) {
      setResumen(datos); setError('');
    } })
      .catch(() => { if (activo) setError('No se pudo cargar el resumen.'); });
    return () => { activo = false; };
  }, [token]));
  const indicadores = [
    ['Inquilinos registrados', 'inquilinos_total', 'people-outline'],
    ['Activos', 'inquilinos_activos', 'person-circle-outline'],
    ['Inactivos', 'inquilinos_inactivos', 'person-remove-outline'],
    ['Propiedades con contrato activo', 'propiedades_contrato_activo', 'home-outline'],
    ['Reportes pendientes', 'reportes_pendientes', 'construct-outline'],
    ['Citas pendientes', 'citas_pendientes', 'calendar-outline'],
    ['Citas confirmadas', 'citas_confirmadas', 'checkmark-circle-outline'],
    ['Citas próximas (7 días)', 'citas_proximas', 'time-outline'],
    ['Solicitudes de reagendamiento', 'solicitudes_reagendamiento', 'refresh-outline'],
  ];
  return <Contenedor><ScrollView contentContainerStyle={s.contenido}>
    <Image source={require('../../assets/images/logo-viveslara-notexto.png')}
      style={s.logo} resizeMode="contain" />
    <Text style={s.titulo}>Panel administrativo</Text>
    <Text style={s.introduccion}>Resumen de la operación de Vives Lara</Text>
    {error ? <Text style={s.error}>{error}</Text> : !resumen ?
      <ActivityIndicator color="#23558C" /> : <View style={s.cuadricula}>
      {indicadores.map(([titulo, campo, icono]) =>
        <View key={campo} style={s.indicador}>
          <Ionicons name={icono} size={23} color="#23558C" />
          <Text style={s.valor}>{resumen[campo] ?? 0}</Text>
          <Text style={s.etiqueta}>{titulo}</Text>
        </View>)}
      </View>}
    <Boton texto="Ver citas" icono="calendar-outline"
      onPress={() => navigation.navigate('CitasAdmin')} />
    <Boton texto="Ver inquilinos" onPress={() => navigation.navigate('InquilinosAdmin')}
      icono="people-outline" secundario />
  </ScrollView></Contenedor>;
}

export function AdminInquilinos({ navigation, token }) {
  const [datos, setDatos] = useState({ inquilinos: [], total: 0 });
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setDatos(await obtenerInquilinosAdmin(token, {
      buscar: buscar.trim(), estado, pagina: String(pagina), limite: '20',
    })); } catch (_) { setError('No se pudieron consultar los inquilinos.'); }
    finally { setCargando(false); }
  }, [token, buscar, estado, pagina]);
  useFocusEffect(useCallback(() => {
    const temporizador = setTimeout(() => { void cargar(); }, 300);
    return () => clearTimeout(temporizador);
  }, [cargar]));
  return <Contenedor>
    <View style={s.filtros}>
      <TextInput style={s.input} value={buscar} onChangeText={(valor) => {
        setBuscar(valor); setPagina(1);
      }} placeholder="Buscar nombre o correo" autoCapitalize="none" />
      <View style={s.fila}>{['todos', 'activos', 'inactivos'].map((opcion) =>
        <Boton key={opcion} texto={opcion} secundario={estado !== opcion}
          onPress={() => { setEstado(opcion); setPagina(1); }} />)}</View>
    </View>
    {error ? <Text style={s.error}>{error}</Text> : null}
    {cargando ? <ActivityIndicator color="#23558C" /> :
      <FlatList data={datos.inquilinos} keyExtractor={(item) => String(item.id_inquilino)}
        contentContainerStyle={s.contenido}
        ListEmptyComponent={<Text style={s.vacio}>No hay inquilinos para estos filtros.</Text>}
        renderItem={({ item }) => <TouchableOpacity style={s.tarjeta}
          accessibilityRole="button" accessibilityLabel={`Ver a ${item.nombre} ${item.apellido}`}
          onPress={() => navigation.navigate('DetalleInquilinoAdmin',
            { idInquilino: item.id_inquilino })}>
          <Text style={s.subtitulo}>{item.nombre} {item.apellido}</Text>
          <Text>{item.correo}</Text>
          <Estado valor={item.activo ? 'activo' : 'inactivo'} />
          <Text>{item.propiedad || 'Sin propiedad'}</Text>
          <Text>Contrato: {item.estado_contrato || 'Sin contrato'} ·
            {item.fecha_inicio || '—'}</Text>
        </TouchableOpacity>} />}
    <View style={s.fila}>
      <Boton texto="Anterior" disabled={pagina <= 1} secundario
        onPress={() => setPagina(pagina - 1)} />
      <Text style={s.pagina}>{pagina} / {Math.max(1, Math.ceil(datos.total / 20))}</Text>
      <Boton texto="Siguiente" disabled={pagina * 20 >= datos.total} secundario
        onPress={() => setPagina(pagina + 1)} />
    </View>
  </Contenedor>;
}

export function AdminDetalleInquilino({ route, token }) {
  const id = route.params?.idInquilino;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let activo = true;
    obtenerDetalleInquilinoAdmin(token, id)
      .then((resultado) => { if (activo) setDatos(resultado); })
      .catch(() => { if (activo) setError('No se pudo consultar el detalle.'); });
    return () => { activo = false; };
  }, [token, id]));
  return <Contenedor><ScrollView contentContainerStyle={s.contenido}>
    {error ? <Text style={s.error}>{error}</Text> : !datos ?
      <ActivityIndicator color="#23558C" /> : <>
      <Text style={s.titulo}>{datos.inquilino.nombre} {datos.inquilino.apellido}</Text>
      <View style={s.tarjeta}><Text>{datos.inquilino.correo}</Text>
        <Text>{datos.inquilino.telefono || 'Sin teléfono'}</Text>
        <Estado valor={datos.inquilino.activo ? 'activo' : 'inactivo'} /></View>
      <Text style={s.subtitulo}>Propiedad y contratos</Text>
      {datos.contratos.map((c) => <View style={s.tarjeta} key={c.id_contrato}>
        <Text>{c.propiedad} · {c.direccion}</Text>
        <Estado valor={c.estado} /><Text>{c.fecha_inicio} a {c.fecha_fin}</Text>
      </View>)}
      <Text style={s.subtitulo}>Estados de cuenta</Text>
      {datos.estados_cuenta.map((e) => <View style={s.tarjeta} key={e.id_estado_cuenta}>
        <Text>{e.mes} · vence {String(e.fecha_limite).slice(0, 10)}</Text>
        <Estado valor={e.estado} />
        <Text>Total: ${e.total} · Pagado: ${e.total_pagado} · Saldo: ${e.saldo}</Text>
      </View>)}
      <Text style={s.subtitulo}>Reportes</Text>
      {datos.reportes.map((r) => <View style={s.tarjeta} key={r.id_reporte}>
        <Text style={s.subtitulo}>#{r.id_reporte} {r.titulo}</Text>
        <Estado valor={r.estado} />
        <Text>{r.descripcion}</Text>
        <GaleriaReporte reporte={r} />
      </View>)}
      <Text style={s.subtitulo}>Citas</Text>
      {datos.citas.map((c) => <View style={s.tarjeta} key={c.id_cita}>
        <Text>#{c.id_cita} · {c.fecha_cita} {c.hora_cita}</Text>
        <Estado valor={c.estado} />
        <Text>Reagendado: {c.reagendado_estado}</Text>
      </View>)}
    </>}
  </ScrollView></Contenedor>;
}

export function AdminCalendario({ token }) {
  const [fecha, setFecha] = useState(new Date());
  const [calendario, setCalendario] = useState(false);
  const [horarios, setHorarios] = useState([]);
  const [hora, setHora] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const dia = fechaSQL(fecha);
  const cargar = useCallback(async () => {
    try { setHorarios(await consultarDisponibilidad(token, { fecha: dia }, true));
      setError(''); } catch (_) { setError('No se pudo consultar la disponibilidad.'); }
  }, [token, dia]);
  useFocusEffect(useCallback(() => {
    const temporizador = setTimeout(() => { void cargar(); }, 300);
    return () => clearTimeout(temporizador);
  }, [cargar]));
  const ejecutar = async (accion) => {
    if (ocupado) return;
    setOcupado(true);
    try { await accion(); await cargar();
      Alert.alert('Disponibilidad actualizada'); }
    catch (e) { Alert.alert('No se pudo actualizar', e.message); }
    finally { setOcupado(false); }
  };
  return <Contenedor><ScrollView contentContainerStyle={s.contenido}>
    <Text style={s.titulo}>Calendario y disponibilidad</Text>
    <Text style={s.etiqueta}>Mes: {mesSQL(fecha)} · Fecha: {dia}</Text>
    <Boton texto="Elegir fecha" onPress={() => setCalendario(true)} />
    {calendario && <DateTimePicker value={fecha} mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'default'}
      minimumDate={new Date()} onChange={(evento, seleccion) => {
        if (Platform.OS === 'android') setCalendario(false);
        if (evento.type !== 'dismissed' && seleccion) setFecha(seleccion);
      }} />}
    {Platform.OS === 'ios' && calendario && <Boton texto="Listo" secundario
      onPress={() => setCalendario(false)} />}
    <View style={s.fila}>
      <Boton texto="Habilitar fecha" disabled={ocupado}
        onPress={() => ejecutar(() => cambiarFechaAdmin(token, dia, true))} />
      <Boton texto="Deshabilitar fecha" disabled={ocupado} secundario
        onPress={() => ejecutar(() => cambiarFechaAdmin(token, dia, false))} />
    </View>
    <Text style={s.subtitulo}>Horarios</Text>
    {error ? <Text style={s.error}>{error}</Text> : null}
    {horarios.map((h) => <View key={h.hora} style={s.tarjeta}>
      <Text style={s.subtitulo}>{h.hora}</Text>
      <Estado valor={h.ocupado ? 'Ocupado' :
        h.disponible ? 'Disponible' : 'No disponible'} />
      {h.ocupado && <Text>Cita #{h.id_cita} · {h.estado_cita} ·
        {h.nombre_inquilino} {h.apellido_inquilino}</Text>}
      <Text>{h.ocupado ? 'No se puede deshabilitar una reserva activa.' : ''}</Text>
      <Boton texto={h.horario_habilitado ? 'Deshabilitar' : 'Habilitar'}
        disabled={ocupado || h.ocupado}
        onPress={() => ejecutar(() => cambiarHorarioAdmin(token, dia, h.hora,
          !h.horario_habilitado))} />
    </View>)}
    <Text style={s.etiqueta}>Habilitar horario entre 08:00 y 18:00</Text>
    <SelectorHorarioAdmin valor={hora} horarios={horarios}
      onChange={setHora} disabled={ocupado} />
    {hora && horarioHabilitado(horarios, hora) &&
      <Text style={s.etiqueta}>Este horario ya está habilitado para la fecha.</Text>}
    <Boton texto="Habilitar horario" disabled={ocupado || !hora ||
      horarioHabilitado(horarios, hora)}
      onPress={() => ejecutar(async () => {
        await cambiarHorarioAdmin(token, dia, hora, true);
        setHora('');
      })} />
  </ScrollView></Contenedor>;
}

export function AdminCitas({ token }) {
  const [datos, setDatos] = useState({ citas: [], total: 0 });
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState('');
  const [inquilino, setInquilino] = useState('');
  const [inquilinoSeleccionado, setInquilinoSeleccionado] = useState(null);
  const [revisionInquilinos, setRevisionInquilinos] = useState(0);
  const [propiedad, setPropiedad] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [reagendado, setReagendado] = useState('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState('');
  const solicitudRef = useRef(0);
  useFocusEffect(useCallback(() => {
    setRevisionInquilinos((actual) => actual + 1);
  }, []));
  const filtros = { estado, id_inquilino: inquilino, id_propiedad: propiedad,
    fecha: fechaFiltro, reagendado_estado: reagendado };
  const activos = contarFiltrosActivos(filtros);
  const limpiarFiltros = () => {
    setEstado(''); setInquilino(''); setInquilinoSeleccionado(null);
    setPropiedad(''); setFechaFiltro(''); setReagendado(''); setPagina(1);
  };
  const cargar = useCallback(async () => {
    const solicitud = ++solicitudRef.current;
    try {
      const resultado = await obtenerCitasAdmin(token, parametrosCitas({
        estado, id_inquilino: inquilino, id_propiedad: propiedad,
        fecha: fechaFiltro, reagendado_estado: reagendado,
      }, pagina));
      if (solicitud === solicitudRef.current) {
        setDatos(resultado); setError('');
      }
    } catch (_) {
      if (solicitud === solicitudRef.current) {
        setError('No se pudieron consultar las citas.');
      }
    }
  }, [token, pagina, estado, inquilino, propiedad, fechaFiltro, reagendado]);
  useFocusEffect(useCallback(() => {
    const temporizador = setTimeout(() => { void cargar(); }, 300);
    return () => { clearTimeout(temporizador); solicitudRef.current++; };
  }, [cargar]));
  const accion = (cita, nombre) => Alert.alert('Confirmar acción',
    `¿Deseas ${nombre.replaceAll('-', ' ')} la cita #${cita.id_cita}?`, [
      { text: 'Cancelar' }, { text: 'Confirmar', onPress: async () => {
        if (ocupado) return;
        setOcupado(cita.id_cita);
        try { await ejecutarAccionCitaAdmin(token, cita.id_cita, nombre);
          await cargar(); Alert.alert('Cita actualizada'); }
        catch (e) { Alert.alert('No se pudo actualizar', e.message); }
        finally { setOcupado(null); }
      } },
    ]);
  return <Contenedor>
    <View style={s.filtros}>
      <TouchableOpacity style={s.encabezadoFiltros}
        onPress={() => setFiltrosAbiertos(!filtrosAbiertos)}
        accessibilityRole="button" accessibilityState={{ expanded: filtrosAbiertos }}
        accessibilityLabel={`Filtros de citas, ${activos} activos`}>
        <Ionicons name="options-outline" size={20} color="#23558C" />
        <Text style={s.filtrosTitulo}>Filtros{activos ? ` · ${activos} activos` : ''}</Text>
        <Ionicons name={filtrosAbiertos ? 'chevron-up-outline' :
          'chevron-down-outline'} size={20} color="#23558C" />
      </TouchableOpacity>
      <View style={{ display: filtrosAbiertos ? 'flex' : 'none' }}>
      <SelectorInquilino token={token} revision={revisionInquilinos}
        valor={inquilino}
        seleccionado={inquilinoSeleccionado}
        onChange={(id, item) => { setInquilino(id);
          setInquilinoSeleccionado(item); setPagina(1); }} />
      <Text style={s.etiqueta}>Propiedad</Text>
      <TextInput style={s.input} placeholder="ID de propiedad" value={propiedad}
        keyboardType="number-pad" onChangeText={(v) => { setPropiedad(v); setPagina(1); }} />
      <Text style={s.etiqueta}>Fecha de la cita</Text>
      <TextInput style={s.input} placeholder="Fecha AAAA-MM-DD" value={fechaFiltro}
        onChangeText={(v) => { setFechaFiltro(v); setPagina(1); }} />
      <SelectorOpciones etiqueta="Estado de la cita" valor={estado}
        opciones={[
          { valor: '', texto: 'Todos los estados' },
          { valor: 'programada', texto: 'Programada' },
          { valor: 'confirmada', texto: 'Confirmada' },
          { valor: 'completada', texto: 'Completada' },
          { valor: 'cancelada', texto: 'Cancelada' },
        ]} onChange={(valor) => { setEstado(valor); setPagina(1); }} />
      <SelectorOpciones etiqueta="Reagendamiento" valor={reagendado}
        opciones={[
          { valor: '', texto: 'Todos los reagendamientos' },
          { valor: 'sin_solicitud', texto: 'Sin solicitud' },
          { valor: 'solicitado', texto: 'Solicitado' },
          { valor: 'utilizado', texto: 'Utilizado' },
        ]} onChange={(valor) => { setReagendado(valor); setPagina(1); }} />
      <Boton texto="Limpiar filtros" icono="close-circle-outline" secundario
        onPress={limpiarFiltros} />
      </View>
    </View>
    {error ? <Text style={s.error}>{error}</Text> : null}
    <FlatList data={datos.citas} keyExtractor={(c) => String(c.id_cita)}
      contentContainerStyle={s.contenido} onRefresh={cargar}
      refreshing={false}
      ListEmptyComponent={<Text style={s.vacio}>Sin citas para estos filtros.</Text>}
      renderItem={({ item }) => <View style={s.tarjeta}>
        <Text style={s.subtitulo}>Cita #{item.id_cita}</Text><Estado valor={item.estado} />
        <Text>{item.nombre} {item.apellido} · {item.propiedad}</Text>
        <Text>{item.fecha_cita} a las {item.hora_cita}</Text>
        <Text>Reagendado: {item.reagendado_estado}</Text>
        {item.estado === 'programada' &&
          item.reagendado_estado !== 'solicitado' &&
          !item.segundo_horario_no_disponible_at &&
          <Boton texto="Confirmar cita" disabled={Boolean(ocupado)}
            onPress={() => accion(item, 'confirmar')} />}
        {['programada', 'confirmada'].includes(item.estado) &&
          item.reagendado_estado === 'sin_solicitud' &&
          <Boton texto="Solicitar reagendamiento" secundario disabled={Boolean(ocupado)}
            onPress={() => accion(item, 'solicitar-reagendado')} />}
        {item.estado === 'programada' && item.reagendado_estado === 'utilizado' &&
          !item.segundo_horario_no_disponible_at &&
          <Boton texto="Segundo horario no disponible" secundario
            disabled={Boolean(ocupado)}
            onPress={() => accion(item, 'segundo-horario-no-disponible')} />}
      </View>} />
    <View style={s.fila}><Boton texto="Anterior" secundario disabled={pagina <= 1}
      onPress={() => setPagina(pagina - 1)} />
      <Text style={s.pagina}>{pagina}</Text>
      <Boton texto="Siguiente" secundario disabled={pagina * 20 >= datos.total}
        onPress={() => setPagina(pagina + 1)} /></View>
  </Contenedor>;
}

export function AdminRegistro({ token }) {
  const [campos, setCampos] = useState({ nombre: '', apellido: '', correo: '',
    telefono: '', password: '', confirmacion: '', fecha_inicio: '',
    fecha_fin: '', renta: '' });
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirmacion, setVerConfirmacion] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [propiedades, setPropiedades] = useState([]);
  const [propiedad, setPropiedad] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (nombre, valor) => setCampos((actual) => ({ ...actual, [nombre]: valor }));
  const requisitos = evaluarPassword(campos.password).requisitos;
  const buscar = async () => {
    try { setPropiedades(await buscarPropiedadesAdmin(token, busqueda.trim()));
      setError(''); } catch (_) { setError('No se pudieron buscar propiedades.'); }
  };
  useFocusEffect(useCallback(() => {
    let activo = true;
    buscarPropiedadesAdmin(token, '').then((lista) => {
      if (activo) setPropiedades(lista);
    }).catch(() => { if (activo) setError('No se pudieron consultar las propiedades.'); });
    return () => { activo = false; };
  }, [token]));
  const guardar = async () => {
    if (guardando) return;
    if (!validarRegistroInquilino(campos, propiedad)) {
      setError('Revisa los datos, fechas, importe (máximo 9999999999.99), propiedad y contraseña.');
      return;
    }
    setGuardando(true); setError('');
    try {
      const resultado = await registrarInquilinoAdmin(token, {
        nombre: campos.nombre, apellido: campos.apellido, correo: campos.correo,
        telefono: campos.telefono, password: campos.password,
        confirmacion: campos.confirmacion,
        id_propiedad: propiedad.id_propiedad,
        fecha_inicio: campos.fecha_inicio, fecha_fin: campos.fecha_fin,
        renta_acordada: campos.renta,
      });
      Alert.alert('Registro completado',
        `Inquilino #${resultado.inquilino.id_inquilino} y contrato #${resultado.contrato.id_contrato} creados.`);
      setCampos({ nombre: '', apellido: '', correo: '', telefono: '',
        password: '', confirmacion: '', fecha_inicio: '', fecha_fin: '', renta: '' });
      setPropiedad(null);
      try { setPropiedades(await buscarPropiedadesAdmin(token, busqueda.trim())); }
      catch (_) { setPropiedades([]); }
    } catch (fallo) {
      setError(fallo.message || 'No se pudo completar el registro.');
    } finally { setGuardando(false); }
  };
  const campo = (nombre, etiqueta, opciones = {}) => <View key={nombre}>
    <Text style={s.etiqueta}>{etiqueta}</Text>
    <TextInput style={s.input} value={campos[nombre]}
      onChangeText={(valor) => cambiar(nombre, valor)} {...opciones} />
  </View>;
  return <Contenedor><ScrollView contentContainerStyle={s.contenido}>
    <Text style={s.titulo}>Registrar inquilino</Text>
    <Text style={s.aviso}>Selecciona una propiedad disponible. El contrato y el
      inquilino se guardarán juntos cuando el servidor confirme la operación.</Text>
    <Text style={s.seccion}>Datos del inquilino</Text>
    {campo('nombre', 'Nombre', { maxLength: 100 })}
    {campo('apellido', 'Apellidos', { maxLength: 150 })}
    {campo('correo', 'Correo electrónico', { keyboardType: 'email-address',
      autoCapitalize: 'none', maxLength: 150 })}
    {campo('telefono', 'Teléfono', { keyboardType: 'phone-pad', maxLength: 20 })}
    <Text style={s.etiqueta}>Contraseña</Text>
    <TextInput style={s.input} value={campos.password}
      onChangeText={(valor) => cambiar('password', valor)}
      secureTextEntry={!verPassword} autoCapitalize="none" />
    <Boton texto={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      secundario onPress={() => setVerPassword(!verPassword)} />
    <Text style={s.etiqueta}>Confirmar contraseña</Text>
    <TextInput style={s.input} value={campos.confirmacion}
      onChangeText={(valor) => cambiar('confirmacion', valor)}
      secureTextEntry={!verConfirmacion} autoCapitalize="none" />
    <Boton texto={verConfirmacion ? 'Ocultar confirmación' : 'Mostrar confirmación'}
      secundario onPress={() => setVerConfirmacion(!verConfirmacion)} />
    {[
      ['longitud', 'Al menos 8 caracteres'], ['mayuscula', 'Una letra mayúscula'],
      ['numero', 'Un número'], ['especial', 'Símbolo permitido: ! @ # $ % & * _ - + = ? . :'],
      ['caracteres', 'Solo letras sin acentos, números y símbolos permitidos'],
      ['bytes', 'Máximo 72 bytes'],
    ].map(([clave, texto]) => <Text key={clave}
      style={{ color: requisitos[clave] ? '#166534' : '#B91C1C' }}>
      {requisitos[clave] ? '✓' : '○'} {texto}</Text>)}
    <Text style={{ color: campos.confirmacion && campos.confirmacion === campos.password
      ? '#166534' : '#B91C1C' }}>
      {campos.confirmacion === campos.password && campos.confirmacion
        ? '✓ Las contraseñas coinciden' : '○ Las contraseñas deben coincidir'}
    </Text>
    <Text style={s.seccion}>Propiedad y contrato</Text>
    <TextInput style={s.input} value={busqueda} onChangeText={setBusqueda}
      placeholder="Buscar propiedad o dirección" />
    <Boton texto="Buscar propiedades" onPress={buscar} secundario />
    {error ? <Text style={s.error}>{error}</Text> : null}
    {!propiedades.some((p) => p.disponible) &&
      <Text style={s.etiqueta}>No hay propiedades disponibles.</Text>}
    {propiedades.map((p) => <TouchableOpacity key={p.id_propiedad}
      style={s.tarjeta} disabled={!p.disponible}
      onPress={() => { setPropiedad(p); cambiar('renta', String(p.renta_mensual)); }}>
      <Text style={s.subtitulo}>{p.nombre}</Text><Text>{p.direccion}</Text>
      <Estado valor={p.disponible ? 'Disponible' :
        p.estado === 'mantenimiento' ? 'En mantenimiento' : 'Ocupada'} />
    </TouchableOpacity>)}
    {propiedad && <Text style={s.etiqueta}>Seleccionada: {propiedad.nombre}</Text>}
    {campo('fecha_inicio', 'Inicio del contrato (AAAA-MM-DD)', { maxLength: 10 })}
    {campo('fecha_fin', 'Fin del contrato (AAAA-MM-DD)', { maxLength: 10 })}
    {campo('renta', 'Importe de renta acordado',
      { keyboardType: 'decimal-pad', maxLength: 13 })}
    <Boton texto={guardando ? 'Guardando…' : 'Registrar inquilino y contrato'}
      disabled={guardando || !propiedad?.disponible} onPress={guardar} />
  </ScrollView></Contenedor>;
}

export function AdminPerfil({ token }) {
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let activo = true;
    obtenerPerfilAdmin(token).then((p) => { if (activo) setPerfil(p); })
      .catch(() => { if (activo) setError('No se pudo consultar el perfil.'); });
    return () => { activo = false; };
  }, [token]));
  return <Contenedor><View style={s.contenido}>
    <Text style={s.titulo}>Mi perfil</Text>
    {error ? <Text style={s.error}>{error}</Text> : !perfil ?
      <ActivityIndicator color="#23558C" /> : <View style={s.tarjeta}>
        <Ionicons name="person-circle-outline" size={48} color="#23558C" />
        <Text style={s.subtitulo}>{perfil.nombre} {perfil.apellido}</Text>
        <Text>{perfil.correo}</Text>
        <Text style={s.etiqueta}>Administración · Vives Lara</Text>
      </View>}
  </View></Contenedor>;
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#F3F7FB' },
  contenido: { padding: 20, paddingBottom: 40 },
  filtros: { padding: 20, paddingBottom: 8, backgroundColor: '#FFFFFF' },
  encabezadoFiltros: { minHeight: 50, flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingBottom: 8 },
  filtrosTitulo: { flex: 1, fontSize: 17, color: '#173D68', fontWeight: '700' },
  titulo: { fontSize: 25, fontWeight: '800', color: '#173D68', marginBottom: 10 },
  introduccion: { fontSize: 15, color: '#526579', marginBottom: 20 },
  seccion: { fontSize: 19, fontWeight: '700', color: '#173D68', marginTop: 20,
    marginBottom: 14 },
  subtitulo: { fontSize: 16, fontWeight: '700', color: '#23558C', marginBottom: 8 },
  etiqueta: { fontSize: 14, color: '#475569', marginBottom: 10 },
  valor: { fontSize: 28, fontWeight: 'bold', color: '#1E293B' },
  tarjeta: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16,
    marginBottom: 14, gap: 7, elevation: 2,
    shadowColor: '#173D68', shadowOpacity: 0.07,
    shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  indicador: { width: '48%', minHeight: 132, backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 16, marginBottom: 12, justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E2EAF2' },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    alignItems: 'center', marginVertical: 8 },
  boton: { backgroundColor: '#23558C', borderRadius: 11, paddingHorizontal: 15,
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: 4 },
  secundario: { backgroundColor: '#EAF2F9' },
  botonTexto: { color: '#FFFFFF', fontWeight: '700' },
  textoSecundario: { color: '#23558C' },
  desactivado: { opacity: 0.45 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 10, minHeight: 48, paddingHorizontal: 13, marginBottom: 12,
    color: '#1E293B' },
  pagina: { color: '#334155' },
  error: { color: '#B91C1C', padding: 14 },
  foto: { width: 90, height: 72, borderRadius: 8, marginRight: 8,
    backgroundColor: '#E2E8F0' },
  fotoError: { alignItems: 'center', justifyContent: 'center' },
  errorImagen: { fontSize: 11, color: '#475569' },
  galeria: { marginVertical: 8 },
  vacio: { color: '#64748B', backgroundColor: '#EAF2F9', padding: 18,
    borderRadius: 12, marginVertical: 12, textAlign: 'center' },
  estado: { fontSize: 13, fontWeight: '700', alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, overflow: 'hidden' },
  modalFondo: { flex: 1, backgroundColor: '#0C1B2B', alignItems: 'center',
    justifyContent: 'center', padding: 16 },
  modalTitulo: { color: '#FFFFFF', fontSize: 15, fontWeight: '700',
    textAlign: 'center', marginVertical: 14 },
  logo: { width: 64, height: 64, alignSelf: 'center', marginBottom: 10 },
  aviso: { backgroundColor: '#FEF3C7', color: '#92400E', padding: 14,
    borderRadius: 9, marginBottom: 18 },
});
