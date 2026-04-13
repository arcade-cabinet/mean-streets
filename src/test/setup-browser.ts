import { afterEach, beforeAll, vi } from 'vitest';

const ACT_WARNING = 'not wrapped in act';
const originalConsoleError = console.error;

beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [first] = args;
    if (typeof first === 'string' && first.includes(ACT_WARNING)) {
      return;
    }
    originalConsoleError(...args);
  });
});

afterEach(() => {
  delete window.__MEAN_STREETS_TEST__;
});
