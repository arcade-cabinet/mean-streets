export type DeviceClass = 'phone' | 'tablet' | 'desktop';
export type LayoutId =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop-wide'
  | 'folded'
  | 'unfolded';
export type Posture = 'flat' | 'folded' | 'unfolded';
export type Orientation = 'portrait' | 'landscape';

export interface ViewportSnapshot {
  width: number;
  height: number;
  orientation?: Orientation;
  posture?: Posture;
  platform?: 'web' | 'ios' | 'android';
}

export interface LayoutProfile {
  id: LayoutId;
  deviceClass: DeviceClass;
  orientation: Orientation;
  posture: Posture;
  compact: boolean;
  menuVariant: 'stacked' | 'split';
  deckbuilderVariant: 'stacked' | 'split';
  boardDensity: 'compact' | 'regular';
  handPlacement: 'bottom' | 'side';
  handPresentation: 'stack' | 'fan';
  actionPlacement: 'bottom' | 'side';
}

export interface TestViewportOverride extends ViewportSnapshot {}

declare global {
  interface Window {
    __MEAN_STREETS_VIEWPORT__?: TestViewportOverride;
    __MEAN_STREETS_TEST__?: boolean;
    TONE_SILENCE_LOGGING?: boolean;
    getWindowSegments?: () => Array<{ left: number; top: number; width: number; height: number }>;
  }
}

export function readViewportSnapshot(): ViewportSnapshot {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720, orientation: 'landscape', posture: 'flat', platform: 'web' };
  }

  const override = window.__MEAN_STREETS_VIEWPORT__;
  if (override) {
    return {
      width: override.width,
      height: override.height,
      orientation: override.orientation ?? inferOrientation(override.width, override.height),
      posture: override.posture ?? inferPosture(override.width, override.height),
      platform: override.platform ?? 'web',
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    width,
    height,
    orientation: inferOrientation(width, height),
    posture: inferPosture(width, height),
    platform: 'web',
  };
}

export function classifyLayout(snapshot: ViewportSnapshot): LayoutProfile {
  const orientation = snapshot.orientation ?? inferOrientation(snapshot.width, snapshot.height);
  const posture = snapshot.posture ?? inferPosture(snapshot.width, snapshot.height);
  const shortestSide = Math.min(snapshot.width, snapshot.height);
  const longestSide = Math.max(snapshot.width, snapshot.height);

  const deviceClass: DeviceClass =
    posture === 'unfolded'
      ? 'tablet'
      : shortestSide >= 900
        ? 'desktop'
        : shortestSide >= 700
          ? 'tablet'
          : 'phone';

  let id: LayoutId;
  if (posture === 'unfolded') {
    id = 'unfolded';
  } else if (posture === 'folded') {
    id = 'folded';
  } else if (deviceClass === 'desktop') {
    id = 'desktop-wide';
  } else {
    id = `${deviceClass}-${orientation}` as LayoutId;
  }

  const wide = orientation === 'landscape' || deviceClass !== 'phone' || posture === 'unfolded';

  return {
    id,
    deviceClass,
    orientation,
    posture,
    compact: shortestSide < 420 || posture === 'folded',
    menuVariant: wide ? 'split' : 'stacked',
    deckbuilderVariant: wide ? 'split' : 'stacked',
    boardDensity: longestSide < 740 ? 'compact' : 'regular',
    handPlacement: wide ? 'side' : 'bottom',
    handPresentation: wide ? 'fan' : 'stack',
    actionPlacement: wide ? 'side' : 'bottom',
  };
}

function inferOrientation(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

function inferPosture(_width: number, _height: number): Posture {
  // Posture detection is authoritative through the Viewport Segments
  // API (window.getWindowSegments); anything else is 'flat'. The
  // previous dimension-based heuristic (width < 420 && height > 820)
  // was flagging regular tall phones like Pixel 7 (412x839) as
  // "folded", which turned off their phone-portrait CSS rules.
  if (typeof window !== 'undefined') {
    const segmentCount = window.getWindowSegments?.().length ?? 0;
    if (segmentCount > 1) return 'unfolded';
  }
  return 'flat';
}
