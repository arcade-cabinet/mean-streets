/** Snitch — leaning against a wall, phone in hand. */
export function snitchPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M55 5 C51 5 48 8 48 12 C48 16 51 19 55 19 C59 19 62 16 62 12 C62 8 59 5 55 5Z" fill="#1a1a1a"/>
    <path d="M47 20 L50 22 L60 22 L63 20 L65 40 L62 78 L56 78 L55 45 L54 78 L48 78 L45 40Z" fill="#1a1a1a"/>
    <path d="M63 20 L72 28 L74 35 L70 36 L65 30Z" fill="#1a1a1a"/>
    <path d="M47 20 L40 32 L38 42 L42 43 L48 30Z" fill="#1a1a1a"/>
    <rect x="72" y="30" width="4" height="7" rx="1" fill="${accent}" opacity="0.8"/>
    <line x1="85" y1="20" x2="85" y2="78" stroke="#1a1a1a" stroke-width="3"/>
  </svg>`;
}
