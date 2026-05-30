/**
 * FaceGuard Offline - Application Entry Point
 *
 * @description Registers the root App component with the React Native AppRegistry.
 * This file is the first JavaScript entry point loaded by the native runtime.
 *
 * @module index
 * @version 1.0.0
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
