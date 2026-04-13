import { useState } from 'react';
import type { World } from 'koota';
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

type Screen = 'menu' | 'deckbuilder' | 'buildup' | 'combat' | 'gameover';

const EMPTY_METRICS: TurfMetrics = {
  turns: 0, directAttacks: 0, fundedAttacks: 0, pushedAttacks: 0,
  kills: 0, flips: 0, seizures: 0, busts: 0, weaponsDrawn: 0,
  productPlayed: 0, cashPlayed: 0, crewPlaced: 0,
  positionsReclaimed: 0, passes: 0, buildupRoundsA: 0, buildupRoundsB: 0,
  combatRounds: 0, totalActions: 0, firstStrike: null,
};

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

  function handleNewGame() {
    setScreen('deckbuilder');
  }

  function handleStartGame() {
    const newWorld = createGameWorld();
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

  return (
    <>
      <GrittyFilters />
      {screen === 'menu' && (
        <MainMenuScreen onNewGame={handleNewGame} />
      )}
      {screen === 'deckbuilder' && (
        <DeckBuilderScreen onStartGame={handleStartGame} />
      )}
      {screen === 'buildup' && world && (
        <BuildupScreen world={world} onStrike={handleStrike} />
      )}
      {screen === 'combat' && world && (
        <CombatScreen world={world} onGameOver={handleGameOver} />
      )}
      {screen === 'gameover' && (
        <GameOverScreen winner={winner} metrics={metrics} onPlayAgain={handlePlayAgain} />
      )}
    </>
  );
}
