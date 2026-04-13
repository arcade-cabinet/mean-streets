import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.browser.test.tsx', 'src/**/*.dom.test.tsx', 'e2e/**'],
    globals: true,
    passWithNoTests: true,
  },
});
