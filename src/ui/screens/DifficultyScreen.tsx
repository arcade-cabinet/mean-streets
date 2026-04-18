import {
  AlertTriangle,
  ArrowLeft,
  Flame,
  Shield,
  Skull,
  Swords,
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
  tagline: string;
}

const TIERS: TierDef[] = [
  {
    id: 'easy',
    label: 'Corner Boy',
    icon: Shield,
    turfs: simConfig.difficulty.easy.turfCount,
    actions: simConfig.difficulty.easy.actionsPerTurn,
    tagline: 'Loose crew, forgiving block',
  },
  {
    id: 'medium',
    label: 'Soldier',
    icon: Swords,
    turfs: simConfig.difficulty.medium.turfCount,
    actions: simConfig.difficulty.medium.actionsPerTurn,
    tagline: 'Even ground, fair fight',
  },
  {
    id: 'hard',
    label: 'Lieutenant',
    icon: Flame,
    turfs: simConfig.difficulty.hard.turfCount,
    actions: simConfig.difficulty.hard.actionsPerTurn,
    tagline: 'Rival crew runs tighter',
  },
  {
    id: 'nightmare',
    label: 'Kingpin',
    icon: Skull,
    turfs: simConfig.difficulty.nightmare.turfCount,
    actions: simConfig.difficulty.nightmare.actionsPerTurn,
    tagline: 'You move slower on their block',
  },
  {
    id: 'ultra-nightmare',
    label: 'War Council',
    icon: AlertTriangle,
    turfs: simConfig.difficulty['ultra-nightmare'].turfCount,
    actions: simConfig.difficulty['ultra-nightmare'].actionsPerTurn,
    tagline: 'They plan two moves ahead',
  },
];

function buildConfig(tier: DifficultyTier): GameConfig {
  const raw = simConfig.difficulty[tier];
  return {
    difficulty: tier,
    suddenDeath: tier === 'ultra-nightmare',
    turfCount: raw.turfCount,
    actionsPerTurn: raw.actionsPerTurn,
    firstTurnActions: raw.firstTurnActions,
  };
}

export function DifficultyScreen({ onSelect, onBack }: DifficultyScreenProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const [selected, setSelected] = useState<DifficultyTier>('medium');

  const selectedTier = TIERS.find((t) => t.id === selected)!;

  function handleSelect(tier: DifficultyTier) {
    setSelected(tier);
  }

  function handleStart() {
    onSelect(buildConfig(selected));
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
