import affiliationData from '../../data/pools/affiliations.json';

type GlowContext = 'none' | 'loyal' | 'rival';

interface AffiliationSymbolProps {
  affiliation: string;
  size?: number;
  context?: GlowContext;
  className?: string;
}

const allAffiliations = [
  ...affiliationData.affiliations,
  affiliationData.freelance,
];

const LOYAL_SET = new Map<string, Set<string>>();
const RIVAL_SET = new Map<string, Set<string>>();

for (const a of allAffiliations) {
  LOYAL_SET.set(a.id, new Set(a.loyal));
  RIVAL_SET.set(a.id, new Set(a.rival));
}

export function getAffiliationRelation(a: string, b: string): GlowContext {
  if (a === b || !a || !b) return 'none';
  if (LOYAL_SET.get(a)?.has(b)) return 'loyal';
  if (RIVAL_SET.get(a)?.has(b)) return 'rival';
  return 'none';
}

const GLOW_CLASS: Record<GlowContext, string> = {
  none: '',
  loyal: 'affiliation-symbol-glow-loyal',
  rival: 'affiliation-symbol-glow-rival',
};

export function AffiliationSymbol({
  affiliation,
  size = 32,
  context = 'none',
  className = '',
}: AffiliationSymbolProps) {
  const glowClass = GLOW_CLASS[context];
  const src = `${import.meta.env.BASE_URL}assets/affiliations/${affiliation}.svg`;

  return (
    <div
      className={`affiliation-symbol ${glowClass} ${className}`.trim()}
      style={{ width: size, height: size }}
      data-testid={`affiliation-${affiliation}`}
      data-context={context}
      role="img"
      aria-label={`${affiliation.replace(/_/g, ' ')} affiliation`}
    >
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="affiliation-symbol-img"
        draggable={false}
      />
    </div>
  );
}
