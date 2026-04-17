/** Ranged — side-profile pistol silhouette. */
export function rangedPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M25 38 L25 30 L85 30 L90 38 L85 38 L85 42 L60 42 L60 52 L50 52 L50 56 L36 56 L36 52 L30 52 L30 42 L25 42Z" fill="#1a1a1a"/>
    <rect x="85" y="32" width="10" height="4" rx="1" fill="#1a1a1a"/>
    <path d="M60 42 L60 52 L50 52 L50 42Z" fill="#1a1a1a"/>
    <circle cx="35" cy="31" r="2" fill="${accent}" opacity="0.8"/>
    <rect x="40" y="32" width="20" height="4" rx="1" fill="#1a1a1a" opacity="0.4"/>
    <path d="M27 38 L27 42 L30 42 L30 38Z" fill="${accent}" opacity="0.6"/>
    <rect x="26" y="52" width="24" height="4" rx="1" fill="#1a1a1a"/>
    <line x1="95" y1="34" x2="100" y2="34" stroke="${accent}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  </svg>`;
}
