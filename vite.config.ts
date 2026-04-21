import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/mean-streets/',
  resolve: {
    alias: {
      crypto: fileURLToPath(
        new URL('./src/platform/persistence/crypto-browser.ts', import.meta.url),
      ),
      'node:crypto': fileURLToPath(
        new URL('./src/platform/persistence/crypto-browser.ts', import.meta.url),
      ),
    },
  },
  plugins: [react(), tailwindcss()],
})
