import type { World } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect, useState } from 'react';
import './App.css';
import { GameState } from './ecs/traits';
import { createGameWorld } from './ecs/world';
import { randomSeed } from './sim/cards/rng';
import { processGameEnd } from './platform/achievements/achievements';
import {
  loadPlayerOwnedMythicIds,
  openRewardPacks,
  syncPlayerMythicOwnership,
} from './platform/persistence/collection';
import {
  loadAIOwedMythicIds,
  saveAIMythicAssignments,
} from './platform/persistence/ai-profile';
import { loadCompiledToughs } from './sim/cards/catalog';
import { loadCompiledWeapons, loadCompiledDrugs } from './sim/turf/generators';
import { matchRewardPacks } from './sim/packs/generator';
import { emptyMetrics } from './sim/turf/environment';
import type { Card, GameConfig, TurfMetrics } from './sim/turf/types';
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
  CollectionScreen,
  DifficultyScreen,
  GameOverScreen,
  CardGarageScreen,
  GameScreen,
  MainMenuScreen,
  PackOpeningScreen,
} from './ui/screens';
import { CardsScreen } from './ui/screens/CardsScreen';

type Screen =
  | 'menu'
  | 'cards'
  | 'difficulty'
  | 'combat'
  | 'gameover'
  | 'collection'
  | 'pack-opening'
  | 'card-garage';
type Modal = 'rules-onboarding' | 'game-menu' | null;
// Bumped whenever sim behavior changes in a way that would make a
// seed-based resume reconstruct a different game state than the user saw
// before closing the app. Any PR that touches resolve.ts, attacks.ts, or
// the tunables in turf-sim.json that affect gameplay must bump this.
const SIM_VERSION = 'v0.3-1.0.0-beta.1';

interface ActiveRunState {
  phase: 'combat';
  config: GameConfig;
  seed: number;
  simVersion: string;
}

const EMPTY_METRICS: TurfMetrics = emptyMetrics();

function getMetricsFromWorld(world: World): TurfMetrics {
  let metrics = EMPTY_METRICS;
  world.query(GameState).updateEach(([gs]) => {
    metrics = { ...gs.metrics };
  });
  return metrics;
}

function getMythicAssignmentsFromWorld(world: World): Record<string, 'A' | 'B'> {
  let assignments: Record<string, 'A' | 'B'> = {};
  world.query(GameState).updateEach(([gs]) => {
    assignments = { ...gs.mythicAssignments };
  });
  return assignments;
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
  const [lastRewardCards, setLastRewardCards] = useState<Card[]>([]);

  useEffect(() => {
    void Promise.all([
      loadSettings(),
      loadActiveRun<unknown>(),
    ]).then(([nextSettings, activeRun]) => {
      setSettingsState(nextSettings);
      setHasActiveRun(activeRun !== null);
    });
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
      // Resume from seed only — the seed-driven shuffle in createGameWorld
      // deterministically reproduces the original deck order without
      // persisting the full card array.
      const resumedWorld = createGameWorld(activeRun.config, activeRun.seed);
      setWorld(resumedWorld);
      setActiveConfig(activeRun.config);
      setScreen(activeRun.phase);
    })();
  }

  function handleSelectDifficulty(config: GameConfig) {
    const seed = randomSeed();
    void (async () => {
      // Load owned mythics from both profiles so the new match starts with
      // the correct global-exclusivity state (RULES §11).
      const [playerMythicIds, aiMythicIds] = await Promise.all([
        loadPlayerOwnedMythicIds(),
        loadAIOwedMythicIds(),
      ]);
      const newWorld = createGameWorld(config, seed, undefined, {
        A: playerMythicIds,
        B: aiMythicIds,
      });
      setWorld(newWorld);
      setActiveConfig(config);
      setHasActiveRun(true);
      void saveActiveRun<ActiveRunState>({ phase: 'combat', config, seed, simVersion: SIM_VERSION });
      setScreen('combat');
    })();
  }

  function handleGameOver(w: 'A' | 'B') {
    const m = world ? getMetricsFromWorld(world) : EMPTY_METRICS;
    const mythicAssignments = world ? getMythicAssignmentsFromWorld(world) : {};
    setWinner(w);
    setMetrics(m);
    setHasActiveRun(false);
    void saveActiveRun<ActiveRunState>(null);
    void (async () => {
      const profile = await loadProfile();
      const result = processGameEnd(
        {
          winner: w,
          playerSide: 'A',
          metrics: m,
          turnCount: m.turns,
          ownPositionsLost: 0,
        },
        [...loadCompiledToughs(), ...loadCompiledWeapons(), ...loadCompiledDrugs()],
        profile,
      );
      await saveProfile(result.updatedProfile);

      // Sync mythic ownership to both profiles (RULES §11).
      // mythicAssignments maps cardId → 'A'|'B'; A = player, B = AI.
      const playerMythicIds = Object.entries(mythicAssignments)
        .filter(([, side]) => side === 'A')
        .map(([id]) => id);
      const config = activeConfig;
      await Promise.all([
        syncPlayerMythicOwnership(playerMythicIds, config?.difficulty ?? 'easy'),
        saveAIMythicAssignments(mythicAssignments),
      ]);

      const playerWon = w === 'A';
      if (playerWon && config) {
        const rewards = matchRewardPacks(config.difficulty, false, true);
        const newCards = await openRewardPacks(rewards, config.difficulty);
        setLastRewardCards(newCards);
      } else {
        setLastRewardCards([]);
      }
    })();
    setScreen('gameover');
  }

  function handlePlayAgain() {
    setWorld(null);
    setHasActiveRun(false);
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
          onCards={() => setScreen('cards')}
          canLoadGame={hasActiveRun}
        />
      )}

      {screen === 'cards' && (
        <CardsScreen
          onBack={() => setScreen('menu')}
          onStartGame={() => setScreen('difficulty')}
        />
      )}

      {screen === 'card-garage' && (
        <CardGarageScreen onBack={() => setScreen('menu')} />
      )}

      {screen === 'difficulty' && (
        <DifficultyScreen
          onSelect={handleSelectDifficulty}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'collection' && (
        <CollectionScreen onBack={() => setScreen('menu')} />
      )}

      {screen === 'pack-opening' && (
        <PackOpeningScreen onBack={() => setScreen('collection')} />
      )}

      {world && screen === 'combat' && (
        <WorldProvider world={world}>
          <GameScreen
            world={world}
            onGameOver={handleGameOver}
            onOpenMenu={() => handleOpenGameMenu('settings')}
          />
        </WorldProvider>
      )}

      {screen === 'gameover' && (
        <GameOverScreen
          winner={winner}
          metrics={metrics}
          rewardCards={lastRewardCards}
          onPlayAgain={handlePlayAgain}
        />
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
