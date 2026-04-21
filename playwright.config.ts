import { defineConfig, devices } from '@playwright/test';

const IS_CI = !!process.env.CI;
const IS_HEADLESS = IS_CI || process.env.PW_HEADLESS === '1';
const CHROMIUM_CHANNEL = IS_HEADLESS ? undefined : 'chrome';
const PLAYWRIGHT_PORT = 41739;
const PLAYWRIGHT_BASE_URL = `http://127.0.0.1:${PLAYWRIGHT_PORT}/mean-streets/`;
const REUSE_SERVER = !IS_CI && process.env.PW_REUSE_SERVER === '1';

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
    baseURL: PLAYWRIGHT_BASE_URL,
    headless: IS_HEADLESS,
    trace: 'on-first-retry',
    actionTimeout: IS_CI ? 30_000 : 15_000,
    navigationTimeout: IS_CI ? 30_000 : 15_000,
    browserName: 'chromium',
    channel: CHROMIUM_CHANNEL,
    launchOptions: {
      args: GAME_ARGS,
    },
  },

  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PLAYWRIGHT_PORT}`,
    url: PLAYWRIGHT_BASE_URL,
    reuseExistingServer: REUSE_SERVER,
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
