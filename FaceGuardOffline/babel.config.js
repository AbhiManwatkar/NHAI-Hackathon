/**
 * Babel Configuration for FaceGuard Offline
 *
 * @description Configures module resolution aliases and required Babel plugins.
 * IMPORTANT: react-native-reanimated/plugin MUST remain the last plugin in the list.
 *
 * @see https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/#babel-plugin
 */
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: [
          '.ios.ts',
          '.android.ts',
          '.ts',
          '.ios.tsx',
          '.android.tsx',
          '.tsx',
          '.jsx',
          '.js',
          '.json',
        ],
        alias: {
          '@modules': './src/modules',
          '@screens': './src/screens',
          '@components': './src/components',
          '@hooks': './src/hooks',
          '@theme': './src/theme',
          '@utils': './src/utils',
          '@navigation': './src/navigation',
        },
      },
    ],
    /**
     * react-native-reanimated/plugin MUST be listed LAST.
     * @see https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started
     */
    'react-native-reanimated/plugin',
  ],
};
