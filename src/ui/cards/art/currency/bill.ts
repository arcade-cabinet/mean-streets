/** Bill — single banknote with $ symbol and fine-line border detail. */
export function billPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <rect x="14" y="22" width="92" height="56" rx="3" fill="#1a1a1a"/>
    <rect x="18" y="26" width="84" height="48" rx="2" fill="#1a1a1a" stroke="${accent}" stroke-width="0.5" stroke-opacity="0.4"/>
    <rect x="22" y="30" width="76" height="40" rx="1" fill="${accent}" opacity="0.12"/>
    <circle cx="60" cy="50" r="14" fill="none" stroke="${accent}" stroke-width="1" opacity="0.5"/>
    <circle cx="60" cy="50" r="11" fill="none" stroke="${accent}" stroke-width="0.5" opacity="0.35"/>
    <text x="60" y="56" text-anchor="middle" font-family="serif" font-size="18" font-weight="bold" fill="${accent}" opacity="0.85">$</text>
    <rect x="22" y="30" width="16" height="10" rx="1" fill="${accent}" opacity="0.2"/>
    <rect x="82" y="60" width="16" height="10" rx="1" fill="${accent}" opacity="0.2"/>
    <line x1="22" y1="44" x2="38" y2="44" stroke="${accent}" stroke-width="0.75" opacity="0.4"/>
    <line x1="82" y1="56" x2="98" y2="56" stroke="${accent}" stroke-width="0.75" opacity="0.4"/>
  </svg>`;
}
