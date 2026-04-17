/** Lookout — perched high, one hand shielding eyes, scanning. */
export function lookoutPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M65 8 C61 8 58 11 58 15 C58 19 61 22 65 22 C69 22 72 19 72 15 C72 11 69 8 65 8Z" fill="#1a1a1a"/>
    <path d="M57 23 L60 25 L70 25 L73 23 L74 42 L70 78 L64 78 L63 48 L62 78 L56 78 L55 42Z" fill="#1a1a1a"/>
    <path d="M73 23 L82 18 L86 14 L88 17 L80 24Z" fill="#1a1a1a"/>
    <path d="M57 23 L48 35 L44 48 L48 49 L54 35Z" fill="#1a1a1a"/>
    <rect x="30" y="70" width="25" height="8" rx="2" fill="#1a1a1a" opacity="0.4"/>
    <circle cx="87" cy="15" r="3" fill="${accent}" opacity="0.6"/>
  </svg>`;
}
