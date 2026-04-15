import type { Card, ToughCard, Turf } from '../../sim/turf/types';
import { positionPower, positionResistance, turfToughs, turfModifiers, turfCurrency } from '../../sim/turf/board';
import { AffiliationSymbol, getAffiliationRelation } from '../affiliations';
import { CardFrame } from '../cards/CardFrame';

interface TurfCompositeCardProps {
  turf: Turf;
  compact?: boolean;
  onClick?: () => void;
}

function uniqueAffiliations(toughs: ToughCard[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of toughs) {
    if (!seen.has(t.affiliation)) {
      seen.add(t.affiliation);
      result.push(t.affiliation);
    }
  }
  return result;
}

function affiliationContext(affiliations: string[], aff: string): 'none' | 'loyal' | 'rival' {
  for (const other of affiliations) {
    if (other === aff) continue;
    const rel = getAffiliationRelation(aff, other);
    if (rel !== 'none') return rel;
  }
  return 'none';
}

function bestRarity(toughs: ToughCard[]): 'common' | 'rare' | 'legendary' {
  let best: 'common' | 'rare' | 'legendary' = 'common';
  for (const t of toughs) {
    if (t.rarity === 'legendary') return 'legendary';
    if (t.rarity === 'rare') best = 'rare';
  }
  return best;
}

function modifierSummary(mods: Card[]): { weapons: number; drugs: number } {
  let weapons = 0;
  let drugs = 0;
  for (const m of mods) {
    if (m.kind === 'weapon') weapons++;
    else if (m.kind === 'drug') drugs++;
  }
  return { weapons, drugs };
}

export function TurfCompositeCard({ turf, compact, onClick }: TurfCompositeCardProps) {
  const toughs = turfToughs(turf);
  const mods = turfModifiers(turf);
  const currency = turfCurrency(turf);
  const power = positionPower(turf);
  const resistance = positionResistance(turf);
  const affiliations = uniqueAffiliations(toughs);
  const rarity = bestRarity(toughs);
  const { weapons, drugs } = modifierSummary(mods);
  const cashTotal = currency.reduce((sum, c) => sum + c.denomination, 0);
  const stackSize = turf.stack.length;

  if (toughs.length === 0) {
    return (
      <div
        className={`turf-composite turf-composite-empty ${compact ? 'turf-composite-compact' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        aria-label={`Empty turf ${turf.id}`}
        data-testid={`turf-composite-${turf.id}`}
      >
        <CardFrame variant="slot" className="turf-composite-frame" />
        <span className="turf-composite-empty-label">Empty Turf</span>
      </div>
    );
  }

  const topTough = toughs[toughs.length - 1];
  const topAffClass = `card-affiliation-${topTough.affiliation.replace(/_/g, '-')}`;

  if (compact) {
    return (
      <div
        className={`turf-composite turf-composite-compact card-rarity-${rarity}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
        aria-label={`Turf: ${toughs.map(t => t.name).join(', ')}`}
        data-testid={`turf-composite-${turf.id}`}
      >
        <CardFrame variant="card" rarity={rarity} className="turf-composite-frame" />
        <div className="card-noise" />
        <div className="turf-composite-compact-inner">
          <div className="turf-composite-compact-header">
            <span className={`turf-composite-affiliation-dot ${topAffClass}`}>
              <AffiliationSymbol affiliation={topTough.affiliation} size={14} context={affiliationContext(affiliations, topTough.affiliation)} />
            </span>
            <span className="turf-composite-stack-count">{stackSize}</span>
          </div>
          <div className="turf-composite-compact-name">{topTough.name}</div>
          <div className="turf-composite-compact-roster">
            {toughs.length > 1 && <span className="turf-composite-roster-extra">+{toughs.length - 1}</span>}
          </div>
          <div className="turf-composite-compact-stats">
            <span className="turf-composite-stat turf-composite-stat-power">{power}</span>
            <span className="turf-composite-stat turf-composite-stat-resistance">{resistance}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`turf-composite card-rarity-${rarity}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      aria-label={`Turf: ${toughs.map(t => t.name).join(', ')}`}
      data-testid={`turf-composite-${turf.id}`}
    >
      <CardFrame variant="card" rarity={rarity} className="turf-composite-frame" />
      <div className="card-noise" />
      <div className="card-sheen" />

      <div className="turf-composite-inner">
        <div className="turf-composite-header">
          <div className="turf-composite-affiliations">
            {affiliations.map((aff) => (
              <AffiliationSymbol
                key={aff}
                affiliation={aff}
                size={20}
                context={affiliationContext(affiliations, aff)}
              />
            ))}
          </div>
          <span className="turf-composite-power-badge">{power}</span>
        </div>

        <div className="turf-composite-portrait">
          <AffiliationSymbol
            affiliation={topTough.affiliation}
            size={44}
            context={affiliationContext(affiliations, topTough.affiliation)}
            className="turf-composite-portrait-symbol"
          />
          <div className="turf-composite-stack-badge">{stackSize}</div>
        </div>

        <div className="turf-composite-body">
          <div className="turf-composite-roster-list">
            {toughs.map((t, i) => (
              <div key={t.id} className="turf-composite-roster-entry">
                <span className="turf-composite-roster-name">{t.name}</span>
                {i === toughs.length - 1 && turf.sickTopIdx != null && (
                  <span className="turf-composite-sick-badge">SICK</span>
                )}
              </div>
            ))}
          </div>
          <div className="turf-composite-mod-row">
            {weapons > 0 && <span className="turf-composite-mod-tag turf-composite-mod-weapon">{weapons} wpn</span>}
            {drugs > 0 && <span className="turf-composite-mod-tag turf-composite-mod-drug">{drugs} drg</span>}
            {cashTotal > 0 && <span className="turf-composite-mod-tag turf-composite-mod-cash">${cashTotal}</span>}
          </div>
        </div>

        <div className="turf-composite-footer">
          <span className="turf-composite-resistance-badge">{resistance}</span>
        </div>
      </div>
    </div>
  );
}
