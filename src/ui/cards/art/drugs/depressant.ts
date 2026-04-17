/** Depressant — unlabelled bottle on its side with syringe leaning against it. */
export function depressantPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M28 44 L30 32 L36 28 L48 28 L52 32 L52 44 L50 56 L30 56Z" fill="#1a1a1a"/>
    <rect x="36" y="22" width="6" height="8" rx="1" fill="#1a1a1a"/>
    <rect x="37" y="18" width="4" height="6" rx="0.5" fill="#1a1a1a"/>
    <rect x="29" y="36" width="24" height="12" rx="1" fill="${accent}" opacity="0.3"/>
    <rect x="29" y="42" width="24" height="6" rx="0" fill="${accent}" opacity="0.4"/>
    <line x1="60" y1="26" x2="88" y2="54" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
    <line x1="60" y1="26" x2="62" y2="22" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/>
    <rect x="57" y="22" width="8" height="5" rx="1" fill="#1a1a1a"/>
    <circle cx="59" cy="22" r="1.5" fill="#1a1a1a"/>
    <line x1="76" y1="40" x2="80" y2="44" stroke="#1a1a1a" stroke-width="6" stroke-linecap="round"/>
    <line x1="76" y1="40" x2="80" y2="44" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <path d="M86 52 L90 56 L88 58 L84 54Z" fill="#1a1a1a"/>
  </svg>`;
}
