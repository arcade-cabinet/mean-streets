import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { resetAIProfileForTests } from '../platform/persistence/ai-profile';
import { resetPersistenceForTests } from '../platform/persistence/storage';

const ACT_WARNING = 'not wrapped in act';
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;

if (typeof window !== 'undefined') {
  window.TONE_SILENCE_LOGGING = true;
}

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [first] = args;
    if (typeof first === 'string' && first.includes(ACT_WARNING)) {
      return;
    }
    originalConsoleError(...args);
    throw new Error(
      `Unexpected console.error in browser test: ${
        args.map((arg) => String(arg)).join(' ')
      }`,
    );
  });
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    originalConsoleLog(...args);
    throw new Error(
      `Unexpected console.log in browser test: ${
        args.map((arg) => String(arg)).join(' ')
      }`,
    );
  });
  vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
    originalConsoleInfo(...args);
    throw new Error(
      `Unexpected console.info in browser test: ${
        args.map((arg) => String(arg)).join(' ')
      }`,
    );
  });
});

beforeEach(() => {
  window.__MEAN_STREETS_TEST__ = true;
});

afterEach(async () => {
  await resetAIProfileForTests();
  await resetPersistenceForTests();
  delete window.__MEAN_STREETS_TEST__;
});
