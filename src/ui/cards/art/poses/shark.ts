/** Shark — seated, cards fanned in one hand, calculating lean forward. */
export function sharkPose(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
    <path d="M60 6 C56 6 53 9 53 13 C53 17 56 20 60 20 C64 20 67 17 67 13 C67 9 64 6 60 6Z" fill="#1a1a1a"/>
    <path d="M50 21 L54 23 L66 23 L70 21 L72 40 L70 55 L64 78 L56 78 L50 55 L48 40Z" fill="#1a1a1a"/>
    <path d="M70 21 L80 26 L86 32 L86 40 L82 40 L78 34Z" fill="#1a1a1a"/>
    <path d="M50 21 L40 26 L34 28 L32 34 L36 36 L42 32Z" fill="#1a1a1a"/>
    <rect x="48" y="55" width="10" height="10" rx="1" fill="#1a1a1a"/>
    <rect x="62" y="55" width="10" height="10" rx="1" fill="#1a1a1a"/>
    <rect x="82" y="33" width="6" height="9" rx="1" transform="rotate(-30 85 37)" fill="${accent}" opacity="0.8"/>
    <rect x="86" y="30" width="6" height="9" rx="1" transform="rotate(-15 89 34)" fill="${accent}" opacity="0.65"/>
    <rect x="89" y="28" width="6" height="9" rx="1" transform="rotate(0 92 32)" fill="${accent}" opacity="0.5"/>
    <rect x="30" y="34" width="10" height="6" rx="1" fill="#1a1a1a"/>
  </svg>`;
}
