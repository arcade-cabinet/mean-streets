import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  window.__MEAN_STREETS_TEST__ = true;
});

afterEach(() => {
  cleanup();
  delete window.__MEAN_STREETS_TEST__;
});
