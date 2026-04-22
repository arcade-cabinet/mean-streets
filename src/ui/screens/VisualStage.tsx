import type { ReactNode } from 'react';
import {
  silhouetteIconPath,
  type SilhouetteIconId,
} from '../iconography/silhouetteIconography';

export const CONTRABAND_ASSETS = {
  duffel: new URL(
    '../../../raw-assets/sprites/contraband/duffel-bag.png',
    import.meta.url,
  ).href,
  evidenceBag: new URL(
    '../../../raw-assets/sprites/contraband/paper-bag.png',
    import.meta.url,
  ).href,
  cash: new URL(
    '../../../raw-assets/sprites/contraband/cash-stack.png',
    import.meta.url,
  ).href,
  burner: new URL(
    '../../../raw-assets/sprites/contraband/burner-phone.png',
    import.meta.url,
  ).href,
  bricks: new URL(
    '../../../raw-assets/sprites/contraband/wrapped-bricks.png',
    import.meta.url,
  ).href,
  knuckles: new URL(
    '../../../raw-assets/sprites/contraband/brass-knuckles.png',
    import.meta.url,
  ).href,
} as const;

const AMBIENT_ICONS: SilhouetteIconId[] = [
  'tutorial-stack',
  'tutorial-heat',
  'difficulty-body-bags',
];

interface AmbientSilhouetteLayerProps {
  variant?: 'menu' | 'street' | 'spoils';
}

export function AmbientSilhouetteLayer({
  variant = 'street',
}: AmbientSilhouetteLayerProps) {
  return (
    <div
      className={`ambient-silhouette-layer ambient-silhouette-layer-${variant}`}
      aria-hidden="true"
    >
      {AMBIENT_ICONS.map((icon, index) => (
        <img
          key={`${icon}-${index}`}
          src={silhouetteIconPath(icon)}
          alt=""
          draggable={false}
        />
      ))}
    </div>
  );
}

interface ContrabandPropProps {
  asset: keyof typeof CONTRABAND_ASSETS;
  className?: string;
}

export function ContrabandProp({ asset, className }: ContrabandPropProps) {
  return (
    <img
      className={`contraband-prop ${className ?? ''}`.trim()}
      src={CONTRABAND_ASSETS[asset]}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

interface ScreenHeaderCardProps {
  kicker: string;
  title: string;
  copy?: string;
  children?: ReactNode;
  className?: string;
}

export function ScreenHeaderCard({
  kicker,
  title,
  copy,
  children,
  className,
}: ScreenHeaderCardProps) {
  return (
    <header className={`screen-header-card ${className ?? ''}`.trim()}>
      <div>
        <p className="screen-header-kicker">{kicker}</p>
        <h1 className="screen-header-title">{title}</h1>
        {copy && <p className="screen-header-copy">{copy}</p>}
      </div>
      {children}
    </header>
  );
}
