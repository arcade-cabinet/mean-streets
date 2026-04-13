import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppShellProvider } from '../platform';

export interface BrowserRenderResult {
  container: HTMLDivElement;
  unmount: () => void;
}

export async function settleBrowser(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await Promise.resolve();
  });
}

export async function renderInBrowser(node: ReactNode): Promise<BrowserRenderResult> {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '';
  window.__MEAN_STREETS_TEST__ = true;

  const container = document.createElement('div');
  document.body.appendChild(container);

  let root: Root | null = null;

  await act(async () => {
    root = createRoot(container);
    root.render(<AppShellProvider>{node}</AppShellProvider>);
    await Promise.resolve();
  });
  await settleBrowser();

  return {
    container,
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      delete window.__MEAN_STREETS_TEST__;
      container.remove();
      document.body.innerHTML = '';
    },
  };
}
