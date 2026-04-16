/**
 * Desktop/tablet side panels + phone modal triggers for GameScreen.
 *
 * Pulled out to keep GameScreen.tsx under the 300-LOC ceiling. This file
 * is pure composition over the shared board components; all action
 * routing stays in GameScreen.
 */
import type { ModifierCard, Rarity, ToughInCustody } from '../../sim/turf/types';
import { BlackMarketPanel, HoldingPanel } from '../board';

export interface GameSidebarProps {
  market: ModifierCard[];
  holdingA: ToughInCustody[];
  holdingB: ToughInCustody[];
  lockupA: ToughInCustody[];
  lockupB: ToughInCustody[];
  healTargetName?: string;
  onMarketTrade: (ids: string[], targetRarity: Rarity) => void;
  onMarketHeal: (ids: string[]) => void;
}

export function GameDesktopLeftSidebar(props: GameSidebarProps) {
  return (
    <aside className="game-sidebar game-sidebar-left" data-testid="game-sidebar-left">
      <BlackMarketPanel
        pool={props.market}
        side="A"
        onTrade={props.onMarketTrade}
        onHeal={props.onMarketHeal}
        healTargetName={props.healTargetName}
      />
    </aside>
  );
}

export function GameDesktopRightSidebar(props: GameSidebarProps) {
  return (
    <aside className="game-sidebar game-sidebar-right" data-testid="game-sidebar-right">
      <HoldingPanel side="A" holding={props.holdingA} lockup={props.lockupA} />
      <HoldingPanel side="B" holding={props.holdingB} lockup={props.lockupB} opponent />
    </aside>
  );
}

interface MobileTriggersProps {
  marketCount: number;
  custodyCount: number;
  onOpenMarket: () => void;
  onOpenCustody: () => void;
}

export function GameMobileTriggers(props: MobileTriggersProps) {
  return (
    <div className="game-mobile-modal-triggers">
      <button
        className="game-mobile-trigger"
        onClick={props.onOpenMarket}
        data-testid="mobile-market-trigger"
      >
        Market ({props.marketCount})
      </button>
      <button
        className="game-mobile-trigger"
        onClick={props.onOpenCustody}
        data-testid="mobile-holding-trigger"
      >
        Custody ({props.custodyCount})
      </button>
    </div>
  );
}

interface MobileCustodyProps {
  holdingA: ToughInCustody[];
  holdingB: ToughInCustody[];
  lockupA: ToughInCustody[];
  lockupB: ToughInCustody[];
  onClose: () => void;
}

interface MobileMarketProps {
  market: ModifierCard[];
  healTargetName?: string;
  onTrade: (ids: string[], rarity: Rarity) => void;
  onHeal: (ids: string[]) => void;
  onClose: () => void;
}

export function GameMobileMarketModal(props: MobileMarketProps) {
  return (
    <BlackMarketPanel
      pool={props.market}
      side="A"
      modal
      onTrade={props.onTrade}
      onHeal={props.onHeal}
      healTargetName={props.healTargetName}
      onClose={props.onClose}
    />
  );
}

export function GameMobileCustodyModal(props: MobileCustodyProps) {
  return (
    <div
      className="game-mobile-custody-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
      data-testid="game-mobile-custody"
    >
      <div
        className="game-mobile-custody"
        onClick={(e) => e.stopPropagation()}
      >
        <HoldingPanel side="A" holding={props.holdingA} lockup={props.lockupA} compact />
        <HoldingPanel side="B" holding={props.holdingB} lockup={props.lockupB} opponent compact />
      </div>
    </div>
  );
}
