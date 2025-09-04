import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.js', 
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.js'
    ],
    exclude: ['tests/e2e/**/*'], // E2E tests run separately
    timeout: 10000,
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.test.js',
        'tests/**/*',
        'node_modules/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    testTimeout: 10000,
    bail: 5 // Stop after 5 failures
  },
});