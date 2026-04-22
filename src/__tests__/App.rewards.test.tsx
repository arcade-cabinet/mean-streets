// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { GameConfig, TurfMetrics, WarStats } from '../sim/turf/types';

const mockGameState = vi.hoisted(() => ({
  metrics: {
    turns: 4,
    draws: 0,
    retreats: 0,
    closedRanksEnds: 0,
    directStrikes: 0,
    pushedStrikes: 0,
    fundedRecruits: 0,
    kills: 2,
    spiked: 0,
    seizures: 1,
    busts: 0,
    cardsPlayed: 3,
    cardsDiscarded: 0,
    toughsPlayed: 1,
    modifiersPlayed: 2,
    passes: 0,
    goalSwitches: 0,
    failedPlans: 0,
    stallTurns: 0,
    deadHandTurns: 0,
    policyGuidedActions: 0,
    totalActions: 0,
    firstStrike: 'A' as 'A' | 'B' | null,
    raids: 0,
    marketTrades: 0,
    marketHeals: 0,
    modifierSwaps: 0,
    mythicsFlipped: 0,
    bribesAccepted: 0,
    bribesFailed: 0,
  } satisfies TurfMetrics,
  mythicAssignments: {} as Record<string, 'A' | 'B'>,
  mythicPool: [] as string[],
  warStats: {
    seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }],
  } satisfies WarStats,
  rng: {
    seed: 77,
    next: () => 0.25,
    int: (min: number) => min,
    pick: <T,>(items: T[]) => items[0],
    shuffle: <T,>(items: T[]) => items,
  },
}));

const mockWorld = vi.hoisted(() => ({
  query: () => ({
    updateEach: (cb: (rows: [typeof mockGameState]) => void) => {
      cb([mockGameState]);
    },
  }),
}));

const mockConfig = vi.hoisted(
  () =>
    ({
      difficulty: 'hard',
      suddenDeath: false,
      turfCount: 4,
      actionsPerTurn: 3,
      firstTurnActions: 5,
    }) satisfies GameConfig,
);

const mockWinner = vi.hoisted(() => ({
  side: 'A' as 'A' | 'B',
}));

const mockGameOverProps = vi.hoisted(() => ({
  rewardCards: [] as Array<{ id: string }>,
  rewardOutcome: null as string | null,
  rewardCurrencyAmount: null as number | null,
}));

const mockPlayerProfile = vi.hoisted(() => ({
  unlockedCardIds: [] as string[],
  cardInstances: {} as Record<
    string,
    { rolledRarity: string; unlockDifficulty: string }
  >,
  wins: 0,
  lastPlayedAt: null as string | null,
  perfectWarsAfterPoolExhaustion: 0,
}));

const mockAIProfile = vi.hoisted(() => ({
  aiCollection: [],
  aiMythicAssignments: {},
  aiWarWinCount: 0,
  aiPendingPacks: [],
  aiPerfectWarFallbackCount: 0,
}));

const mockRewardPackCards = vi.hoisted(() => [] as Array<{ id: string }>);

const mockSaveProfile = vi.hoisted(() => vi.fn());
const mockSyncPlayerMythics = vi.hoisted(() => vi.fn());
const mockSaveAIMythics = vi.hoisted(() => vi.fn());
const mockOpenRewardPackInstances = vi.hoisted(() => vi.fn());
const mockAddPendingPacksToAI = vi.hoisted(() => vi.fn());
const mockOpenPendingAIPacks = vi.hoisted(() => vi.fn());
const mockIncrementAIPerfectWarFallbackCount = vi.hoisted(() => vi.fn());

vi.mock('../ecs/world', () => ({
  createGameWorld: () => mockWorld,
}));

vi.mock('../platform/achievements/achievements', () => ({
  ownPositionsLostFromWarStats: () => 0,
  processGameEnd: (
    _event: unknown,
    _cards: unknown,
    profile: typeof mockPlayerProfile,
  ) => ({
    updatedProfile: { ...profile, wins: profile.wins + 1 },
  }),
}));

vi.mock('../platform/persistence/collection', () => ({
  loadCollection: () =>
    Promise.resolve([{ id: 'starter-tough', kind: 'tough' }]),
  loadCollectionInventory: () =>
    Promise.resolve([
      {
        card: { id: 'starter-tough', kind: 'tough', rarity: 'common' },
        unlockDifficulty: 'easy',
      },
    ]),
  loadPreferences: () => Promise.resolve([]),
  loadPlayerOwnedMythicIds: () => Promise.resolve([]),
  openRewardPackInstances: (...args: unknown[]) =>
    mockOpenRewardPackInstances(...args),
  syncPlayerMythicOwnership: (...args: unknown[]) =>
    mockSyncPlayerMythics(...args),
}));

vi.mock('../platform/persistence/ai-profile', () => ({
  addPendingPacksToAI: (...args: unknown[]) => mockAddPendingPacksToAI(...args),
  grantAIStarterCollection: () => Promise.resolve(),
  loadAICollection: () => Promise.resolve([{ id: 'ai-tough', kind: 'tough' }]),
  loadAIOwedMythicIds: () => Promise.resolve([]),
  loadAIProfile: () => Promise.resolve(mockAIProfile),
  openPendingAIPacks: (...args: unknown[]) => mockOpenPendingAIPacks(...args),
  incrementAIPerfectWarFallbackCount: (...args: unknown[]) =>
    mockIncrementAIPerfectWarFallbackCount(...args),
  saveAIMythicAssignments: (...args: unknown[]) => mockSaveAIMythics(...args),
}));

vi.mock('../sim/cards/catalog', () => ({
  loadCollectibleCards: () => [
    {
      kind: 'tough',
      id: 'mythic-01',
      name: 'Mythic One',
      tagline: '',
      archetype: 'boss',
      affiliation: 'myth',
      power: 9,
      resistance: 9,
      maxHp: 9,
      hp: 9,
      rarity: 'mythic',
      abilities: [],
    },
  ],
  loadCompiledToughs: () => [],
}));

vi.mock('../sim/turf/deck-builder', () => ({
  buildCollectionDeck: () => [{ id: 'deck-card' }],
  collectionPreferenceKey: () => 'starter-tough::common',
}));

vi.mock('../sim/turf/generators', () => ({
  loadCompiledWeapons: () => [],
  loadCompiledDrugs: () => [],
}));

vi.mock('../ui/deckbuilder/storage', () => ({
  loadActiveRun: () => Promise.resolve(null),
  loadProfile: () => Promise.resolve({ ...mockPlayerProfile }),
  loadSettings: () =>
    Promise.resolve({
      audioEnabled: true,
      motionReduced: false,
      rulesSeen: true,
      firstWarTutorialSeen: true,
    }),
  saveActiveRun: () => Promise.resolve(),
  saveProfile: (...args: unknown[]) => mockSaveProfile(...args),
  saveSettings: () => Promise.resolve(),
}));

vi.mock('../ui/filters', () => ({
  GrittyFilters: () => null,
}));

vi.mock('../ui/overlays', () => ({
  GameMenuDrawer: () => null,
  RulesModal: () => null,
  TutorialModal: () => null,
}));

vi.mock('../ui/screens', () => ({
  MainMenuScreen: ({ onNewGame }: { onNewGame: () => void }) => (
    <button data-testid="new-game-button" onClick={onNewGame}>
      New
    </button>
  ),
}));

vi.mock('../ui/screens/DifficultyScreen', () => ({
  DifficultyScreen: ({
    onSelect,
  }: {
    onSelect: (config: GameConfig) => void;
  }) => (
    <button data-testid="difficulty-start" onClick={() => onSelect(mockConfig)}>
      Start
    </button>
  ),
}));

vi.mock('../ui/screens/GameScreen', () => ({
  GameScreen: ({ onGameOver }: { onGameOver: (winner: 'A' | 'B') => void }) => (
    <button
      data-testid="finish-war-button"
      onClick={() => onGameOver(mockWinner.side)}
    >
      Finish
    </button>
  ),
}));

vi.mock('../ui/screens/GameOverScreen', () => ({
  GameOverScreen: (props: {
    rewardCards?: Array<{ id: string }>;
    rewardOutcome?: string | null;
    rewardCurrencyAmount?: number | null;
  }) => {
    mockGameOverProps.rewardCards = props.rewardCards ?? [];
    mockGameOverProps.rewardOutcome = props.rewardOutcome ?? null;
    mockGameOverProps.rewardCurrencyAmount = props.rewardCurrencyAmount ?? null;
    return (
      <div data-testid="gameover-screen">
        <div data-testid="gameover-outcome">{props.rewardOutcome}</div>
        <div data-testid="gameover-currency">{props.rewardCurrencyAmount}</div>
        <div data-testid="gameover-cards">
          {(props.rewardCards ?? []).map((card) => card.id).join(',')}
        </div>
      </div>
    );
  },
}));

vi.mock('../ui/screens/CollectionScreen', () => ({
  CollectionScreen: () => null,
}));

vi.mock('../ui/screens/CardGarageScreen', () => ({
  CardGarageScreen: () => null,
}));

vi.mock('../ui/screens/CardsScreen', () => ({
  CardsScreen: () => null,
}));

describe('App reward flow', () => {
  beforeEach(() => {
    mockWinner.side = 'A';
    mockConfig.suddenDeath = false;
    mockConfig.difficulty = 'hard';
    mockGameState.metrics.turns = 4;
    mockGameState.metrics.kills = 2;
    mockGameState.metrics.seizures = 1;
    mockGameState.mythicAssignments = {};
    mockGameState.mythicPool = [];
    mockGameState.warStats = {
      seizures: [{ seizedBy: 'A', seizedTurfIdx: 0, turnsOnThatTurf: 1 }],
    };
    mockPlayerProfile.unlockedCardIds = [];
    mockPlayerProfile.cardInstances = {};
    mockPlayerProfile.wins = 0;
    mockPlayerProfile.lastPlayedAt = null;
    mockPlayerProfile.perfectWarsAfterPoolExhaustion = 0;
    mockAIProfile.aiPerfectWarFallbackCount = 0;
    mockGameOverProps.rewardCards = [];
    mockGameOverProps.rewardOutcome = null;
    mockGameOverProps.rewardCurrencyAmount = null;
    mockRewardPackCards.length = 0;
    mockSaveProfile.mockReset();
    mockSyncPlayerMythics.mockReset();
    mockSaveAIMythics.mockReset();
    mockOpenRewardPackInstances.mockReset();
    mockAddPendingPacksToAI.mockReset();
    mockOpenPendingAIPacks.mockReset();
    mockIncrementAIPerfectWarFallbackCount.mockReset();
    mockOpenRewardPackInstances.mockImplementation(async () => [
      ...mockRewardPackCards,
    ]);
  });

  async function playWar(winner: 'A' | 'B' = 'A'): Promise<void> {
    mockWinner.side = winner;
    render(<App />);
    fireEvent.click(await screen.findByTestId('new-game-button'));
    fireEvent.click(await screen.findByTestId('difficulty-start'));
    fireEvent.click(await screen.findByTestId('finish-war-button'));
    await screen.findByTestId('gameover-screen');
  }

  it('surfaces Perfect War fallback currency instead of using the dead generic pack path', async () => {
    await playWar('A');

    await waitFor(() => {
      expect(mockGameOverProps.rewardOutcome).toBe('perfect');
      expect(mockGameOverProps.rewardCurrencyAmount).toBe(500);
    });
    expect(mockOpenRewardPackInstances).toHaveBeenCalledOnce();
    expect(mockOpenRewardPackInstances.mock.calls[0]?.[0]).toHaveLength(1);
    expect(mockOpenRewardPackInstances.mock.calls[0]?.[3]).toEqual({
      permadeath: false,
    });
    expect(mockSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        wins: 1,
        perfectWarsAfterPoolExhaustion: 1,
      }),
    );
  });

  it('adds a Perfect War mythic draw to ownership sync and the reward reveal', async () => {
    mockGameState.mythicPool = ['mythic-01'];

    await playWar('A');

    await waitFor(() => {
      expect(mockSyncPlayerMythics).toHaveBeenCalledWith(['mythic-01'], 'hard');
    });
    expect(mockSaveAIMythics).toHaveBeenCalledWith(
      { 'mythic-01': 'A' },
      'hard',
    );
    expect(mockGameOverProps.rewardCards.map((card) => card.id)).toContain(
      'mythic-01',
    );
  });

  it('preserves the war-outcome summary on losses while routing packs to the AI', async () => {
    mockGameState.warStats = {
      seizures: [{ seizedBy: 'B', seizedTurfIdx: 0, turnsOnThatTurf: 1 }],
    };
    await playWar('B');

    await waitFor(() => {
      expect(mockGameOverProps.rewardOutcome).toBe('perfect');
      expect(mockGameOverProps.rewardCurrencyAmount).toBe(500);
    });
    expect(mockGameOverProps.rewardCards).toEqual([]);
    expect(mockAddPendingPacksToAI).toHaveBeenCalledOnce();
    expect(mockOpenPendingAIPacks).toHaveBeenCalledWith(
      'hard',
      expect.any(Number),
      {
        permadeath: false,
      },
    );
    expect(mockIncrementAIPerfectWarFallbackCount).toHaveBeenCalledOnce();
  });

  it('threads permadeath into reward pack opening', async () => {
    mockConfig.suddenDeath = true;

    await playWar('A');

    await waitFor(() => {
      expect(mockOpenRewardPackInstances).toHaveBeenCalledWith(
        expect.any(Array),
        'hard',
        expect.any(Number),
        { permadeath: true },
      );
    });
  });
});
