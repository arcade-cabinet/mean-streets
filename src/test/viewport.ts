import type { TestViewportOverride } from '../platform/layout';

export function setTestViewport(override: TestViewportOverride): void {
  window.__MEAN_STREETS_VIEWPORT__ = override;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: override.width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: override.height });
  window.dispatchEvent(new Event('resize'));
}

export function resetTestViewport(): void {
  delete window.__MEAN_STREETS_VIEWPORT__;
  window.dispatchEvent(new Event('resize'));
}
