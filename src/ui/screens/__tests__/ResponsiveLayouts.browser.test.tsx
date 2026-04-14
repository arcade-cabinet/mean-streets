import { afterEach, describe, expect, it } from 'vitest';
import { MainMenuScreen } from '../MainMenuScreen';
import { renderInBrowser } from '../../../test/render-browser';
import { resetTestViewport, setTestViewport } from '../../../test/viewport';

describe('responsive layout variants', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    resetTestViewport();
  });

  it('uses stacked menu layout on phone portrait', async () => {
    setTestViewport({ width: 390, height: 844, orientation: 'portrait' });

    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={() => {}} onLoadGame={() => {}} canLoadGame={false} />,
    )).unmount;

    expect(document.querySelector('[data-menu-variant="stacked"]')).not.toBeNull();
  });

  it('uses split menu layout on tablet landscape', async () => {
    setTestViewport({ width: 1180, height: 820, orientation: 'landscape' });

    cleanup = (await renderInBrowser(
      <MainMenuScreen onNewGame={() => {}} onLoadGame={() => {}} canLoadGame={false} />,
    )).unmount;

    expect(document.querySelector('[data-menu-variant="split"]')).not.toBeNull();
  });
});
