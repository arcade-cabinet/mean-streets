import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'koota/react'],
  },
  test: {
    include: ['src/**/*.browser.test.tsx'],
    globals: true,
    setupFiles: ['src/test/setup-browser.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
