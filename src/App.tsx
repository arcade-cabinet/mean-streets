import type { World } from 'koota';
import { WorldProvider } from 'koota/react';
import { useEffect, useState } from 'react';
import './App.css';
import { GameState } from './ecs/traits';
import { createGameWorld } from './ecs/world';
import { randomSeed } from './sim/cards/rng';
import { processGameEnd } from './platform/achievements/achievements';
import { openRewardPacks } from './platform/persistence/collection';
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

type Screen =
  | 'menu'
  | 'difficulty'
  | 'combat'
  | 'gameover'
  | 'collection'
  | 'pack-opening'
  | 'card-garage';
type Modal = 'rules-onboarding' | 'game-menu' | null;
interface ActiveRunState {
  phase: 'combat';
  config: GameConfig;
  seed: number;
}

const EMPTY_METRICS: TurfMetrics = emptyMetrics();

function getMetricsFromWorld(world: World): TurfMetrics {
  let metrics = EMPTY_METRICS;
  world.query(GameState).updateEach(([gs]) => {
    metrics = { ...gs.metrics };
  });
  return metrics;
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
  const [_lastRewardCards, setLastRewardCards] = useState<Card[]>([]);

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
    const newWorld = createGameWorld(config, seed);
    setWorld(newWorld);
    setActiveConfig(config);
    setHasActiveRun(true);
    void saveActiveRun<ActiveRunState>({ phase: 'combat', config, seed });
    setScreen('combat');
  }

  function handleGameOver(w: 'A' | 'B') {
    const m = world ? getMetricsFromWorld(world) : EMPTY_METRICS;
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

      const playerWon = w === 'A';
      const config = activeConfig;
      if (playerWon && config) {
        const rewards = matchRewardPacks(config.difficulty, config.suddenDeath, true);
        const newCards = await openRewardPacks(rewards, config.suddenDeath);
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
          onCollection={() => setScreen('collection')}
          onOpenPack={() => setScreen('pack-opening')}
          onCardGarage={() => setScreen('card-garage')}
          canLoadGame={hasActiveRun}
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
