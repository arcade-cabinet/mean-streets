import { useAppShell } from '../../platform';
import type { Card as CardType, Rarity } from '../../sim/turf/types';
import { AffiliationSymbol } from '../affiliations';
import { CardFrame } from './CardFrame';

type GlowContext = 'none' | 'loyal' | 'rival';

interface CardProps {
  card: CardType;
  compact?: boolean;
  affiliationContext?: GlowContext;
}

const RARITY_CLASS: Record<Rarity, string> = {
  common: 'card-rarity-common',
  rare: 'card-rarity-rare',
  legendary: 'card-rarity-legendary',
};

const AFFILIATION_COLORS: Record<string, string> = {
  kings_row: 'card-affiliation-kings-row',
  iron_devils: 'card-affiliation-iron-devils',
  jade_dragon: 'card-affiliation-jade-dragon',
  los_diablos: 'card-affiliation-los-diablos',
  southside_saints: 'card-affiliation-southside-saints',
  the_reapers: 'card-affiliation-the-reapers',
  dead_rabbits: 'card-affiliation-dead-rabbits',
  neon_snakes: 'card-affiliation-neon-snakes',
  black_market: 'card-affiliation-black-market',
  cobalt_syndicate: 'card-affiliation-cobalt-syndicate',
  freelance: 'card-affiliation-freelance',
};

function affiliationLabel(id: string): string {
  return id.replace(/_/g, ' ');
}

function renderTough(card: CardType & { kind: 'tough' }, compact: boolean, context: GlowContext) {
  const rarityClass = RARITY_CLASS[card.rarity];
  const affiliationClass = AFFILIATION_COLORS[card.affiliation] ?? 'card-affiliation-freelance';

  if (compact) {
    return (
      <div
        className={`card-shell card-shell-compact card-tough ${rarityClass}`}
        data-testid={`card-${card.id}`}
      >
        <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
        <div className="card-noise" />
        <div className="card-sheen" />
        <div className="card-compact-header">
          <span className={`card-affiliation-badge ${affiliationClass}`}>
            <AffiliationSymbol affiliation={card.affiliation} size={14} context={context} />
            {affiliationLabel(card.affiliation)}
          </span>
          <span className="card-rarity-badge">{card.rarity[0].toUpperCase()}</span>
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
      className={`card-shell card-tough ${rarityClass}`}
      data-testid={`card-${card.id}`}
    >
      <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
      <div className="card-noise" />
      <div className="card-sheen" />
      <div className="card-inner">
        <div className="card-header">
          <div className={`card-affiliation-hero ${affiliationClass}`}>
            <AffiliationSymbol affiliation={card.affiliation} size={18} context={context} />
            <span className="card-affiliation-label">{affiliationLabel(card.affiliation)}</span>
          </div>
          <span className="card-power-badge">{card.power}</span>
        </div>
        <div className="card-portrait">
          <AffiliationSymbol affiliation={card.affiliation} size={40} context={context} className="card-portrait-symbol" />
          <div className="card-portrait-initials">
            {card.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="card-body">
          <div className="card-name-row">
            <span className="card-name">{card.name}</span>
            <span className="card-rarity-badge">{card.rarity[0].toUpperCase()}</span>
          </div>
          <div className="card-meta">
            <span className="card-archetype">{card.archetype}</span>
          </div>
          {card.abilities.length > 0 && (
            <div className="card-abilities">
              {card.abilities[0]}
            </div>
          )}
        </div>
        <div className="card-footer">
          <span className="card-resistance-badge">{card.resistance}</span>
        </div>
      </div>
    </div>
  );
}

function renderWeapon(card: CardType & { kind: 'weapon' }, compact: boolean) {
  const rarityClass = RARITY_CLASS[card.rarity];

  if (compact) {
    return (
      <div
        className={`card-shell card-shell-compact card-weapon ${rarityClass}`}
        data-testid={`card-${card.id}`}
      >
        <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
        <div className="card-noise" />
        <div className="card-compact-header">
          <span className="card-category-badge">{card.category}</span>
          <span className="card-rarity-badge">{card.rarity[0].toUpperCase()}</span>
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
      className={`card-shell card-weapon ${rarityClass}`}
      data-testid={`card-${card.id}`}
    >
      <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
      <div className="card-noise" />
      <div className="card-sheen" />
      <div className="card-inner">
        <div className="card-header">
          <span className="card-category-badge">{card.category}</span>
          <span className="card-power-badge">{card.power}</span>
        </div>
        <div className="card-portrait card-portrait-weapon">
          <span className="card-portrait-icon">⚔</span>
        </div>
        <div className="card-body">
          <div className="card-name-row">
            <span className="card-name">{card.name}</span>
            <span className="card-rarity-badge">{card.rarity[0].toUpperCase()}</span>
          </div>
          {card.abilities.length > 0 && (
            <div className="card-abilities">
              {card.abilities[0]}
            </div>
          )}
        </div>
        <div className="card-footer">
          <span className="card-resistance-badge">{card.resistance}</span>
        </div>
      </div>
    </div>
  );
}

function renderDrug(card: CardType & { kind: 'drug' }, compact: boolean) {
  const rarityClass = RARITY_CLASS[card.rarity];

  if (compact) {
    return (
      <div
        className={`card-shell card-shell-compact card-drug ${rarityClass}`}
        data-testid={`card-${card.id}`}
      >
        <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
        <div className="card-noise" />
        <div className="card-compact-header">
          <span className="card-category-badge">{card.category}</span>
          <span className="card-rarity-badge">{card.rarity[0].toUpperCase()}</span>
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
      className={`card-shell card-drug ${rarityClass}`}
      data-testid={`card-${card.id}`}
    >
      <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
      <div className="card-noise" />
      <div className="card-sheen" />
      <div className="card-inner">
        <div className="card-header">
          <span className="card-category-badge">{card.category}</span>
          <span className="card-power-badge">{card.power}</span>
        </div>
        <div className="card-portrait card-portrait-drug">
          <span className="card-portrait-icon">💊</span>
        </div>
        <div className="card-body">
          <div className="card-name-row">
            <span className="card-name">{card.name}</span>
            <span className="card-rarity-badge">{card.rarity[0].toUpperCase()}</span>
          </div>
          {card.abilities.length > 0 && (
            <div className="card-abilities">
              {card.abilities[0]}
            </div>
          )}
        </div>
        <div className="card-footer">
          <span className="card-resistance-badge">{card.resistance}</span>
        </div>
      </div>
    </div>
  );
}

function renderCurrency(card: CardType & { kind: 'currency' }, compact: boolean) {
  const rarityClass = RARITY_CLASS[card.rarity];
  const label = card.denomination === 1000 ? '$1,000' : '$100';

  if (compact) {
    return (
      <div
        className={`card-shell card-shell-compact card-currency ${rarityClass}`}
        data-testid={`card-${card.id}`}
      >
        <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
        <div className="card-noise" />
        <div className="card-compact-name card-currency-label">{label}</div>
      </div>
    );
  }

  return (
    <div
      className={`card-shell card-currency ${rarityClass}`}
      data-testid={`card-${card.id}`}
    >
      <CardFrame variant="card" rarity={card.rarity} className="card-frame-svg card-frame-svg-card" />
      <div className="card-noise" />
      <div className="card-sheen" />
      <div className="card-inner card-inner-currency">
        <div className="card-currency-denomination">{label}</div>
        <div className="card-currency-subtext">{card.name}</div>
      </div>
    </div>
  );
}

export function Card({ card, compact: compactOverride, affiliationContext = 'none' }: CardProps) {
  const { layout } = useAppShell();
  const compact = compactOverride ?? (layout.id === 'phone-portrait' || layout.id === 'folded');

  switch (card.kind) {
    case 'tough':
      return renderTough(card, compact, affiliationContext);
    case 'weapon':
      return renderWeapon(card, compact);
    case 'drug':
      return renderDrug(card, compact);
    case 'currency':
      return renderCurrency(card, compact);
  }
}
