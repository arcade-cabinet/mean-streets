import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorldProvider } from 'koota/react';
import { userEvent } from 'vitest/browser';
import { BuildupScreen } from '../BuildupScreen';
import { createGameWorld } from '../../../ecs/world';
import { PlayerA } from '../../../ecs/traits';
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
    const reserveStrip = document.querySelector<HTMLElement>('[data-testid="reserve-strip"]');

    expect(screenRoot).not.toBeNull();
    expect(strikeButton).not.toBeNull();
    expect(reserveStrip).not.toBeNull();
    expect(document.body.textContent).toContain('Crew:');

    await userEvent.click(strikeButton!);
    await new Promise((resolve) => window.setTimeout(resolve, 1600));

    expect(onStrike).toHaveBeenCalledTimes(1);
  });

  it('opens the runner payload panel when selecting an active runner lane', async () => {
    const world = createGameWorld(undefined, 42);
    const player = world.queryFirst(PlayerA)?.get(PlayerA);
    if (player) {
      player.board.active[0].crew = {
        type: 'crew',
        id: 'runner-a',
        displayName: 'Runner A',
        archetype: 'runner',
        affiliation: 'freelance',
        power: 4,
        resistance: 4,
        abilityText: '',
        unlocked: true,
        locked: false,
      };
      player.board.active[0].backpack = {
        type: 'backpack',
        id: 'kit-a',
        name: 'Kit A',
        icon: 'crate',
        size: 2,
        payload: [
          { type: 'cash', id: 'kit-a-cash', denomination: 100 },
          { type: 'weapon', id: 'kit-a-weapon', name: 'Gun', category: 'ranged', bonus: 2, offenseAbility: '', offenseAbilityText: '', defenseAbility: '', defenseAbilityText: '', unlocked: true, locked: false },
        ],
        unlocked: true,
        locked: false,
      };
      player.board.active[0].runner = true;
      player.board.active[0].payloadRemaining = 2;
    }

    cleanup = (await renderInBrowser(
      <WorldProvider world={world}>
        <BuildupScreen world={world} onStrike={vi.fn()} />
      </WorldProvider>,
    )).unmount;

    const activeLane = document.querySelector<HTMLElement>('[data-testid="crew-card-runner-a"]');
    expect(activeLane).not.toBeNull();

    await userEvent.click(activeLane!);

    expect(document.querySelector('[data-testid="runner-payload-panel"]')).not.toBeNull();
  });
});
