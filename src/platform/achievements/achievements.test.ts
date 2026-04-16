import { describe, expect, it } from 'vitest';
import type { CompiledTough, CompiledWeapon, CompiledDrug } from '../../sim/cards/schemas';
import type { TurfMetrics } from '../../sim/turf/types';
import { emptyMetrics } from '../../sim/turf/environment';
import type { PlayerProfile } from '../persistence/storage';
import { processGameEnd, type GameEndEvent } from './achievements';

function makeCard(id: string, unlockCondition?: string): CompiledTough {
  return {
    kind: 'tough',
    id,
    name: id,
    archetype: 'bruiser',
    affiliation: 'kings_row',
    power: 5,
    resistance: 5,
    rarity: 'common',
    abilities: [],
    unlocked: false,
    ...(unlockCondition ? { unlockCondition } : {}),
    locked: false,
  };
}

function makeWeapon(id: string, unlockCondition?: string): CompiledWeapon {
  return {
    kind: 'weapon',
    id,
    name: id,
    category: 'bladed',
    power: 3,
    resistance: 1,
    rarity: 'common',
    abilities: [],
    unlocked: false,
    ...(unlockCondition ? { unlockCondition } : {}),
    locked: false,
  };
}

function makeDrug(id: string, unlockCondition?: string): CompiledDrug {
  return {
    kind: 'drug',
    id,
    name: id,
    category: 'stimulant',
    power: 2,
    resistance: 1,
    rarity: 'common',
    abilities: [],
    unlocked: false,
    ...(unlockCondition ? { unlockCondition } : {}),
    locked: false,
  };
}

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    unlockedCardIds: [],
    wins: 0,
    lastPlayedAt: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<GameEndEvent> = {}): GameEndEvent {
  const { metrics: metricsOverride, ...rest } = overrides;
  const metrics: TurfMetrics = { ...emptyMetrics(), ...metricsOverride };
  return {
    winner: 'A',
    playerSide: 'A',
    turnCount: 20,
    ownPositionsLost: 0,
    ...rest,
    metrics,
  };
}

describe('processGameEnd', () => {
  it('"Win N games" unlocks once cumulative wins >= N', () => {
    const card = makeCard('card-win3', 'Win 3 games');
    const profile = makeProfile({ wins: 2 });
    const event = makeEvent({ winner: 'A', playerSide: 'A' });

    const result = processGameEnd(event, [card], profile);

    expect(result.newlyUnlocked).toEqual(['card-win3']);
    expect(result.updatedProfile.wins).toBe(3);
    expect(result.updatedProfile.unlockedCardIds).toContain('card-win3');
  });

  it('does not unlock on a losing game when wins threshold not yet met', () => {
    const card = makeCard('card-win3', 'Win 3 games');
    const profile = makeProfile({ wins: 2 });
    const event = makeEvent({ winner: 'B', playerSide: 'A' });

    const result = processGameEnd(event, [card], profile);

    expect(result.newlyUnlocked).toHaveLength(0);
    expect(result.updatedProfile.wins).toBe(2);
  });

  it('"Win a game in under N rounds" requires a win AND round cap', () => {
    const card = makeCard('card-fast', 'Win a game in under 15 rounds');
    const profile = makeProfile();

    const loss = processGameEnd(
      makeEvent({ winner: 'B', turnCount: 10 }),
      [card],
      profile,
    );
    expect(loss.newlyUnlocked).toHaveLength(0);

    const slowWin = processGameEnd(
      makeEvent({ winner: 'A', turnCount: 20 }),
      [card],
      profile,
    );
    expect(slowWin.newlyUnlocked).toHaveLength(0);

    const fastWin = processGameEnd(
      makeEvent({ winner: 'A', turnCount: 12 }),
      [card],
      profile,
    );
    expect(fastWin.newlyUnlocked).toEqual(['card-fast']);
  });

  it('"Kill N enemies in a single game" checks latest game metrics', () => {
    const card = makeCard('card-killer', 'Kill 3 enemies in a single game');
    const profile = makeProfile();

    const quiet = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), kills: 2 } }),
      [card],
      profile,
    );
    expect(quiet.newlyUnlocked).toHaveLength(0);

    const loud = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), kills: 3 } }),
      [card],
      profile,
    );
    expect(loud.newlyUnlocked).toEqual(['card-killer']);
  });

  it('"Seize N positions total" accumulates across games', () => {
    const card = makeCard('card-seize', 'Seize 10 positions total');
    const profile1 = makeProfile();

    const first = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), seizures: 4 } }),
      [card],
      profile1,
    );
    expect(first.newlyUnlocked).toHaveLength(0);

    const second = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), seizures: 5 } }),
      [card],
      first.updatedProfile,
    );
    expect(second.newlyUnlocked).toHaveLength(0);

    const third = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), seizures: 2 } }),
      [card],
      second.updatedProfile,
    );
    expect(third.newlyUnlocked).toEqual(['card-seize']);
  });

  it('"Win without losing a position" requires win AND zero lost', () => {
    const card = makeCard('card-flawless', 'Win without losing a position');
    const profile = makeProfile();

    const bloodied = processGameEnd(
      makeEvent({ winner: 'A', ownPositionsLost: 1 }),
      [card],
      profile,
    );
    expect(bloodied.newlyUnlocked).toHaveLength(0);

    const flawless = processGameEnd(
      makeEvent({ winner: 'A', ownPositionsLost: 0 }),
      [card],
      profile,
    );
    expect(flawless.newlyUnlocked).toEqual(['card-flawless']);
  });

  it('does not re-unlock already unlocked cards', () => {
    const card = makeCard('card-win3', 'Win 3 games');
    const profile = makeProfile({ wins: 5, unlockedCardIds: ['card-win3'] });
    const event = makeEvent({ winner: 'A' });

    const result = processGameEnd(event, [card], profile);

    expect(result.newlyUnlocked).toHaveLength(0);
    // Still in unlockedCardIds
    expect(result.updatedProfile.unlockedCardIds).toContain('card-win3');
  });

  it('skips cards with unrecognized conditions (awaits writer pass)', () => {
    const card = makeCard('card-mystery', 'Do something very poetic');
    const profile = makeProfile({ wins: 100 });
    const event = makeEvent({ winner: 'A' });

    const result = processGameEnd(event, [card], profile);

    expect(result.newlyUnlocked).toHaveLength(0);
  });

  it('"Kill N top toughs total" accumulates across games', () => {
    const card = makeCard('card-hunter', 'Kill 5 top toughs total');
    let profile = makeProfile();

    // First game: 2 kills — below threshold
    let result = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), kills: 2 } }),
      [card],
      profile,
    );
    expect(result.newlyUnlocked).toHaveLength(0);
    profile = result.updatedProfile;

    // Second game: 2 more (4 total) — still below
    result = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), kills: 2 } }),
      [card],
      profile,
    );
    expect(result.newlyUnlocked).toHaveLength(0);
    profile = result.updatedProfile;

    // Third game: 1 more (5 total) — unlocks
    result = processGameEnd(
      makeEvent({ metrics: { ...emptyMetrics(), kills: 1 } }),
      [card],
      profile,
    );
    expect(result.newlyUnlocked).toEqual(['card-hunter']);
  });

  it('"Win without discarding any cards" fires on win with zero discards', () => {
    const card = makeCard('card-patient', 'Win without discarding any cards');
    const profile = makeProfile();

    // Win but discarded → no unlock
    const discardWin = processGameEnd(
      makeEvent({ winner: 'A', metrics: { ...emptyMetrics(), cardsDiscarded: 2 } }),
      [card],
      profile,
    );
    expect(discardWin.newlyUnlocked).toHaveLength(0);

    // Loss with zero discards → no unlock (must win)
    const cleanLoss = processGameEnd(
      makeEvent({ winner: 'B', metrics: { ...emptyMetrics(), cardsDiscarded: 0 } }),
      [card],
      profile,
    );
    expect(cleanLoss.newlyUnlocked).toHaveLength(0);

    // Win with zero discards → unlocks
    const cleanWin = processGameEnd(
      makeEvent({ winner: 'A', metrics: { ...emptyMetrics(), cardsDiscarded: 0 } }),
      [card],
      profile,
    );
    expect(cleanWin.newlyUnlocked).toEqual(['card-patient']);
  });

  it('unlocks weapons with an unlockCondition (not just toughs)', () => {
    // Regression pin for CodeRabbit finding: processGameEnd's catalog
    // param was typed CompiledTough[], so weapon/drug unlock conditions
    // were silently skipped. Now the parameter accepts any unlockable
    // card type and weapon conditions fire too.
    const weapon = makeWeapon('weap-veteran', 'Win 3 games');
    const profile = makeProfile({ wins: 2 });

    const result = processGameEnd(
      makeEvent({ winner: 'A' }),
      [weapon],
      profile,
    );

    expect(result.newlyUnlocked).toEqual(['weap-veteran']);
  });

  it('unlocks drugs with an unlockCondition', () => {
    const drug = makeDrug('drug-clean', 'Win without discarding any cards');
    const profile = makeProfile();

    const result = processGameEnd(
      makeEvent({ winner: 'A', metrics: { ...emptyMetrics(), cardsDiscarded: 0 } }),
      [drug],
      profile,
    );

    expect(result.newlyUnlocked).toEqual(['drug-clean']);
  });
});
