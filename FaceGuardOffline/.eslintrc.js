/**
 * ESLint Configuration for FaceGuard Offline
 *
 * @description Extends the React Native community ESLint config with
 * TypeScript support and custom rules for production-grade code quality.
 */
module.exports = {
  root: true,
  extends: ['@react-native'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  settings: {
    'import/resolver': {
      'babel-module': {
        root: ['./src'],
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
    },
  },
  rules: {
    /* TypeScript-specific rules */
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',

    /* React & React Native rules */
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-unused-styles': 'warn',
    'react-native/no-color-literals': 'warn',
    'react-native/no-raw-text': 'off',

    /* General code quality */
    'no-console': ['warn', {allow: ['warn', 'error']}],
    'no-debugger': 'error',
    'no-duplicate-imports': 'error',
    'prefer-const': 'warn',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
  },
  overrides: [
    {
      /* Relax rules for test files */
      files: ['**/__tests__/**/*', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    'coverage/',
    '*.config.js',
    'babel.config.js',
    'metro.config.js',
  ],
};
