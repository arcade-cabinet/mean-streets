/** Fence — arms crossed, crates and goods stacked behind, dealer posture. */
export function fencePose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M60 5 C56 5 53 8 53 12 C53 16 56 19 60 19 C64 19 67 16 67 12 C67 8 64 5 60 5Z" fill="#1a1a1a"/>
    <path d="M49 20 L53 22 L67 22 L71 20 L72 48 L68 78 L62 78 L60 50 L58 78 L52 78 L48 48Z" fill="#1a1a1a"/>
    <path d="M71 20 L79 28 L76 36 L68 32 L67 22Z" fill="#1a1a1a"/>
    <path d="M49 20 L41 28 L44 36 L52 32 L53 22Z" fill="#1a1a1a"/>
    <path d="M44 32 L68 32 L69 22 L67 22 L52 32Z" fill="#1a1a1a"/>
    <rect x="78" y="52" width="20" height="14" rx="1" fill="#1a1a1a"/>
    <line x1="88" y1="52" x2="88" y2="66" stroke="#1a1a1a" stroke-width="1.5"/>
    <line x1="78" y1="59" x2="98" y2="59" stroke="#1a1a1a" stroke-width="1.5"/>
    <rect x="80" y="54" width="7" height="4" rx="0.5" fill="${accent}" opacity="0.6"/>
    <rect x="89" y="61" width="7" height="4" rx="0.5" fill="${accent}" opacity="0.5"/>
    <rect x="80" y="40" width="16" height="11" rx="1" fill="#1a1a1a"/>
    <line x1="88" y1="40" x2="88" y2="51" stroke="#1a1a1a" stroke-width="1.5"/>
    <line x1="80" y1="45" x2="96" y2="45" stroke="#1a1a1a" stroke-width="1.5"/>
    <rect x="82" y="42" width="5" height="2.5" rx="0.5" fill="${accent}" opacity="0.7"/>
  </svg>`;
}
