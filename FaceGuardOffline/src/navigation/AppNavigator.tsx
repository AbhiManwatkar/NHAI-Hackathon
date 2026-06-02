import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Colors } from '../theme/colors';
import type { RootStackParamList } from '../types';

import AdminScreen from '../screens/AdminScreen';
import AttendanceLogScreen from '../screens/AttendanceLogScreen';
import EnrolmentScreen from '../screens/EnrolmentScreen';
import HomeScreen from '../screens/HomeScreen';
import RecognitionScreen from '../screens/RecognitionScreen';
import SyncStatusScreen from '../screens/SyncStatusScreen';

const Stack = createStackNavigator<RootStackParamList>();

const customHeaderOptions = (title: string, rightAction?: React.ReactNode) => ({
  headerShown: true,
  headerStyle: {
    backgroundColor: Colors.brand.dark,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: Colors.text.primary,
  headerTitle: title,
  headerTitleStyle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '800' as const,
  },
  headerBackTitleVisible: false,
  headerBackImage: () => (
    <Text style={{ color: Colors.brand.primary, fontSize: 30, marginLeft: 14 }}>‹</Text>
  ),
  headerRight: () =>
    rightAction ? (
      <TouchableOpacity activeOpacity={0.8} style={{ marginRight: 16 }}>
        {rightAction}
      </TouchableOpacity>
    ) : null,
});

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          cardStyle: { backgroundColor: Colors.ui.background },
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Enrolment"
          component={EnrolmentScreen}
          options={{
            ...customHeaderOptions('Enrol New Staff'),
            presentation: 'modal',
            cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
          }}
        />
        <Stack.Screen
          name="Recognition"
          component={RecognitionScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
          }}
        />
        <Stack.Screen
          name="AttendanceLog"
          component={AttendanceLogScreen}
          options={customHeaderOptions('Attendance Log')}
        />
        <Stack.Screen
          name="Admin"
          component={AdminScreen}
          options={customHeaderOptions('Admin Dashboard')}
        />
        <Stack.Screen
          name="SyncStatus"
          component={SyncStatusScreen}
          options={customHeaderOptions('Sync Status')}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
