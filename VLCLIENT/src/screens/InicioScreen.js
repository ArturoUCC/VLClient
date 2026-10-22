
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function InicioScreen({ navigation }) {

  // Datos temporales para el prototipo del Sprint 1
  const inquilino = {
    nombre: 'Carlos Mendoza',
    cuota: 8500,
    vencimiento: '30 de octubre de 2026',
    estado: 'Pendiente',
  };

  const formatoMoneda = (cantidad) => {
    return '$' + cantidad.toLocaleString('es-MX');
  };

  const mostrarProximamente = (modulo) => {
    Alert.alert(
      modulo,
      'Este módulo se implementará en los siguientes sprints.'
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ENCABEZADO */}
        <View style={styles.header}>
          <View>
            <Text style={styles.saludo}>Bienvenido,</Text>
            <Text style={styles.nombre}>{inquilino.nombre}</Text>
          </View>

          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Perfil')}
          >
            <Text style={styles.avatarText}>CM</Text>
          </TouchableOpacity>
        </View>

        {/* TARJETA DE CUOTA */}
        <View style={styles.cuotaCard}>
          <Text style={styles.cuotaLabel}>Tu cuota de este mes</Text>

          <Text style={styles.cuotaMonto}>
            {formatoMoneda(inquilino.cuota)}
          </Text>

          <Text style={styles.cuotaFecha}>
            Pagar antes del {inquilino.vencimiento}
          </Text>

          <View style={styles.cuotaFooter}>
            <View style={styles.estadoBadge}>
              <Text style={styles.estadoText}>
                {inquilino.estado}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => mostrarProximamente('Estado de cuenta')}
            >
              <Text style={styles.verDetalle}>
                Ver detalle →
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ACCESOS RÁPIDOS */}
        <Text style={styles.sectionTitle}>Accesos rápidos</Text>

        <View style={styles.accesos}>
          <TouchableOpacity
            style={styles.accesoCard}
            onPress={() => mostrarProximamente('Mis pagos')}
          >
            <Ionicons name="card-outline" size={27} color="#23558C" />
            <Text style={styles.accesoText}>Mis pagos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accesoCard}
            onPress={() => mostrarProximamente('Reportes')}
          >
            <Ionicons name="construct-outline" size={27} color="#23558C" />
            <Text style={styles.accesoText}>Reportes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.accesoCard}
            onPress={() => navigation.navigate('Perfil')}
          >
            <Ionicons name="person-outline" size={27} color="#23558C" />
            <Text style={styles.accesoText}>Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* REPORTES RECIENTES */}
        <Text style={styles.sectionTitle}>Últimos reportes</Text>

        <View style={styles.reporteCard}>
          <View style={styles.reporteIcon}>
            <Ionicons name="water-outline" size={23} color="#23558C" />
          </View>

          <View style={styles.reporteInfo}>
            <Text style={styles.reporteTitulo}>
              Fuga en llave de cocina
            </Text>
            <Text style={styles.reporteFecha}>
              15 de octubre de 2026
            </Text>
            <Text style={styles.enProceso}>En proceso</Text>
          </View>
        </View>

        <View style={styles.reporteCard}>
          <View style={styles.reporteIcon}>
            <Ionicons name="bulb-outline" size={23} color="#23558C" />
          </View>

          <View style={styles.reporteInfo}>
            <Text style={styles.reporteTitulo}>
              Foco quemado en pasillo
            </Text>
            <Text style={styles.reporteFecha}>
              8 de octubre de 2026
            </Text>
            <Text style={styles.resuelto}>Resuelto</Text>
          </View>
        </View>

      </ScrollView>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <View style={styles.bottomNav}>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={23} color="#23558C" />
          <Text style={styles.navTextActive}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => mostrarProximamente('Reportes')}
        >
          <Ionicons name="document-text-outline" size={23} color="#94A3B8" />
          <Text style={styles.navText}>Reportes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Perfil')}
        >
          <Ionicons name="person-outline" size={23} color="#94A3B8" />
          <Text style={styles.navText}>Perfil</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
  },
  saludo: {
    fontSize: 13,
    color: '#64748B',
  },
  nombre: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#23558C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cuotaCard: {
    backgroundColor: '#23558C',
    borderRadius: 16,
    padding: 22,
    marginBottom: 30,
  },
  cuotaLabel: {
    color: '#DCEBFA',
    fontSize: 14,
  },
  cuotaMonto: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  cuotaFecha: {
    color: '#DCEBFA',
    fontSize: 12,
  },
  cuotaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  estadoBadge: {
    backgroundColor: '#FBBF24',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  estadoText: {
    color: '#78350F',
    fontSize: 12,
    fontWeight: 'bold',
  },
  verDetalle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 15,
  },
  accesos: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
  },
  accesoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 13,
  },
  accesoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 9,
  },
  reporteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reporteIcon: {
    width: 43,
    height: 43,
    borderRadius: 10,
    backgroundColor: '#EAF2F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  reporteInfo: {
    flex: 1,
  },
  reporteTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  reporteFecha: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  enProceso: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 5,
  },
  resuelto: {
    fontSize: 12,
    color: '#16A34A',
    marginTop: 5,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  navTextActive: {
    fontSize: 11,
    color: '#23558C',
    fontWeight: 'bold',
    marginTop: 4,
  },
});
