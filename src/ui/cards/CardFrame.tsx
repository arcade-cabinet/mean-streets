import type { Rarity } from '../../sim/turf/types';

interface CardFrameProps {
  variant: 'crew' | 'quarter' | 'slot' | 'button' | 'card';
  rarity?: Rarity;
  className?: string;
}

const RARITY_ACCENT: Record<Rarity, string> = {
  common: 'rgba(148, 163, 184, 0.32)',
  rare: 'rgba(56, 189, 248, 0.36)',
  legendary: 'rgba(245, 158, 11, 0.42)',
};

const RARITY_STROKE: Record<Rarity, string> = {
  common: 'rgba(148, 163, 184, 0.18)',
  rare: 'rgba(56, 189, 248, 0.22)',
  legendary: 'rgba(245, 158, 11, 0.26)',
};

export function CardFrame({ variant, rarity, className }: CardFrameProps) {
  const isCard = variant === 'card';
  const rarityAccent = isCard && rarity ? RARITY_ACCENT[rarity] : null;
  const rarityStroke = isCard && rarity ? RARITY_STROKE[rarity] : null;

  const stroke = rarityStroke
    ?? (variant === 'crew' || variant === 'card'
      ? 'rgba(232, 221, 204, 0.18)'
      : variant === 'quarter'
        ? 'rgba(232, 221, 204, 0.16)'
        : variant === 'button'
          ? 'rgba(232, 221, 204, 0.14)'
          : 'rgba(232, 221, 204, 0.12)');

  const accent = rarityAccent
    ?? (variant === 'crew' || variant === 'card'
      ? 'rgba(178, 42, 30, 0.28)'
      : variant === 'quarter'
        ? 'rgba(178, 42, 30, 0.2)'
        : 'rgba(213, 161, 77, 0.16)');

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="4.5" y="4.5" width="91" height="91" rx="8" fill="none" stroke={stroke} strokeWidth="1.25" />
      <path
        d="M12 9 L24 9 L20 13 L12 13 Z M88 9 L76 9 L80 13 L88 13 Z M12 91 L24 91 L20 87 L12 87 Z M88 91 L76 91 L80 87 L88 87 Z"
        fill={accent}
      />
      <path
        d="M10 20 L10 10 L20 10 M90 20 L90 10 L80 10 M10 80 L10 90 L20 90 M90 80 L90 90 L80 90"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 50 H82"
        fill="none"
        stroke="rgba(232, 221, 204, 0.06)"
        strokeWidth="0.8"
        strokeDasharray="2.5 3.5"
      />
    </svg>
  );
}
