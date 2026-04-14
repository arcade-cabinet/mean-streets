import { useEffect, useState } from 'react';
import type { World } from 'koota';
import { WorldProvider } from 'koota/react';
import './App.css';
import { GrittyFilters } from './ui/filters';
import {
  MainMenuScreen,
  DeckGarageScreen,
  DeckBuilderScreen,
  BuildupScreen,
  CombatScreen,
  GameOverScreen,
} from './ui/screens';
import { GameMenuDrawer, RulesModal, type DrawerTab } from './ui/overlays';
import { createGameWorld } from './ecs/world';
import { GameState } from './ecs/traits';
import type { TurfMetrics } from './sim/turf/types';
import { emptyMetrics } from './sim/turf/environment';
import { resolveDeckLoadout } from './ui/deckbuilder/catalog';
import {
  loadDeckLoadouts,
  loadActiveRun,
  saveActiveRun,
  loadSettings,
  saveSettings,
  loadProfile,
  saveProfile,
  type DeckLoadout,
  type AppSettings,
} from './ui/deckbuilder/storage';
import { loadAuthoredCrewCards } from './sim/cards/catalog';
import { processGameEnd } from './platform/achievements/achievements';

type Screen = 'menu' | 'deck-garage' | 'deckbuilder' | 'buildup' | 'combat' | 'gameover';
type Modal = 'rules-onboarding' | 'game-menu' | null;
interface ActiveRunState {
  phase: 'buildup' | 'combat';
  deck: Parameters<typeof createGameWorld>[2];
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
  const [settings, setSettingsState] = useState<AppSettings>({ audioEnabled: true, motionReduced: false, rulesSeen: false });
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('settings');
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [savedDecks, setSavedDecks] = useState<DeckLoadout[]>([]);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<Parameters<typeof createGameWorld>[2] | null>(null);

  useEffect(() => {
    void Promise.all([loadSettings(), loadActiveRun<unknown>(), loadDeckLoadouts()]).then(([nextSettings, activeRun, nextDecks]) => {
      setSettingsState(nextSettings);
      setHasActiveRun(activeRun !== null);
      setSavedDecks(nextDecks);
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
    void (async () => {
      const nextDecks = await loadDeckLoadouts();
      setSavedDecks(nextDecks);
      setModal(null);
      setEditingDeckId(null);
      setScreen(nextDecks.length === 0 ? 'deckbuilder' : 'deck-garage');
    })();
  }

  function handleConfirmRulesOnboarding() {
    void (async () => {
      const next = { ...settings, rulesSeen: true };
      const nextDecks = await loadDeckLoadouts();
      setSettingsState(next);
      setSavedDecks(nextDecks);
      await saveSettings(next);
      setModal(null);
      setEditingDeckId(null);
      setScreen(nextDecks.length === 0 ? 'deckbuilder' : 'deck-garage');
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

      const resumedWorld = createGameWorld(undefined, undefined, activeRun.deck);
      setActiveDeck(activeRun.deck);
      setWorld(resumedWorld);
      setScreen(activeRun.phase);
    })();
  }

  function handleCreateDeck() {
    setEditingDeckId(null);
    setScreen('deckbuilder');
  }

  function handleEditDeck(deckId: string) {
    setEditingDeckId(deckId);
    setScreen('deckbuilder');
  }

  function handlePlayDeck(deckId: string) {
    const loadout = savedDecks.find((entry) => entry.id === deckId);
    if (!loadout) return;
    const runtimeDeck = resolveDeckLoadout(loadout);
    handleStartGame(runtimeDeck);
  }

  function handleStartGame(runtimeDeck: Parameters<typeof createGameWorld>[2]) {
    if (!runtimeDeck) return;
    const newWorld = createGameWorld(undefined, undefined, runtimeDeck);
    setActiveDeck(runtimeDeck);
    setWorld(newWorld);
    setHasActiveRun(true);
    void saveActiveRun<ActiveRunState>({ phase: 'buildup', deck: runtimeDeck });
    setScreen('buildup');
  }

  function handleStrike() {
    if (activeDeck) {
      void saveActiveRun<ActiveRunState>({ phase: 'combat', deck: activeDeck });
    }
    setScreen('combat');
  }

  function handleGameOver(w: 'A' | 'B') {
    const m = world ? getMetricsFromWorld(world) : EMPTY_METRICS;
    setWinner(w);
    setMetrics(m);
    setActiveDeck(null);
    setHasActiveRun(false);
    void saveActiveRun<ActiveRunState>(null);
    // Process achievements on game-end: wins counter + unlock conditions.
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
        loadAuthoredCrewCards(),
        profile,
      );
      await saveProfile(result.updatedProfile);
    })();
    setScreen('gameover');
  }

  function handlePlayAgain() {
    setWorld(null);
    setActiveDeck(null);
    setHasActiveRun(false);
    void saveActiveRun<ActiveRunState>(null);
    setScreen('deckbuilder');
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
          canLoadGame={hasActiveRun}
        />
      )}

      {screen === 'deck-garage' && (
        <DeckGarageScreen
          loadouts={savedDecks}
          onCreateDeck={handleCreateDeck}
          onEditDeck={handleEditDeck}
          onPlayDeck={handlePlayDeck}
          onBack={() => setScreen('menu')}
        />
      )}

      {screen === 'deckbuilder' && (
        <DeckBuilderScreen
          onBack={() => setScreen(savedDecks.length > 0 ? 'deck-garage' : 'menu')}
          onStartGame={handleStartGame}
          initialDeckId={editingDeckId}
          onDecksChanged={setSavedDecks}
        />
      )}

      {world && (screen === 'buildup' || screen === 'combat') && (
        <WorldProvider world={world}>
          {screen === 'buildup' && (
            <BuildupScreen world={world} onStrike={handleStrike} onOpenMenu={() => handleOpenGameMenu('settings')} />
          )}
          {screen === 'combat' && (
            <CombatScreen world={world} onGameOver={handleGameOver} onOpenMenu={() => handleOpenGameMenu('settings')} />
          )}
        </WorldProvider>
      )}

      {screen === 'gameover' && (
        <GameOverScreen winner={winner} metrics={metrics} onPlayAgain={handlePlayAgain} />
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
