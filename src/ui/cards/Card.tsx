import { useAppShell } from '../../platform';
import type { Card as CardType, DifficultyTier, Rarity } from '../../sim/turf/types';
import { AffiliationSymbol } from '../affiliations';
import { CardFrame } from './CardFrame';
import { MythicBadge } from '../board/MythicBadge';
import flavorTextData from '../../../config/raw/cards/flavor-text.json';

const FLAVOR_TEXT: Record<string, string> = flavorTextData;

type GlowContext = 'none' | 'loyal' | 'rival';

interface CardProps {
  card: CardType;
  compact?: boolean;
  affiliationContext?: GlowContext;
  /** v0.3 rolled instance overlay — overrides the authored rarity frame
   * when a specific pack roll is shown (Collection, PackOpening, etc.). */
  rolledRarity?: Rarity;
  /** Difficulty the card instance was unlocked at. Shown as top-left chip. */
  unlockDifficulty?: DifficultyTier;
  /** Visually mark as a mythic. Forces mythic frame + glow regardless of rarity. */
  isMythic?: boolean;
}

const RARITY_CLASS: Record<Rarity, string> = {
  common: 'card-rarity-common',
  uncommon: 'card-rarity-uncommon',
  rare: 'card-rarity-rare',
  legendary: 'card-rarity-legendary',
  mythic: 'card-rarity-mythic',
};

const DIFFICULTY_GLYPH: Record<DifficultyTier, string> = {
  'easy': 'E',
  'medium': 'M',
  'hard': 'H',
  'nightmare': 'N',
  'ultra-nightmare': 'UN',
};

const AFFILIATION_COLORS: Record<string, string> = {
  kings_row: 'card-affiliation-kings-row',
  iron_devils: 'card-affiliation-iron-devils',
  jade_dragon: 'card-affiliation-jade-dragon',
  los_diablos: 'card-affiliation-los-diablos',
  southside_saints: 'card-affiliation-southside-saints',
  reapers: 'card-affiliation-reapers',
  dead_rabbits: 'card-affiliation-dead-rabbits',
  neon_snakes: 'card-affiliation-neon-snakes',
  black_market: 'card-affiliation-black-market',
  cobalt_syndicate: 'card-affiliation-cobalt-syndicate',
  freelance: 'card-affiliation-freelance',
};

function affiliationLabel(id: string): string {
  return id.replace(/_/g, ' ');
}

function renderUnlockBadge(unlock: DifficultyTier | undefined) {
  if (!unlock) return null;
  return (
    <span
      className={`card-unlock-badge card-unlock-${unlock}`}
      title={`Unlocked at ${unlock}`}
      data-testid="card-unlock-badge"
      aria-label={`Unlocked at ${unlock}`}
    >
      {DIFFICULTY_GLYPH[unlock]}
    </span>
  );
}

interface RenderExtras {
  effectiveRarity: Rarity;
  unlock?: DifficultyTier;
  isMythic: boolean;
}

function renderTough(
  card: CardType & { kind: 'tough' },
  compact: boolean,
  context: GlowContext,
  extras: RenderExtras,
) {
  const rarityClass = RARITY_CLASS[extras.effectiveRarity];
  const affiliationClass = AFFILIATION_COLORS[card.affiliation] ?? 'card-affiliation-freelance';
  const mythicClass = extras.isMythic ? 'card-mythic' : '';

  if (compact) {
    return (
      <div
        className={`card-shell card-shell-compact card-tough ${rarityClass} ${mythicClass}`}
        data-testid={`card-${card.id}`}
      >
        <CardFrame variant="card" rarity={extras.effectiveRarity} className="card-frame-svg card-frame-svg-card" />
        <div className="card-noise" />
        <div className="card-sheen" />
        {renderUnlockBadge(extras.unlock)}
        {extras.isMythic && <MythicBadge compact />}
        <div className="card-compact-header">
          <span className={`card-affiliation-badge ${affiliationClass}`}>
            <AffiliationSymbol affiliation={card.affiliation} size={14} context={context} />
            {affiliationLabel(card.affiliation)}
          </span>
          <span className="card-rarity-badge">{extras.effectiveRarity[0].toUpperCase()}</span>
        </div>
        <div className="card-compact-name">{card.name}</div>
        <div className="card-compact-stats">
          <span className="card-stat card-stat-power">{card.power}</span>
          <span className="card-stat card-stat-resistance">{card.resistance}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card-shell card-tough ${rarityClass} ${mythicClass}`}
      data-testid={`card-${card.id}`}
    >
      <CardFrame variant="card" rarity={extras.effectiveRarity} className="card-frame-svg card-frame-svg-card" />
      <div className="card-noise" />
      <div className="card-sheen" />
      {renderUnlockBadge(extras.unlock)}
      {extras.isMythic && <MythicBadge />}
      <div className="card-inner">
        <div className="card-header">
          <div className={`card-affiliation-hero ${affiliationClass}`}>
            <AffiliationSymbol affiliation={card.affiliation} size={18} context={context} />
            <span className="card-affiliation-label">{affiliationLabel(card.affiliation)}</span>
          </div>
          <span className="card-power-badge">{card.power}</span>
        </div>
        <div className="card-portrait">
          <img src={`${import.meta.env.BASE_URL}assets/card-art/${card.id}.png`} alt="" className="card-portrait-img" draggable={false} />
        </div>
        <div className="card-body">
          <div className="card-name-row">
            <span className="card-name">{card.name}</span>
            <span className="card-rarity-badge">{extras.effectiveRarity[0].toUpperCase()}</span>
          </div>
          <div className="card-meta">
            <span className="card-archetype">{card.archetype}</span>
          </div>
          {card.abilities.length > 0 && (
            <div className="card-abilities">
              {card.abilities[0]}
            </div>
          )}
          {(FLAVOR_TEXT[card.id] || card.tagline) && (
            <div className="card-flavor">{FLAVOR_TEXT[card.id] ?? card.tagline}</div>
          )}
        </div>
        <div className="card-footer">
          <span className="card-resistance-badge">{card.resistance}</span>
        </div>
      </div>
    </div>
  );
}

function renderModifier(
  card: (CardType & { kind: 'weapon' }) | (CardType & { kind: 'drug' }),
  compact: boolean,
  extras: RenderExtras,
) {
  const rarityClass = RARITY_CLASS[extras.effectiveRarity];
  const mythicClass = extras.isMythic ? 'card-mythic' : '';
  const kindClass = card.kind === 'weapon' ? 'card-weapon' : 'card-drug';
  const portraitClass = card.kind === 'weapon' ? 'card-portrait-weapon' : 'card-portrait-drug';

  if (compact) {
    return (
      <div
        className={`card-shell card-shell-compact ${kindClass} ${rarityClass} ${mythicClass}`}
        data-testid={`card-${card.id}`}
      >
        <CardFrame variant="card" rarity={extras.effectiveRarity} className="card-frame-svg card-frame-svg-card" />
        <div className="card-noise" />
        {renderUnlockBadge(extras.unlock)}
        {extras.isMythic && <MythicBadge compact />}
        <div className="card-compact-header">
          <span className="card-category-badge">{card.category}</span>
          <span className="card-rarity-badge">{extras.effectiveRarity[0].toUpperCase()}</span>
        </div>
        <div className="card-compact-name">{card.name}</div>
        <div className="card-compact-stats">
          <span className="card-stat card-stat-power">{card.power}</span>
          <span className="card-stat card-stat-resistance">{card.resistance}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card-shell ${kindClass} ${rarityClass} ${mythicClass}`}
      data-testid={`card-${card.id}`}
    >
      <CardFrame variant="card" rarity={extras.effectiveRarity} className="card-frame-svg card-frame-svg-card" />
      <div className="card-noise" />
      <div className="card-sheen" />
      {renderUnlockBadge(extras.unlock)}
      {extras.isMythic && <MythicBadge />}
      <div className="card-inner">
        <div className="card-header">
          <span className="card-category-badge">{card.category}</span>
          <span className="card-power-badge">{card.power}</span>
        </div>
        <div className={`card-portrait ${portraitClass}`}>
          <img src={`${import.meta.env.BASE_URL}assets/card-art/${card.id}.png`} alt="" className="card-portrait-img" draggable={false} />
        </div>
        <div className="card-body">
          <div className="card-name-row">
            <span className="card-name">{card.name}</span>
            <span className="card-rarity-badge">{extras.effectiveRarity[0].toUpperCase()}</span>
          </div>
          {card.abilities.length > 0 && (
            <div className="card-abilities">
              {card.abilities[0]}
            </div>
          )}
          {FLAVOR_TEXT[card.id] && (
            <div className="card-flavor">{FLAVOR_TEXT[card.id]}</div>
          )}
        </div>
        <div className="card-footer">
          <span className="card-resistance-badge">{card.resistance}</span>
        </div>
      </div>
    </div>
  );
}

function renderCurrency(
  card: CardType & { kind: 'currency' },
  compact: boolean,
  extras: RenderExtras,
) {
  const rarityClass = RARITY_CLASS[extras.effectiveRarity];
  const mythicClass = extras.isMythic ? 'card-mythic' : '';
  const label = card.denomination === 1000 ? '$1,000' : '$100';

  if (compact) {
    return (
      <div
        className={`card-shell card-shell-compact card-currency ${rarityClass} ${mythicClass}`}
        data-testid={`card-${card.id}`}
      >
        <CardFrame variant="card" rarity={extras.effectiveRarity} className="card-frame-svg card-frame-svg-card" />
        <div className="card-noise" />
        {renderUnlockBadge(extras.unlock)}
        <div className="card-compact-name card-currency-label">{label}</div>
      </div>
    );
  }

  return (
    <div
      className={`card-shell card-currency ${rarityClass} ${mythicClass}`}
      data-testid={`card-${card.id}`}
    >
      <CardFrame variant="card" rarity={extras.effectiveRarity} className="card-frame-svg card-frame-svg-card" />
      <div className="card-noise" />
      <div className="card-sheen" />
      {renderUnlockBadge(extras.unlock)}
      <div className="card-inner card-inner-currency">
        <div className="card-currency-denomination">{label}</div>
        <div className="card-currency-subtext">{card.name}</div>
      </div>
    </div>
  );
}

export function Card({
  card, compact: compactOverride, affiliationContext = 'none',
  rolledRarity, unlockDifficulty, isMythic,
}: CardProps) {
  const { layout } = useAppShell();
  const compact = compactOverride ?? (layout.id === 'phone-portrait' || layout.id === 'folded');
  const effectiveRarity: Rarity = rolledRarity ?? card.rarity;
  const mythic = isMythic ?? effectiveRarity === 'mythic';
  const extras: RenderExtras = { effectiveRarity, unlock: unlockDifficulty, isMythic: mythic };

  switch (card.kind) {
    case 'tough':
      return renderTough(card, compact, affiliationContext, extras);
    case 'weapon':
    case 'drug':
      return renderModifier(card, compact, extras);
    case 'currency':
      return renderCurrency(card, compact, extras);
  }
}
