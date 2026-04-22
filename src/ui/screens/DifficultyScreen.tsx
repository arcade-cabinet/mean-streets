import { ArrowLeft } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import simConfig from '../../data/ai/turf-sim.json';
import { useAppShell } from '../../platform';
import type { DifficultyTier, GameConfig } from '../../sim/turf/types';
import { silhouetteIconPath } from '../iconography/silhouetteIconography';

interface DifficultyScreenProps {
  onSelect: (config: GameConfig) => void;
  onBack: () => void;
}

interface TierDef {
  id: DifficultyTier;
  label: string;
  short: string;
  art: string;
  turfs: number;
  actions: number;
  firstTurnActions: number;
  rewardMult: number;
  tagline: string;
  description: string;
}

const TIERS: TierDef[] = [
  {
    id: 'easy',
    label: 'Corner Mercy',
    short: 'Learn the block',
    art: silhouetteIconPath('difficulty-corner-mercy'),
    turfs: simConfig.difficulty.easy.turfCount,
    actions: simConfig.difficulty.easy.actionsPerTurn,
    firstTurnActions: simConfig.difficulty.easy.firstTurnActions,
    rewardMult: simConfig.packEconomy.difficultyRewardMult.easy,
    tagline: 'The street lets you make one more mistake.',
    description: 'Short lockups, lighter rival pressure, and room to see the machine move.',
  },
  {
    id: 'medium',
    label: 'Street Code',
    short: 'The intended knife fight',
    art: silhouetteIconPath('difficulty-street-code'),
    turfs: simConfig.difficulty.medium.turfCount,
    actions: simConfig.difficulty.medium.actionsPerTurn,
    firstTurnActions: simConfig.difficulty.medium.firstTurnActions,
    rewardMult: simConfig.packEconomy.difficultyRewardMult.medium,
    tagline: 'Clean rules. Dirty hands.',
    description: 'Baseline turf war: no mercy math, no hidden crutch, just the board state.',
  },
  {
    id: 'hard',
    label: 'Heavy Heat',
    short: 'Cops watch closer',
    art: silhouetteIconPath('difficulty-heavy-heat'),
    turfs: simConfig.difficulty.hard.turfCount,
    actions: simConfig.difficulty.hard.actionsPerTurn,
    firstTurnActions: simConfig.difficulty.hard.firstTurnActions,
    rewardMult: simConfig.packEconomy.difficultyRewardMult.hard,
    tagline: 'Every loud move leaves a receipt.',
    description: 'Longer lockups and tighter rival tempo punish sloppy stacks.',
  },
  {
    id: 'nightmare',
    label: 'Kingpin Debt',
    short: 'Every favor collects',
    art: silhouetteIconPath('difficulty-kingpin-debt'),
    turfs: simConfig.difficulty.nightmare.turfCount,
    actions: simConfig.difficulty.nightmare.actionsPerTurn,
    firstTurnActions: simConfig.difficulty.nightmare.firstTurnActions,
    rewardMult: simConfig.packEconomy.difficultyRewardMult.nightmare,
    tagline: 'You can win, but nothing stays free.',
    description: 'The rival crew presses reserves, heat gets expensive, and lockup bleeds turns.',
  },
  {
    id: 'ultra-nightmare',
    label: 'No Dawn',
    short: 'Ultra Nightmare',
    art: silhouetteIconPath('difficulty-no-dawn'),
    turfs: simConfig.difficulty['ultra-nightmare'].turfCount,
    actions: simConfig.difficulty['ultra-nightmare'].actionsPerTurn,
    firstTurnActions: simConfig.difficulty['ultra-nightmare'].firstTurnActions,
    rewardMult: simConfig.packEconomy.difficultyRewardMult['ultra-nightmare'],
    tagline: 'The city already picked your funeral song.',
    description: 'Permadeath is forced, lockup is effectively permanent, and the rival sees farther.',
  },
];

const PERMADEATH_REWARD_MULT = simConfig.packEconomy.permadeathRewardMult;
const PERMADEATH_ART = silhouetteIconPath('difficulty-body-bags');

function buildConfig(tier: DifficultyTier, permadeath: boolean): GameConfig {
  const raw = simConfig.difficulty[tier];
  return {
    difficulty: tier,
    suddenDeath: tier === 'ultra-nightmare' || permadeath,
    turfCount: raw.turfCount,
    actionsPerTurn: raw.actionsPerTurn,
    firstTurnActions: raw.firstTurnActions,
  };
}

function PortraitIcon({
  src,
  label,
  active,
}: {
  src: string;
  label: string;
  active: boolean;
}) {
  return (
    <span className={`diff-portrait ${active ? 'diff-portrait-active' : ''}`} aria-hidden="true">
      <img src={src} alt="" draggable={false} />
      <span className="diff-portrait-grit" />
      <span className="diff-portrait-label">{label}</span>
    </span>
  );
}

function TierTile({
  tier,
  selected,
  compact,
  onSelect,
  onKeyDown,
}: {
  tier: TierDef;
  selected: boolean;
  compact: boolean;
  onSelect: (tier: DifficultyTier) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tier: DifficultyTier) => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      className={`diff-tile ${selected ? 'diff-tile-selected' : ''} diff-tile-${tier.id}`}
      onClick={() => onSelect(tier.id)}
      onKeyDown={(event) => onKeyDown(event, tier.id)}
      data-testid={`diff-tile-${tier.id}`}
    >
      <PortraitIcon src={tier.art} label={tier.short} active={selected} />
      <span className="diff-tile-label">{tier.label}</span>
      <span className="diff-tile-copy">{compact ? tier.short : tier.tagline}</span>
    </button>
  );
}

export function DifficultyScreen({ onSelect, onBack }: DifficultyScreenProps) {
  const { layout } = useAppShell();
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';
  const [selected, setSelected] = useState<DifficultyTier>('medium');
  const [permadeath, setPermadeath] = useState(false);

  const selectedTier = TIERS.find((t) => t.id === selected)!;
  const permadeathForced = selected === 'ultra-nightmare';
  const effectivePermadeath = permadeathForced || permadeath;
  const effectiveRewardMult =
    selectedTier.rewardMult * (effectivePermadeath ? PERMADEATH_REWARD_MULT : 1);

  function handleSelect(tier: DifficultyTier) {
    setSelected(tier);
  }

  function focusTier(tier: DifficultyTier) {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-testid="diff-tile-${tier}"]`)?.focus();
    });
  }

  function handleTierKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tier: DifficultyTier,
  ) {
    const currentIndex = TIERS.findIndex((entry) => entry.id === tier);
    const nextIndex =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (currentIndex - 1 + TIERS.length) % TIERS.length
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? (currentIndex + 1) % TIERS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TIERS.length - 1
              : null;

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTier = TIERS[nextIndex].id;
    setSelected(nextTier);
    focusTier(nextTier);
  }

  function handleTogglePermadeath() {
    if (permadeathForced) return;
    setPermadeath((value) => !value);
  }

  function handleStart() {
    onSelect(buildConfig(selected, permadeath));
  }

  return (
    <div className="diff-modal-backdrop" role="presentation">
      <section
        className="diff-shell"
        data-testid="difficulty-screen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="difficulty-title"
      >
        <div className="diff-header">
          <button
            className="diff-back"
            onClick={onBack}
            aria-label="Back to landing"
            data-testid="diff-back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="diff-kicker">Choose the shape of the war</p>
            <h1 className="diff-title" id="difficulty-title">Set the Stakes</h1>
          </div>
        </div>

        <div
          className={`diff-grid ${compact ? 'diff-grid-compact' : ''}`}
        >
          <div className="diff-tier-grid" role="radiogroup" aria-label="Difficulty tiers">
            {TIERS.map((tier) => (
              <TierTile
                key={tier.id}
                tier={tier}
                selected={selected === tier.id}
                compact={compact}
                onSelect={handleSelect}
                onKeyDown={handleTierKeyDown}
              />
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={effectivePermadeath}
            aria-disabled={permadeathForced}
            aria-label={
              permadeathForced
                ? 'Permadeath forced by Ultra Nightmare'
                : 'Toggle Permadeath'
            }
            className={`diff-tile diff-permadeath ${effectivePermadeath ? 'diff-tile-selected' : ''} ${permadeathForced ? 'diff-permadeath-forced' : ''}`}
            onClick={handleTogglePermadeath}
            data-testid="diff-permadeath"
          >
            <PortraitIcon
              src={PERMADEATH_ART}
              label={permadeathForced ? 'Forced' : 'Optional'}
              active={effectivePermadeath}
            />
            <span className="diff-tile-label">Body Bags</span>
            <span className="diff-tile-copy">
              {permadeathForced ? 'Ultra Nightmare demands it' : 'Raid seizure means death'}
            </span>
          </button>
        </div>

        <div className="diff-footer">
          <div className="diff-detail">
            <span className="diff-detail-tagline">{selectedTier.tagline}</span>
            <p className="diff-detail-copy">{selectedTier.description}</p>
            <div className="diff-stat-strip" aria-label="Selected difficulty terms">
              <span>{selectedTier.turfs} blocks to take</span>
              <span>{selectedTier.firstTurnActions}/{selectedTier.actions} tempo</span>
              <span>{effectiveRewardMult.toFixed(2)}x reward roll</span>
            </div>
            {effectivePermadeath && (
              <p className="diff-permadeath-warning" data-testid="diff-permadeath-warning">
                Body Bags active: raid-seized toughs die immediately with their attached stack.
              </p>
            )}
          </div>
          <button
            className="diff-start"
            onClick={handleStart}
            data-testid="diff-start"
          >
            Start War
          </button>
        </div>
      </section>
    </div>
  );
}
