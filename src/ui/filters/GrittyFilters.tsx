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
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" />
          {/* Desaturate to greyscale (luminance coeffs) and heavily reduce
              alpha so the noise reads as subtle grain, not rainbow. */}
          <feColorMatrix
            type="matrix"
            values="
              0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0.33 0.33 0.33 0 0
              0    0    0    0.08 0"
            in="noise"
            result="grey"
          />
          <feBlend in="SourceGraphic" in2="grey" mode="multiply" />
          <feDropShadow dx="4" dy="12" stdDeviation="6" floodColor="#000" floodOpacity="0.9" />
        </filter>
      </defs>
    </svg>
  );
}
