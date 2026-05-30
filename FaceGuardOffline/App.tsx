/**
 * FaceGuard Offline - Root Application Component
 *
 * @description Entry point for the FaceGuard Offline application.
 * Provides the root-level providers (GestureHandler, SafeArea) and
 * delegates all navigation and screen rendering to AppNavigator.
 *
 * @module App
 * @version 1.0.0
 */

import React from 'react';
import { StatusBar, StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from '@navigation/AppNavigator';

/**
 * Suppress known warnings from third-party libraries in development.
 * Remove or audit these before production release.
 */
LogBox.ignoreLogs(['ViewPropTypes will be removed', 'ColorPropType will be removed']);

/**
 * Root application component.
 *
 * @returns {React.JSX.Element} The application root wrapped in required providers.
 *
 * @example
 * // Registered in index.js:
 * // AppRegistry.registerComponent(appName, () => App);
 */
const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0D1B2A" translucent={false} />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1B2A',
  },
});

export default App;
