import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorldProvider } from 'koota/react';
import { CombatScreen } from '../CombatScreen';
import { createGameWorld } from '../../../ecs/world';
import { strikeAction } from '../../../ecs/actions';
import { renderInBrowser } from '../../../test/render-browser';

describe('CombatScreen', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders the combat HUD and action menu inside the ECS provider', async () => {
    const world = createGameWorld(undefined, 42);
    strikeAction(world);

    cleanup = (await renderInBrowser(
      <WorldProvider world={world}>
        <CombatScreen world={world} onGameOver={vi.fn()} />
      </WorldProvider>,
    )).unmount;

    const screenRoot = document.querySelector<HTMLElement>('[data-testid="combat-screen"]');
    const stackButton = document.querySelector<HTMLButtonElement>('[data-testid="action-stack"]');
    const passButton = document.querySelector<HTMLButtonElement>('[data-testid="action-pass"]');

    expect(screenRoot).not.toBeNull();
    expect(document.body.textContent).toContain('ACT');
    expect(stackButton?.disabled).toBe(false);
    expect(passButton?.disabled).toBe(false);
  });
});
