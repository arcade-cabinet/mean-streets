/** Fixer — phone to ear, one hand gesturing open, connector posture. */
export function fixerPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M58 5 C54 5 51 8 51 12 C51 16 54 19 58 19 C62 19 65 16 65 12 C65 8 62 5 58 5Z" fill="#1a1a1a"/>
    <path d="M48 20 L52 22 L64 22 L68 20 L70 46 L66 78 L60 78 L58 48 L56 78 L50 78 L46 46Z" fill="#1a1a1a"/>
    <path d="M68 20 L76 22 L80 28 L80 36 L76 36 L74 30Z" fill="#1a1a1a"/>
    <rect x="76" y="20" width="4" height="8" rx="1.5" fill="${accent}" opacity="0.85"/>
    <path d="M48 20 L36 28 L32 40 L36 42 L42 32Z" fill="#1a1a1a"/>
    <path d="M34 36 L30 34 L28 30 L32 28 L36 32Z" fill="#1a1a1a"/>
    <line x1="28" y1="30" x2="22" y2="24" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="2,2"/>
    <line x1="28" y1="30" x2="18" y2="32" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="2,2"/>
    <line x1="28" y1="30" x2="22" y2="38" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="2,2"/>
  </svg>`;
}
