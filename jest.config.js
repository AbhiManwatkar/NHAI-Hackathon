/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/FaceGuardApp/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'FaceGuardApp/src/**/*.ts',
    '!FaceGuardApp/src/**/*.d.ts',
    '!**/node_modules/**',
  ],
};
