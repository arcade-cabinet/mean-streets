export function GrittyFilters() {
  return (
    <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
      <defs>
        <filter id="ragged-edge">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="grime">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0" in="noise" result="coloredNoise" />
          <feBlend in="SourceGraphic" in2="coloredNoise" mode="multiply" />
        </filter>
        <filter id="metallic">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.4 0" in="noise" result="coloredNoise" />
          <feBlend in="SourceGraphic" in2="coloredNoise" mode="multiply" />
          <feDropShadow dx="4" dy="12" stdDeviation="6" floodColor="#000" floodOpacity="0.9" />
          <feComponentTransfer><feFuncA type="linear" slope="1.5" /></feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
