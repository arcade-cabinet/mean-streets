import { defineConfig, devices } from '@playwright/test';

const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: IS_CI ? 2 : 0,
  // Per-test timeout — bumped on CI because xvfb + WebKit dispatch
  // taps noticeably slower than local Chromium, and ipad-pro-landscape
  // tap-only flow was hitting 30s.
  timeout: IS_CI ? 90_000 : 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173/mean-streets/',
    headless: process.env.PW_HEADLESS === '1',
    trace: 'on-first-retry',
    actionTimeout: IS_CI ? 30_000 : 15_000,
    navigationTimeout: IS_CI ? 30_000 : 15_000,
  },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/mean-streets/',
    reuseExistingServer: !IS_CI,
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
        // Touch-tap dispatch under xvfb WebKit is the slowest path
        // we run; give individual actions extra headroom on CI.
        actionTimeout: IS_CI ? 45_000 : 15_000,
      },
    },
  ],
});
