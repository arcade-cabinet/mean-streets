import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorldProvider } from 'koota/react';
import { userEvent } from 'vitest/browser';
import { BuildupScreen } from '../BuildupScreen';
import { createGameWorld } from '../../../ecs/world';
import { renderInBrowser } from '../../../test/render-browser';

describe('BuildupScreen', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders the buildup state and allows striking into combat', async () => {
    const world = createGameWorld(undefined, 42);
    const onStrike = vi.fn();

    cleanup = (await renderInBrowser(
      <WorldProvider world={world}>
        <BuildupScreen world={world} onStrike={onStrike} />
      </WorldProvider>,
    )).unmount;

    const screenRoot = document.querySelector<HTMLElement>('[data-testid="buildup-screen"]');
    const strikeButton = document.querySelector<HTMLButtonElement>('[data-testid="strike-button"]');

    expect(screenRoot).not.toBeNull();
    expect(strikeButton).not.toBeNull();
    expect(document.body.textContent).toContain('Crew:');

    await userEvent.click(strikeButton!);
    await new Promise((resolve) => window.setTimeout(resolve, 1600));

    expect(onStrike).toHaveBeenCalledTimes(1);
  });
});
