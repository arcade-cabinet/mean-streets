import {
  AlertTriangle,
  ArrowLeft,
  Flame,
  Shield,
  Skull,
  Swords,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import simConfig from '../../data/ai/turf-sim.json';
import { useAppShell } from '../../platform';
import type { DifficultyTier, GameConfig } from '../../sim/turf/types';

interface DifficultyScreenProps {
  onSelect: (config: GameConfig) => void;
  onBack: () => void;
}

interface TierDef {
  id: DifficultyTier;
  label: string;
  icon: typeof Shield;
  turfs: number;
  actions: number;
  forcedSuddenDeath: boolean;
  tagline: string;
}

const TIERS: TierDef[] = [
  {
    id: 'easy',
    label: 'Easy',
    icon: Shield,
    turfs: simConfig.difficulty.easy.turfCount,
    actions: simConfig.difficulty.easy.actionsPerTurn,
    forcedSuddenDeath: false,
    tagline: 'Loose AI, forgiving board',
  },
  {
    id: 'medium',
    label: 'Medium',
    icon: Swords,
    turfs: simConfig.difficulty.medium.turfCount,
    actions: simConfig.difficulty.medium.actionsPerTurn,
    forcedSuddenDeath: false,
    tagline: 'Balanced fight',
  },
  {
    id: 'hard',
    label: 'Hard',
    icon: Flame,
    turfs: simConfig.difficulty.hard.turfCount,
    actions: simConfig.difficulty.hard.actionsPerTurn,
    forcedSuddenDeath: false,
    tagline: 'AI gets +1 action',
  },
  {
    id: 'nightmare',
    label: 'Nightmare',
    icon: Skull,
    turfs: simConfig.difficulty.nightmare.turfCount,
    actions: simConfig.difficulty.nightmare.actionsPerTurn,
    forcedSuddenDeath: false,
    tagline: 'You lose 1 action',
  },
  {
    id: 'sudden-death',
    label: 'Sudden Death',
    icon: Zap,
    turfs: simConfig.difficulty['sudden-death'].turfCount,
    actions: simConfig.difficulty['sudden-death'].actionsPerTurn,
    forcedSuddenDeath: true,
    tagline: '1 turf, one seizure ends it',
  },
  {
    id: 'ultra-nightmare',
    label: 'Ultra-Nightmare',
    icon: AlertTriangle,
    turfs: simConfig.difficulty['ultra-nightmare'].turfCount,
    actions: simConfig.difficulty['ultra-nightmare'].actionsPerTurn,
    forcedSuddenDeath: true,
    tagline: '2-ply AI + sudden death',
  },
];

function buildConfig(tier: DifficultyTier, suddenDeath: boolean): GameConfig {
  const raw = simConfig.difficulty[tier];
  return {
    difficulty: tier,
    suddenDeath:
      tier === 'sudden-death' || tier === 'ultra-nightmare' || suddenDeath,
    turfCount: raw.turfCount,
    actionsPerTurn: raw.actionsPerTurn,
    firstTurnActions: raw.firstTurnActions,
  };
}

export function DifficultyScreen({ onSelect, onBack }: DifficultyScreenProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const [selected, setSelected] = useState<DifficultyTier>('medium');
  const [suddenDeath, setSuddenDeath] = useState(false);

  const selectedTier = TIERS.find((t) => t.id === selected)!;
  const sdForced = selectedTier.forcedSuddenDeath;
  const sdActive = sdForced || suddenDeath;

  function handleSelect(tier: DifficultyTier) {
    setSelected(tier);
    const def = TIERS.find((t) => t.id === tier)!;
    if (def.forcedSuddenDeath) {
      setSuddenDeath(true);
    }
  }

  function handleStart() {
    onSelect(buildConfig(selected, sdActive));
  }

  return (
    <main
      className="diff-shell"
      data-testid="difficulty-screen"
      aria-label="Choose Difficulty"
    >
      <div className="diff-header">
        <button
          className="diff-back"
          onClick={onBack}
          aria-label="Back to menu"
          data-testid="diff-back"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="diff-title">Choose Difficulty</h2>
      </div>

      <div
        className={`diff-grid ${compact ? 'diff-grid-compact' : ''}`}
        role="radiogroup"
        aria-label="Difficulty tiers"
      >
        {TIERS.map((tier) => {
          const Icon = tier.icon;
          const isSelected = selected === tier.id;
          return (
            <button
              key={tier.id}
              role="radio"
              aria-checked={isSelected}
              className={`diff-tile ${isSelected ? 'diff-tile-selected' : ''} diff-tile-${tier.id}`}
              onClick={() => handleSelect(tier.id)}
              data-testid={`diff-tile-${tier.id}`}
            >
              <Icon size={compact ? 24 : 32} className="diff-tile-icon" />
              <span className="diff-tile-label">{tier.label}</span>
              <span className="diff-tile-stats">
                {tier.turfs} turf{tier.turfs !== 1 ? 's' : ''} · {tier.actions}{' '}
                act/turn
              </span>
            </button>
          );
        })}
      </div>

      <div className="diff-footer">
        <div className="diff-detail">
          <span className="diff-detail-tagline">{selectedTier.tagline}</span>
          <label
            className={`diff-sd-toggle ${sdForced ? 'diff-sd-forced' : ''}`}
          >
            <input
              type="checkbox"
              checked={sdActive}
              disabled={sdForced}
              onChange={(e) => setSuddenDeath(e.target.checked)}
              data-testid="diff-sudden-death"
            />
            <span>Sudden Death{sdForced ? ' (locked)' : ''}</span>
          </label>
        </div>
        <button
          className="diff-start"
          onClick={handleStart}
          data-testid="diff-start"
        >
          Start Match
        </button>
      </div>
    </main>
  );
}
