/** Stimulant — capsule pill with radiating energy lines. */
export function stimulantPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <ellipse cx="60" cy="40" rx="24" ry="12" fill="#1a1a1a" transform="rotate(-30 60 40)"/>
    <path d="M48 30 L60 40 L72 50 Q60 52 48 40Z" fill="${accent}" opacity="0.7" transform="rotate(-30 60 40)"/>
    <line x1="60" y1="18" x2="60" y2="10" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <line x1="60" y1="62" x2="60" y2="70" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <line x1="82" y1="40" x2="90" y2="40" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <line x1="38" y1="40" x2="30" y2="40" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
    <line x1="76" y1="24" x2="82" y2="18" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <line x1="44" y1="56" x2="38" y2="62" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <line x1="76" y1="56" x2="82" y2="62" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <line x1="44" y1="24" x2="38" y2="18" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
  </svg>`;
}
