module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  setupFiles: ['<rootDir>/jest.setup.js'],
};
