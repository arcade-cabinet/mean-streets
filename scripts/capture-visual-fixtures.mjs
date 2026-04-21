#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import net from 'node:net';
import { chromium, devices } from 'playwright';

const PORT = 41739;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}/mean-streets/`;
const REUSE_SERVER = process.env.PW_REUSE_SERVER === '1';
const EXPORT_DIR = process.env.MEAN_STREETS_VISUAL_EXPORT_DIR ?? null;
const SCREENSHOT_TIMEOUT_MS = 30_000;
const SERVER_START_TIMEOUT_MS = 30_000;
const GAME_ARGS = ['--no-sandbox'];
const HEADLESS = process.env.CI ? true : process.env.PW_HEADLESS === '1';

const PROJECTS = [
  ['desktop-chromium', { viewport: { width: 1920, height: 1080 } }],
  ['iphone-14', devices['iPhone 14']],
  ['pixel-7', devices['Pixel 7']],
  ['ipad-pro-landscape', devices['iPad Pro 11 landscape']],
];

const FIXTURES = [
  ['menu', 'main-menu-screen'],
  ['difficulty', 'difficulty-screen'],
  ['deck-garage', 'deck-garage-screen'],
  ['combat', 'game-screen'],
  ['card', 'fixture-root'],
  ['pack-opening', 'pack-opening-screen'],
  ['game-over', 'gameover-screen'],
];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (response.ok) return;
    } catch {
      // Server still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function startServer() {
  if (await isPortOpen(PORT)) {
    if (REUSE_SERVER) return null;
    throw new Error(
      `${BASE_URL} is already in use. Stop the existing server or set PW_REUSE_SERVER=1.`,
    );
  }

  let stderr = '';
  const child = spawn(
    'pnpm',
    ['exec', 'vite', '--host', HOST, '--port', String(PORT)],
    {
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: undefined },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );

  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
    if (stderr.length > 8000) {
      stderr = stderr.slice(-8000);
    }
  });

  try {
    await waitForServer(BASE_URL, SERVER_START_TIMEOUT_MS);
    return child;
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(
      `Failed to start Vite visual server: ${
        error instanceof Error ? error.message : String(error)
      }\n${stderr}`.trim(),
    );
  }
}

async function captureAll() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: GAME_ARGS,
  });
  const tempDir = EXPORT_DIR ? null : mkdtempSync(join(tmpdir(), 'mean-streets-visual-'));

  try {
    for (const [projectName, use] of PROJECTS) {
      const context = await browser.newContext(use);
      try {
        for (const [fixture, testId] of FIXTURES) {
          const page = await context.newPage();
          try {
            await page.goto(`${BASE_URL}?fixture=${fixture}`);
            await page.waitForLoadState('networkidle');
            const target = page.getByTestId(testId);
            await target.waitFor({ state: 'visible' });
            await target.scrollIntoViewIfNeeded().catch(() => undefined);
            const box = await target.boundingBox();
            if (!box) {
              throw new Error(`Could not resolve bounding box for ${projectName} ${fixture}`);
            }

            const outputPath = EXPORT_DIR
              ? join(EXPORT_DIR, projectName, `${fixture}.png`)
              : join(tempDir, projectName, `${fixture}.png`);
            mkdirSync(dirname(outputPath), { recursive: true });

            await page.screenshot({
              animations: 'disabled',
              clip: box,
              path: outputPath,
              timeout: SCREENSHOT_TIMEOUT_MS,
            });
            console.log(`[visual] ${projectName} ${fixture}`);
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

let serverProcess = null;

try {
  serverProcess = await startServer();
  await captureAll();
} finally {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
}
