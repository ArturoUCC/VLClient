import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

export default function BienvenidaScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <Image
          source={require('../../assets/images/logo-viveslara.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>VLClient</Text>

        <Text style={styles.subtitle}>
          Gestiona tu renta desde donde estés
        </Text>

        <View style={styles.features}>
          <Text style={styles.feature}>
            💳 Consulta y paga tu cuota mensual
          </Text>

          <Text style={styles.feature}>
            🔧 Reporta desperfectos al instante
          </Text>

          <Text style={styles.feature}>
            📅 Agenda citas de mantenimiento
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Iniciar sesión</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  logo: {
    width: 220,
    height: 120,
    marginBottom: 15,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#23558C',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#66788A',
    textAlign: 'center',
    marginBottom: 40,
  },
  features: {
    width: '100%',
    gap: 15,
    marginBottom: 45,
  },
  feature: {
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 12,
    fontSize: 14,
    color: '#34495E',
    overflow: 'hidden',
  },
  button: {
    backgroundColor: '#23558C',
    width: '100%',
    paddingVertical: 17,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});