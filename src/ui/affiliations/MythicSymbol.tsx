/**
 * Mythic symbol renderer.
 *
 * Mythics are a fixed pool of 10 hand-authored cards (see RULES.md §11).
 * Each gets a unique geometric placeholder SVG under `public/assets/mythics/`
 * and a shared "gold crown" ring treatment to visually signal they are
 * above affiliation-tier.
 *
 * The ring is the shared mythic language; the SVG inside is specific to
 * the card's signature ability.
 */

interface MythicSymbolProps {
  mythicId: string;
  size?: number;
  className?: string;
  /** Elevate visual weight when the mythic is the active top tough. */
  active?: boolean;
}

const MYTHIC_ID_PATTERN = /^mythic-\d{2}$/;

export function MythicSymbol({
  mythicId,
  size = 48,
  className = '',
  active = false,
}: MythicSymbolProps) {
  if (!MYTHIC_ID_PATTERN.test(mythicId)) {
    // Defensive — should never fire in real render paths; if the JSON catalog
    // drifts from the 10-mythic roster, fail loud rather than render a broken
    // image silently.
    throw new Error(`MythicSymbol: invalid mythicId "${mythicId}"`);
  }
  const src = `${import.meta.env.BASE_URL}assets/mythics/${mythicId}.svg`;
  const activeClass = active ? 'mythic-symbol-active' : '';

  return (
    <div
      className={`mythic-symbol ${activeClass} ${className}`.trim()}
      style={{ width: size, height: size }}
      data-testid={`mythic-${mythicId}`}
      role="img"
      aria-label={`Mythic card ${mythicId}`}
    >
      {/* Shared gold-ring treatment — the "mythic language" */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        aria-hidden="true"
        className="mythic-symbol-ring"
      >
        {/* Outer ring — gold */}
        <circle
          cx="32"
          cy="32"
          r="30"
          stroke="#D4A017"
          strokeWidth="2"
          fill="none"
          opacity="0.75"
        />
        {/* Inner ring — dimmer gold */}
        <circle
          cx="32"
          cy="32"
          r="26"
          stroke="#D4A017"
          strokeWidth="1"
          fill="none"
          opacity="0.35"
        />
      </svg>
      {/* The mythic-specific signature art */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="mythic-symbol-art"
        draggable={false}
      />
    </div>
  );
}

/** Single source of truth for the 10-mythic roster. */
export const MYTHIC_IDS = [
  'mythic-01',
  'mythic-02',
  'mythic-03',
  'mythic-04',
  'mythic-05',
  'mythic-06',
  'mythic-07',
  'mythic-08',
  'mythic-09',
  'mythic-10',
] as const;

export type MythicId = (typeof MYTHIC_IDS)[number];
