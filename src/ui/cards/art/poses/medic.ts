/** Medic — kneeling with medical bag open beside them, healer posture. */
export function medicPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M55 5 C51 5 48 8 48 12 C48 16 51 19 55 19 C59 19 62 16 62 12 C62 8 59 5 55 5Z" fill="#1a1a1a"/>
    <path d="M46 20 L50 22 L60 22 L64 20 L65 42 L60 55 L52 78 L46 78 L54 55 L55 42Z" fill="#1a1a1a"/>
    <path d="M46 20 L36 28 L34 38 L38 40 L44 30Z" fill="#1a1a1a"/>
    <path d="M64 20 L72 30 L72 44 L68 44 L66 32Z" fill="#1a1a1a"/>
    <path d="M55 42 L60 55 L70 78 L76 78 L64 52 L65 42Z" fill="#1a1a1a"/>
    <path d="M48 62 L44 60 L38 68 L38 78 L52 78 L52 68Z" fill="#1a1a1a"/>
    <rect x="70" y="56" width="16" height="12" rx="2" fill="#1a1a1a"/>
    <rect x="72" y="58" width="12" height="8" rx="1" fill="#1a1a1a"/>
    <rect x="76" y="59" width="4" height="6" rx="0.5" fill="${accent}" opacity="0.8"/>
    <rect x="74" y="61" width="8" height="2" rx="0.5" fill="${accent}" opacity="0.8"/>
    <path d="M33 36 L32 42 L38 40L36 38Z" fill="${accent}" opacity="0.6"/>
  </svg>`;
}
