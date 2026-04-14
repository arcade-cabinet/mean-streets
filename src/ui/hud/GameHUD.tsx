import { Menu } from 'lucide-react';
import { useGamePhase, useActionBudget, usePlayerBoard, useHand } from '../../ecs/hooks';
import { seizedCount } from '../../sim/turf/board';
import { PhaseIndicator } from './PhaseIndicator';
import { ActionBudget } from './ActionBudget';

const POSITIONS_TOTAL = 5;

interface GameHUDProps {
  onOpenMenu?: () => void;
}

export function GameHUD({ onOpenMenu }: GameHUDProps) {
  const phase = useGamePhase();
  const budget = useActionBudget();
  const playerPositions = usePlayerBoard('A');
  const oppPositions = usePlayerBoard('B');
  const playerHand = useHand('A');

  const playerSeized = seizedCount({ active: playerPositions, reserve: [] });
  const oppSeized = seizedCount({ active: oppPositions, reserve: [] });

  const isPlayerTurn = true; // placeholder — replace with turn-side hook when available

  return (
    <div className="game-hud">
      <PhaseIndicator phase={phase} turnNumber={0} />

      {phase === 'combat' && (
        <ActionBudget remaining={budget.remaining} total={budget.total} />
      )}

      <div className="game-hud-pill">
        <span className="game-hud-pill-label">Deck</span>
        <span className="game-hud-pill-value">{playerHand.crew.length}</span>
        <span className="game-hud-pill-separator">/</span>
        <span className="game-hud-pill-alt">{playerHand.modifiers.length}</span>
        <span className="game-hud-pill-separator">/</span>
        <span className="game-hud-pill-alt">{playerHand.backpacks.length}</span>
      </div>

      <div className="game-hud-score">
        <span className="game-hud-score-label">You</span>
        <span className="game-hud-score-value">{playerSeized}/{POSITIONS_TOTAL}</span>
        <span className="game-hud-score-divider" aria-hidden="true" />
        <span className="game-hud-score-label game-hud-score-label-opp">Opp</span>
        <span className="game-hud-score-value game-hud-score-value-opp">{oppSeized}/{POSITIONS_TOTAL}</span>
        <span className="game-hud-score-trailer">seized</span>
      </div>

      <div className={`game-hud-status ${isPlayerTurn ? 'game-hud-status-live' : 'game-hud-status-muted'}`}>
        {isPlayerTurn ? 'YOUR TURN' : 'OPPONENT THINKING...'}
      </div>

      {onOpenMenu && (
        <button className="game-hud-menu-button" onClick={onOpenMenu} data-testid="game-menu-button" aria-label="Open game menu">
          <Menu size={18} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
