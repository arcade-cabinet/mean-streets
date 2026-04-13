import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/mean-streets/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/mean-streets/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-14',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'ipad-pro-landscape',
      use: {
        ...devices['iPad Pro 11 landscape'],
      },
    },
  ],
});
