import { useAppShell } from '../../platform';
import type { Position } from '../../sim/turf/types';
import { positionPower, positionDefense } from '../../sim/turf/board';
import { CardFrame } from './CardFrame';
import { ModifierSlot } from './ModifierSlot';

interface CrewCardProps {
  position: Position;
  isPlayer: boolean;
  onSlotDrop?: (slot: string, card: unknown) => void;
}

const AFFILIATION_COLORS: Record<string, string> = {
  'kings-row': 'crew-affiliation-kings-row',
  'iron-devils': 'crew-affiliation-iron-devils',
  'jade-dragon': 'crew-affiliation-jade-dragon',
  'los-diablos': 'crew-affiliation-los-diablos',
  'southside-saints': 'crew-affiliation-southside-saints',
  'the-reapers': 'crew-affiliation-the-reapers',
  'dead-rabbits': 'crew-affiliation-dead-rabbits',
  'neon-snakes': 'crew-affiliation-neon-snakes',
  'black-market': 'crew-affiliation-black-market',
  'cobalt-syndicate': 'crew-affiliation-cobalt-syndicate',
  freelance: 'crew-affiliation-freelance',
};

function compactValue(label: string, value: string | number | null | undefined) {
  return (
    <span className="crew-card-compact-stat">
      <span className="crew-card-compact-stat-label">{label}</span>
      <span className="crew-card-compact-stat-value">{value ?? '-'}</span>
    </span>
  );
}

export function CrewCard({ position, isPlayer: _isPlayer, onSlotDrop: _onSlotDrop }: CrewCardProps) {
  const { layout } = useAppShell();

  if (!position.crew) {
    return (
      <div className="crew-card-empty">
        <span className="crew-card-empty-label">Empty</span>
      </div>
    );
  }

  const { crew } = position;
  const power = positionPower(position);
  const defense = positionDefense(position);
  const affiliationTone = AFFILIATION_COLORS[crew.affiliation] ?? 'crew-affiliation-freelance';
  const isSeized = position.seized;
  const compact = layout.id === 'phone-portrait' || layout.id === 'folded';

  if (compact) {
    const topWeapon = position.weaponTop?.bonus ?? null;
    const topDrug = position.drugTop?.potency ?? null;
    const cashTotal = (position.cashLeft?.denomination ?? 0) + (position.cashRight?.denomination ?? 0);

    return (
      <div
        className={`crew-card-shell crew-card-shell-compact ${isSeized ? 'crew-card-shell-seized' : ''} ${position.runner ? 'crew-card-shell-runner' : ''}`}
        data-testid={`crew-card-${crew.id}`}
        data-runner={position.runner ? 'true' : undefined}
      >
        <CardFrame variant="crew" className="card-frame-svg card-frame-svg-crew" />
        <div className="crew-card-noise crew-card-noise-ragged" />
        <div className="crew-card-sheen" />
        {position.runner && (
          <div className="crew-card-runner-badge" aria-label="runner with backpack" title="Runner — carrying backpack">
            <span className="crew-card-runner-badge-icon" aria-hidden="true">🎒</span>
            <span className="crew-card-runner-badge-count">{position.payloadRemaining}</span>
          </div>
        )}

        <div className="crew-card-compact-top">
          {compactValue('P', power)}
          {compactValue('R', defense)}
          {compactValue('W', topWeapon !== null ? `+${topWeapon}` : '-')}
          {compactValue('D', topDrug !== null ? `+${topDrug}` : '-')}
          {compactValue('$', cashTotal > 0 ? cashTotal : '-')}
        </div>

        <div className="crew-card-compact-name">{crew.displayName}</div>

        <div className="crew-card-compact-modifiers">
          <ModifierSlot type="drug" card={position.drugTop} orientation="offense" slotId="drug-top" />
          <ModifierSlot type="weapon" card={position.weaponTop} orientation="offense" slotId="weapon-top" />
          <ModifierSlot type="cash" card={position.cashLeft} orientation="offense" slotId="cash-left" />
          <ModifierSlot type="drug" card={position.drugBottom} orientation="defense" slotId="drug-bottom" />
          <ModifierSlot type="weapon" card={position.weaponBottom} orientation="defense" slotId="weapon-bottom" />
          <ModifierSlot type="cash" card={position.cashRight} orientation="defense" slotId="cash-right" />
        </div>

        <div className={`crew-card-affiliation crew-card-affiliation-compact ${affiliationTone}`}>
          <span className="crew-card-affiliation-dot" />
          {crew.affiliation.replace(/-/g, ' ')}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`crew-card-shell crew-card-shell-metallic ${isSeized ? 'crew-card-shell-seized' : ''} ${position.runner ? 'crew-card-shell-runner' : ''}`}
      data-testid={`crew-card-${crew.id}`}
      data-runner={position.runner ? 'true' : undefined}
    >
      <CardFrame variant="crew" className="card-frame-svg card-frame-svg-crew" />
      <div className="crew-card-noise crew-card-noise-ragged" />
      <div className="crew-card-sheen" />
      {position.runner && (
        <div className="crew-card-runner-badge" aria-label="runner with backpack" title={`Runner — ${position.payloadRemaining} payload remaining`}>
          <span className="crew-card-runner-badge-icon" aria-hidden="true">🎒</span>
          <span className="crew-card-runner-badge-count">{position.payloadRemaining}</span>
        </div>
      )}

      <div className="crew-card-inner">
        <div className="crew-card-header">
          <div className={`crew-card-affiliation ${affiliationTone}`}>
            <span className="crew-card-affiliation-dot" />
            {crew.affiliation.replace(/-/g, ' ')}
          </div>
          <div className="crew-card-archetype">
            {crew.archetype}
          </div>
        </div>

        <div className="crew-card-grid">
          <ModifierSlot type="drug" card={position.drugTop} orientation="offense" slotId="drug-top" />
          <div className="crew-card-meter">
            <span className="crew-card-meter-label">Power</span>
            <span className="crew-card-meter-value crew-card-meter-value-power">{power}</span>
          </div>
          <ModifierSlot type="weapon" card={position.weaponTop} orientation="offense" slotId="weapon-top" />
        </div>

        <div className="crew-card-grid crew-card-grid-middle">
          <ModifierSlot type="cash" card={position.cashLeft} orientation="offense" slotId="cash-left" />
          <div className="crew-card-medallion-wrap">
            <div className="crew-card-medallion">
              <span className="crew-card-medallion-copy">
                {crew.affiliation.slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          <ModifierSlot type="cash" card={position.cashRight} orientation="defense" slotId="cash-right" />
        </div>

        <div className="crew-card-grid crew-card-grid-bottom">
          <ModifierSlot type="drug" card={position.drugBottom} orientation="defense" slotId="drug-bottom" />
          <div className="crew-card-meter">
            <span className="crew-card-meter-label">Res</span>
            <span className="crew-card-meter-value crew-card-meter-value-defense">{defense}</span>
          </div>
          <ModifierSlot type="weapon" card={position.weaponBottom} orientation="defense" slotId="weapon-bottom" />
        </div>

        <div className="crew-card-footer">
          <div className="crew-card-name">
            {crew.displayName}
          </div>
          <div className="crew-card-role-row">
            <span>{crew.archetype}</span>
            <span>{_isPlayer ? 'Player' : 'Rival'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
