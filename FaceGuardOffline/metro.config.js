/**
 * Metro Configuration for FaceGuard Offline
 *
 * @description Extends the default Metro config to support TensorFlow Lite model
 * files (.tflite) as bundled assets. This is required for the offline facial
 * recognition and liveness detection ML models.
 *
 * @see https://facebook.github.io/metro/docs/configuration
 */
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Custom Metro configuration
 * - Adds .tflite to resolver assetExts so Metro recognizes model files as assets
 * - Adds .tflite to server assetExts for proper serving during development
 */
const config = {
  resolver: {
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'tflite', // TensorFlow Lite model files
      'bin',    // Binary weight files (if needed)
    ],
  },
  server: {
    enhanceMiddleware: (middleware) => {
      return middleware;
    },
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);
