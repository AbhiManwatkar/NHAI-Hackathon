/**
 * FaceGuard Offline – App Entry Point
 * Stack navigation with dark theme. Initialises SQLite on boot.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { initDB } from './src/storage';
import HomeScreen from './src/screens/HomeScreen';
import AuthScreen from './src/screens/AuthScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createNativeStackNavigator();

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0A8FE0',
    background: '#0B0F19',
    card: '#111827',
    text: '#F1F5F9',
    border: '#1E293B',
    notification: '#00E69D',
  },
};

function SplashScreen({ onReady }: { onReady: () => void }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();

    // Init DB then fade out
    initDB().then(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(onReady);
      }, 1200);
    }).catch(() => {
      setTimeout(onReady, 1500);
    });
  }, []);

  return (
    <View style={styles.splash}>
      <Animated.View style={{ alignItems: 'center', opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <View style={styles.splashIcon}>
          <Text style={{ fontSize: 48 }}>🛡️</Text>
        </View>
        <Text style={styles.splashTitle}>FaceGuard</Text>
        <Text style={styles.splashSub}>Offline Biometric System</Text>
        <ActivityIndicator color="#0A8FE0" style={{ marginTop: 32 }} />
        <Text style={styles.splashInfo}>Initialising secure vault…</Text>
      </Animated.View>
      <Text style={styles.splashFooter}>NHAI Datalake 3.0</Text>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return (
      <>
        <StatusBar style="light" />
        <SplashScreen onReady={() => setReady(true)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#0B0F19' },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Enroll" component={EnrollScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0B0F19',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(10,143,224,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(10,143,224,0.3)',
    marginBottom: 24,
  },
  splashTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  splashSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  splashInfo: {
    fontSize: 12,
    color: '#475569',
    marginTop: 12,
  },
  splashFooter: {
    position: 'absolute',
    bottom: 48,
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
});
