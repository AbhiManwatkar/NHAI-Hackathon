/**
 * @fileoverview AppNavigator - Central Navigation Hub
 * @description Configures the root stack navigator for the FaceGuard Offline application
 * using @react-navigation/stack, defining transition behaviors and screen options.
 *
 * @module navigation/AppNavigator
 * @version 1.0.0
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { RootStackParamList } from '../types';

// Screens
import MainTabsScreen from '../screens/MainTabsScreen';
import EnrolmentScreen from '../screens/EnrolmentScreen';
import RecognitionScreen from '../screens/RecognitionScreen';
import SyncStatusScreen from '../screens/SyncStatusScreen';

const Stack = createStackNavigator<RootStackParamList>();

/**
 * Root Stack Navigator containing the main bottom tabs and full-screen screens
 * like Enrolment and Recognition, configured with smooth hardware-accelerated transitions.
 */
export const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0D1B2A' },
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabsScreen} />
      <Stack.Screen
        name="Enrolment"
        component={EnrolmentScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
        }}
      />
      <Stack.Screen
        name="Recognition"
        component={RecognitionScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
        }}
      />
      <Stack.Screen name="SyncStatus" component={SyncStatusScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
