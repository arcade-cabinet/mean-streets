/** Melee — knife blade with wrapped handle silhouette. */
export function meleePose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M35 70 L80 18 L86 24 L42 75Z" fill="#1a1a1a"/>
    <path d="M80 18 L90 12 L86 24Z" fill="#1a1a1a"/>
    <path d="M80 18 L86 24 L90 12Z" fill="${accent}" opacity="0.7"/>
    <rect x="31" y="66" width="12" height="6" rx="1" transform="rotate(-45 37 69)" fill="#1a1a1a"/>
    <path d="M36 68 L44 60" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M38 72 L46 64" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M44 74 L52 66" stroke="#1a1a1a" stroke-width="1" stroke-linecap="round"/>
    <path d="M80 18 L86 24 L88 20Z" fill="#1a1a1a"/>
  </svg>`;
}
