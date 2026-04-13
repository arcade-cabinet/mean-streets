import { useEffect, useState, type ReactNode } from 'react';
import type { World } from 'koota';
import { WorldProvider } from 'koota/react';
import './App.css';
import { GrittyFilters } from './ui/filters';
import {
  MainMenuScreen,
  DeckBuilderScreen,
  BuildupScreen,
  CombatScreen,
  GameOverScreen,
} from './ui/screens';
import { createGameWorld } from './ecs/world';
import { GameState } from './ecs/traits';
import type { TurfMetrics } from './sim/turf/types';
import { emptyMetrics } from './sim/turf/environment';
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from './ui/deckbuilder/storage';

type Screen = 'menu' | 'deckbuilder' | 'buildup' | 'combat' | 'gameover';
type Modal = 'settings' | null;

const EMPTY_METRICS: TurfMetrics = emptyMetrics();

function getMetricsFromWorld(world: World): TurfMetrics {
  let metrics = EMPTY_METRICS;
  world.query(GameState).updateEach(([gs]) => {
    metrics = { ...gs.metrics };
  });
  return metrics;
}

interface ModalFrameProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}

function ModalFrame({ title, subtitle, onClose, children }: ModalFrameProps) {
  return (
    <div className="app-modal-backdrop" role="presentation">
      <div className="app-modal">
        <div className="app-modal-header">
          <div>
            <p className="app-modal-kicker">{subtitle}</p>
            <h2 className="app-modal-title">{title}</h2>
          </div>
          <button className="app-modal-close" onClick={onClose} aria-label="Close modal">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface SettingsModalProps {
  settings: AppSettings;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}

function SettingsModal({ settings, onClose, onChange }: SettingsModalProps) {
  return (
    <ModalFrame title="Settings" subtitle="Brand Controls" onClose={onClose}>
      <div className="app-modal-body">
        <label className="settings-row">
          <div>
            <span className="settings-label">Audio Enabled</span>
            <p className="settings-copy">Preserves the noir soundscape toggle for future audio work.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.audioEnabled}
            onChange={(event) => onChange({ ...settings, audioEnabled: event.target.checked })}
          />
        </label>
        <label className="settings-row">
          <div>
            <span className="settings-label">Reduced Motion</span>
            <p className="settings-copy">Tones down presentation movement and heavy transitions.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.motionReduced}
            onChange={(event) => onChange({ ...settings, motionReduced: event.target.checked })}
          />
        </label>
      </div>
      <div className="app-modal-actions">
        <button className="menu-button menu-button-primary" onClick={onClose} data-testid="close-settings-button">
          <span className="menu-button-label">Done</span>
        </button>
      </div>
    </ModalFrame>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [world, setWorld] = useState<World | null>(null);
  const [winner, setWinner] = useState<'A' | 'B'>('A');
  const [metrics, setMetrics] = useState<TurfMetrics>(EMPTY_METRICS);
  const [modal, setModal] = useState<Modal>(null);
  const [settings, setSettingsState] = useState<AppSettings>({ audioEnabled: true, motionReduced: false });

  useEffect(() => {
    void loadSettings().then(setSettingsState);
  }, []);

  function handleOpenSettings() {
    setModal('settings');
  }

  function handleOpenNewGame() {
    setModal(null);
    setScreen('deckbuilder');
  }

  function handleStartGame(runtimeDeck: Parameters<typeof createGameWorld>[2]) {
    if (!runtimeDeck) return;
    const newWorld = createGameWorld(undefined, undefined, runtimeDeck);
    setWorld(newWorld);
    setScreen('buildup');
  }

  function handleStrike() {
    setScreen('combat');
  }

  function handleGameOver(w: 'A' | 'B') {
    const m = world ? getMetricsFromWorld(world) : EMPTY_METRICS;
    setWinner(w);
    setMetrics(m);
    setScreen('gameover');
  }

  function handlePlayAgain() {
    setWorld(null);
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
          onSettings={handleOpenSettings}
        />
      )}

      {screen === 'deckbuilder' && (
        <DeckBuilderScreen
          onBack={() => setScreen('menu')}
          onStartGame={handleStartGame}
        />
      )}

      {world && (screen === 'buildup' || screen === 'combat') && (
        <WorldProvider world={world}>
          {screen === 'buildup' && (
            <BuildupScreen world={world} onStrike={handleStrike} />
          )}
          {screen === 'combat' && (
            <CombatScreen world={world} onGameOver={handleGameOver} />
          )}
        </WorldProvider>
      )}

      {screen === 'gameover' && (
        <GameOverScreen winner={winner} metrics={metrics} onPlayAgain={handlePlayAgain} />
      )}

      {modal === 'settings' && (
        <SettingsModal
          settings={settings}
          onClose={() => setModal(null)}
          onChange={handleSettingsChange}
        />
      )}
    </>
  );
}
