import { defineConfig, devices } from '@playwright/test';

const IS_CI = !!process.env.CI;

const GAME_ARGS = [
  '--no-sandbox',
  '--use-angle=gl',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--mute-audio',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: IS_CI ? 2 : 0,
  timeout: IS_CI ? 90_000 : 60_000,

  use: {
    baseURL: 'http://127.0.0.1:4173/mean-streets/',
    headless: IS_CI,
    trace: 'on-first-retry',
    actionTimeout: IS_CI ? 30_000 : 15_000,
    navigationTimeout: IS_CI ? 30_000 : 15_000,
    browserName: 'chromium',
    channel: 'chrome',
    launchOptions: {
      args: GAME_ARGS,
    },
  },

  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/mean-streets/',
    reuseExistingServer: !IS_CI,
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
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
        actionTimeout: IS_CI ? 45_000 : 15_000,
      },
    },
  ],
});
