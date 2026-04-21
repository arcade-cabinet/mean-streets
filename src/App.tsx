import type { World } from 'koota';
import { WorldProvider } from 'koota/react';
import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import './App.css';
import { GameState } from './ecs/traits';
import { createGameWorld } from './ecs/world';
import { createRng, randomSeed, type Rng } from './sim/cards/rng';
import {
  ownPositionsLostFromWarStats,
  processGameEnd,
} from './platform/achievements/achievements';
import {
  loadCollectionInventory,
  loadPreferences,
  loadPlayerOwnedMythicIds,
  openRewardPackInstances,
  syncPlayerMythicOwnership,
} from './platform/persistence/collection';
import {
  addPendingPacksToAI,
  grantAIStarterCollection,
  loadAICollection,
  loadAIOwedMythicIds,
  loadAIProfile,
  openPendingAIPacks,
  incrementAIPerfectWarFallbackCount,
  saveAIMythicAssignments,
} from './platform/persistence/ai-profile';
import { loadCollectibleCards, loadCompiledToughs } from './sim/cards/catalog';
import {
  buildCollectionDeck,
  collectionPreferenceKey,
} from './sim/turf/deck-builder';
import { loadCompiledWeapons, loadCompiledDrugs } from './sim/turf/generators';
import {
  computeRewardBundle,
  flattenRewardBundlePacks,
  type PackInstance,
  type WarOutcome,
} from './sim/packs';
import { emptyMetrics } from './sim/turf/environment';
import type { Card, GameConfig, TurfMetrics, WarStats } from './sim/turf/types';
import {
  type AppSettings,
  loadActiveRun,
  loadProfile,
  loadSettings,
  saveActiveRun,
  saveProfile,
  saveSettings,
} from './ui/deckbuilder/storage';
import { GrittyFilters } from './ui/filters';
import { type DrawerTab, GameMenuDrawer, RulesModal } from './ui/overlays';
import {
  MainMenuScreen,
} from './ui/screens';

const CardsScreen = lazy(async () => {
  const mod = await import('./ui/screens/CardsScreen');
  return { default: mod.CardsScreen };
});

const CardGarageScreen = lazy(async () => {
  const mod = await import('./ui/screens/CardGarageScreen');
  return { default: mod.CardGarageScreen };
});

const CollectionScreen = lazy(async () => {
  const mod = await import('./ui/screens/CollectionScreen');
  return { default: mod.CollectionScreen };
});

const DifficultyScreen = lazy(async () => {
  const mod = await import('./ui/screens/DifficultyScreen');
  return { default: mod.DifficultyScreen };
});

const GameOverScreen = lazy(async () => {
  const mod = await import('./ui/screens/GameOverScreen');
  return { default: mod.GameOverScreen };
});

const GameScreen = lazy(async () => {
  const mod = await import('./ui/screens/GameScreen');
  return { default: mod.GameScreen };
});

type Screen =
  | 'menu'
  | 'cards'
  | 'difficulty'
  | 'combat'
  | 'gameover'
  | 'collection'
  | 'card-garage';
type Modal = 'rules-onboarding' | 'game-menu' | null;
// Bumped whenever sim behavior changes in a way that would make a
// seed-based resume reconstruct a different game state than the user saw
// before closing the app. Any PR that touches resolve.ts, attacks.ts, or
// the tunables in turf-sim.json that affect gameplay must bump this.
const SIM_VERSION = 'v0.3-1.1.0-beta.2';

interface ActiveRunState {
  phase: 'combat';
  config: GameConfig;
  seed: number;
  playerDeck: Card[];
  aiDeck: Card[];
  simVersion: string;
}

const EMPTY_METRICS: TurfMetrics = emptyMetrics();

interface GameOverRewards {
  cards: Card[];
  outcome: WarOutcome | null;
  currencyAmount: number | null;
}

interface WorldOutcomeSnapshot {
  metrics: TurfMetrics;
  mythicAssignments: Record<string, 'A' | 'B'>;
  mythicPool: string[];
  warStats: WarStats;
  rng: Rng;
}

const EMPTY_GAME_OVER_REWARDS: GameOverRewards = {
  cards: [],
  outcome: null,
  currencyAmount: null,
};

function ScreenBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

const COLLECTIBLE_CARD_MAP = buildCardCatalogMap();

function buildCardCatalogMap(): Map<string, Card> {
  return new Map(loadCollectibleCards().map((card) => [card.id, card]));
}

function getOutcomeSnapshotFromWorld(world: World | null): WorldOutcomeSnapshot {
  if (!world) {
    return {
      metrics: EMPTY_METRICS,
      mythicAssignments: {},
      mythicPool: [],
      warStats: { seizures: [] },
      rng: createRng(randomSeed()),
    };
  }

  let metrics = EMPTY_METRICS;
  let mythicAssignments: Record<string, 'A' | 'B'> = {};
  let mythicPool: string[] = [];
  let warStats: WarStats = { seizures: [] };
  let rng: Rng = createRng(randomSeed());

  world.query(GameState).updateEach(([gs]) => {
    metrics = { ...gs.metrics };
    mythicAssignments = { ...gs.mythicAssignments };
    mythicPool = [...gs.mythicPool];
    warStats = {
      seizures: gs.warStats.seizures.map((seizure) => ({ ...seizure })),
    };
    rng = gs.rng;
  });

  return { metrics, mythicAssignments, mythicPool, warStats, rng };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [world, setWorld] = useState<World | null>(null);
  const [winner, setWinner] = useState<'A' | 'B'>('A');
  const [metrics, setMetrics] = useState<TurfMetrics>(EMPTY_METRICS);
  const [modal, setModal] = useState<Modal>(null);
  const [settings, setSettingsState] = useState<AppSettings>({
    audioEnabled: true,
    motionReduced: false,
    rulesSeen: false,
  });
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('settings');
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [activeConfig, setActiveConfig] = useState<GameConfig | null>(null);
  const [lastRewards, setLastRewards] = useState<GameOverRewards>(
    EMPTY_GAME_OVER_REWARDS,
  );

  useEffect(() => {
    void Promise.all([loadSettings(), loadActiveRun<unknown>()]).then(
      ([nextSettings, activeRun]) => {
        setSettingsState(nextSettings);
        setHasActiveRun(activeRun !== null);
      },
    );
  }, []);

  function handleOpenGameMenu(tab: DrawerTab = 'settings') {
    setDrawerTab(tab);
    setModal('game-menu');
  }

  function handleOpenNewGame() {
    if (!settings.rulesSeen) {
      setModal('rules-onboarding');
      return;
    }
    setModal(null);
    setScreen('difficulty');
  }

  function handleConfirmRulesOnboarding() {
    void (async () => {
      const next = { ...settings, rulesSeen: true };
      setSettingsState(next);
      await saveSettings(next);
      setModal(null);
      setScreen('difficulty');
    })();
  }

  function handleLoadGame() {
    if (!hasActiveRun) return;
    void (async () => {
      const activeRun = await loadActiveRun<ActiveRunState>();
      if (!activeRun) {
        setHasActiveRun(false);
        return;
      }
      // Sim-version check: a save written by a prior sim version would
      // replay to a different world state than the user left. Discard
      // rather than silently misrepresent progress.
      if (activeRun.simVersion !== SIM_VERSION) {
        await saveActiveRun<ActiveRunState>(null);
        setHasActiveRun(false);
        return;
      }
      const [playerMythicIds, aiMythicIds] = await Promise.all([
        loadPlayerOwnedMythicIds(),
        loadAIOwedMythicIds(),
      ]);
      const resumedWorld = createGameWorld(
        activeRun.config,
        activeRun.seed,
        activeRun.playerDeck,
        { A: playerMythicIds, B: aiMythicIds },
        activeRun.aiDeck,
        { preserveDeckOrder: true },
      );
      setWorld(resumedWorld);
      setActiveConfig(activeRun.config);
      setScreen(activeRun.phase);
    })();
  }

  function handleSelectDifficulty(config: GameConfig) {
    const seed = randomSeed();
    void (async () => {
      await grantAIStarterCollection(createRng(seed * 5 + 11));

      // Load owned mythics from both profiles so the new match starts with
      // the correct global-exclusivity state (RULES §11).
      const [playerMythicIds, aiMythicIds, playerInventory, aiCollection] =
        await Promise.all([
          loadPlayerOwnedMythicIds(),
          loadAIOwedMythicIds(),
          loadCollectionInventory(),
          loadAICollection(),
        ]);
      const playerPreferences = await loadPreferences(
        [...new Set(playerInventory.map(({ card }) => collectionPreferenceKey(card)))],
      );
      const playerDeck = buildCollectionDeck(
        playerInventory.map(({ card }) => card),
        createRng(seed * 2 + 1),
        playerPreferences,
      );
      const aiDeck = buildCollectionDeck(
        aiCollection,
        createRng(seed * 3 + 7),
      );
      const newWorld = createGameWorld(
        config,
        seed,
        playerDeck,
        {
          A: playerMythicIds,
          B: aiMythicIds,
        },
        aiDeck,
        { preserveDeckOrder: true },
      );
      setWorld(newWorld);
      setActiveConfig(config);
      setHasActiveRun(true);
      void saveActiveRun<ActiveRunState>({
        phase: 'combat',
        config,
        seed,
        playerDeck,
        aiDeck,
        simVersion: SIM_VERSION,
      });
      setScreen('combat');
    })();
  }

  function handleGameOver(w: 'A' | 'B') {
    const { metrics: nextMetrics, mythicAssignments, mythicPool, warStats, rng } =
      getOutcomeSnapshotFromWorld(world);
    const config = activeConfig;
    const unlockDifficulty = config?.difficulty ?? 'easy';
    const playerWon = w === 'A';
    const winnerSide: 'A' | 'B' = playerWon ? 'A' : 'B';
    setWinner(w);
    setMetrics(nextMetrics);
    setHasActiveRun(false);
    setLastRewards(EMPTY_GAME_OVER_REWARDS);
    void saveActiveRun<ActiveRunState>(null);
    void (async () => {
      const [profile, aiProfile] = await Promise.all([
        loadProfile(),
        loadAIProfile(),
      ]);
      const result = processGameEnd(
        {
          winner: w,
          playerSide: 'A',
          metrics: nextMetrics,
          turnCount: nextMetrics.turns,
          ownPositionsLost: ownPositionsLostFromWarStats(warStats, 'A'),
          unlockDifficulty,
        },
        [
          ...loadCompiledToughs(),
          ...loadCompiledWeapons(),
          ...loadCompiledDrugs(),
        ],
        profile,
      );

      const nextMythicAssignments = { ...mythicAssignments };
      let rewardCards: Card[] = [];
      let rewardOutcome: WarOutcome | null = null;
      let rewardCurrencyAmount: number | null = null;
      let rewardPacks: PackInstance[] = [];

      if (config) {
        const perfectWarFallbackCount =
          playerWon
            ? result.updatedProfile.perfectWarsAfterPoolExhaustion ?? 0
            : aiProfile.aiPerfectWarFallbackCount;
        const bundle = computeRewardBundle(
          warStats,
          true,
          [...mythicPool],
          rng,
          winnerSide,
          perfectWarFallbackCount,
        );
        rewardPacks = flattenRewardBundlePacks(bundle);
        rewardOutcome = bundle.warOutcomeReward.outcome;
        rewardCurrencyAmount = bundle.warOutcomeReward.escalatingCurrency;

        if (bundle.warOutcomeReward.mythicDraw) {
          nextMythicAssignments[bundle.warOutcomeReward.mythicDraw] = winnerSide;
          if (playerWon) {
            const mythicCard = COLLECTIBLE_CARD_MAP.get(
              bundle.warOutcomeReward.mythicDraw,
            );
            if (mythicCard) rewardCards = [mythicCard];
          }
        }

        if (playerWon && rewardCurrencyAmount !== null) {
          result.updatedProfile.perfectWarsAfterPoolExhaustion =
            perfectWarFallbackCount + 1;
        }
      }

      await saveProfile(result.updatedProfile);

      // Sync mythic ownership to both profiles (RULES §11).
      // mythicAssignments maps cardId → 'A'|'B'; A = player, B = AI.
      const playerMythicIds = Object.entries(nextMythicAssignments)
        .filter(([, side]) => side === 'A')
        .map(([id]) => id);
      await Promise.all([
        syncPlayerMythicOwnership(
          playerMythicIds,
          unlockDifficulty,
        ),
        saveAIMythicAssignments(
          nextMythicAssignments,
          unlockDifficulty,
        ),
      ]);

      if (config) {
        const rewardOpenSeed =
          rewardPacks.length > 0 ? rng.int(1, 2147483646) : undefined;
        if (playerWon) {
          const packCards = await openRewardPackInstances(
            rewardPacks,
            config.difficulty,
            rewardOpenSeed,
          );
          rewardCards = [...rewardCards, ...packCards];
          setLastRewards({
            cards: rewardCards,
            outcome: rewardOutcome,
            currencyAmount: rewardCurrencyAmount,
          });
        } else {
          await addPendingPacksToAI(rewardPacks);
          await openPendingAIPacks(config.difficulty, rewardOpenSeed);
          if (rewardCurrencyAmount !== null) {
            await incrementAIPerfectWarFallbackCount();
          }
          setLastRewards({
            cards: [],
            outcome: rewardOutcome,
            currencyAmount: rewardCurrencyAmount,
          });
        }
      }
    })();
    setScreen('gameover');
  }

  function handlePlayAgain() {
    setWorld(null);
    setHasActiveRun(false);
    setLastRewards(EMPTY_GAME_OVER_REWARDS);
    void saveActiveRun<ActiveRunState>(null);
    setScreen('difficulty');
  }

  function handleSettingsChange(next: AppSettings) {
    setSettingsState(next);
    void saveSettings(next);
  }

  return (
    <>
      <GrittyFilters />

      {screen === 'menu' && (
        <MainMenuScreen
          onNewGame={handleOpenNewGame}
          onLoadGame={handleLoadGame}
          onCollection={() => setScreen('collection')}
          onGarage={() => setScreen('card-garage')}
          onCards={() => setScreen('cards')}
          canLoadGame={hasActiveRun}
        />
      )}

      {screen === 'cards' && (
        <ScreenBoundary>
          <CardsScreen
            onBack={() => setScreen('menu')}
            onStartGame={() => setScreen('difficulty')}
          />
        </ScreenBoundary>
      )}

      {screen === 'card-garage' && (
        <ScreenBoundary>
          <CardGarageScreen onBack={() => setScreen('menu')} />
        </ScreenBoundary>
      )}

      {screen === 'difficulty' && (
        <ScreenBoundary>
          <DifficultyScreen
            onSelect={handleSelectDifficulty}
            onBack={() => setScreen('menu')}
          />
        </ScreenBoundary>
      )}

      {screen === 'collection' && (
        <ScreenBoundary>
          <CollectionScreen onBack={() => setScreen('menu')} />
        </ScreenBoundary>
      )}

      {world && screen === 'combat' && (
        <ScreenBoundary>
          <WorldProvider world={world}>
            <GameScreen
              world={world}
              onGameOver={handleGameOver}
              onOpenMenu={() => handleOpenGameMenu('settings')}
            />
          </WorldProvider>
        </ScreenBoundary>
      )}

      {screen === 'gameover' && (
        <ScreenBoundary>
          <GameOverScreen
            winner={winner}
            metrics={metrics}
            rewardCards={lastRewards.cards}
            rewardOutcome={lastRewards.outcome}
            rewardCurrencyAmount={lastRewards.currencyAmount}
            rewardUnlockDifficulty={activeConfig?.difficulty}
            onPlayAgain={handlePlayAgain}
          />
        </ScreenBoundary>
      )}

      {modal === 'rules-onboarding' && (
        <RulesModal onClose={handleConfirmRulesOnboarding} />
      )}

      {modal === 'game-menu' && (
        <GameMenuDrawer
          settings={settings}
          activeTab={drawerTab}
          onSelectTab={setDrawerTab}
          onClose={() => setModal(null)}
          onChangeSettings={handleSettingsChange}
        />
      )}
    </>
  );
}
