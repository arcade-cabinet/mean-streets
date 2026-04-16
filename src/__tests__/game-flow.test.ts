/**
 * Integration tests for UI screen flow via ECS.
 * Verifies that ScreenTrait starts correctly and responds to setScreen.
 */

import { describe, it, expect } from 'vitest';
import { createGameWorld } from '../ecs/world';
import { setScreen } from '../ecs/actions';
import { ScreenTrait } from '../ecs/traits';

const SEED = 42;

describe('ScreenTrait initial state', () => {
  it('initial screen is menu', () => {
    const world = createGameWorld(undefined, SEED);
    const entity = world.queryFirst(ScreenTrait);
    expect(entity).toBeDefined();
    const s = entity!.get(ScreenTrait)!;
    expect(s.current).toBe('menu');
  });
});

describe('setScreen', () => {
  it('changes screen to deckbuilder', () => {
    const world = createGameWorld(undefined, SEED);
    setScreen(world, 'deckbuilder');
    const entity = world.queryFirst(ScreenTrait);
    const s = entity!.get(ScreenTrait)!;
    expect(s.current).toBe('deckbuilder');
  });

  it('changes screen to combat', () => {
    const world = createGameWorld(undefined, SEED);
    setScreen(world, 'combat');
    const entity = world.queryFirst(ScreenTrait);
    const s = entity!.get(ScreenTrait)!;
    expect(s.current).toBe('combat');
  });

  it('can transition between multiple screens', () => {
    const world = createGameWorld(undefined, SEED);
    setScreen(world, 'deckbuilder');
    setScreen(world, 'combat');
    setScreen(world, 'gameover');
    const entity = world.queryFirst(ScreenTrait);
    const s = entity!.get(ScreenTrait)!;
    expect(s.current).toBe('gameover');
  });
});
