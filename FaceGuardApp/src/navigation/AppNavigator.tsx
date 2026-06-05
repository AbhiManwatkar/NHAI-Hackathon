/**
 * FaceGuard Offline – Navigation Configuration
 * ===============================================
 * Stack navigator with dark theme and custom transitions.
 */

import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme';
import { HomeScreen } from '../screens/HomeScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { EnrollScreen } from '../screens/EnrollScreen';
import { AdminScreen } from '../screens/AdminScreen';

export type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  Enroll: undefined;
  Admin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const FaceGuardTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary[500],
    background: Colors.bg.primary,
    card: Colors.bg.secondary,
    text: Colors.text.primary,
    border: Colors.border.subtle,
    notification: Colors.accent[500],
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={FaceGuardTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: Colors.bg.primary },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="Enroll" component={EnrollScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
