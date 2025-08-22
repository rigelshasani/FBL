import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/unit/**/*.test.ts'],
    timeout: 5000,
  },
});