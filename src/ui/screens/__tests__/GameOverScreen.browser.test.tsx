import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { emptyMetrics } from '../../../sim/turf/environment';
import { renderInBrowser } from '../../../test/render-browser';
import { GameOverScreen } from '../GameOverScreen';

describe('GameOverScreen', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
  });

  it('renders victory state with stats', async () => {
    const metrics = { ...emptyMetrics(), turns: 12, kills: 3, fundedRecruits: 1, seizures: 2 };
    cleanup = (await renderInBrowser(
      <GameOverScreen winner="A" metrics={metrics} onPlayAgain={() => {}} />,
    )).unmount;

    expect(document.querySelector('[data-testid="gameover-screen"]')).not.toBeNull();
    expect(document.querySelector('.gameover-title-victory')).not.toBeNull();
    expect(document.querySelector('.gameover-title')?.textContent).toBe('Victory');
  });

  it('renders defeat state', async () => {
    const metrics = emptyMetrics();
    cleanup = (await renderInBrowser(
      <GameOverScreen winner="B" metrics={metrics} onPlayAgain={() => {}} />,
    )).unmount;

    expect(document.querySelector('.gameover-title-defeat')).not.toBeNull();
    expect(document.querySelector('.gameover-title')?.textContent).toBe('Defeat');
  });

  it('displays metric values in stat rows', async () => {
    const metrics = { ...emptyMetrics(), turns: 15, kills: 7, fundedRecruits: 4, seizures: 3 };
    cleanup = (await renderInBrowser(
      <GameOverScreen winner="A" metrics={metrics} onPlayAgain={() => {}} />,
    )).unmount;

    const statValues = [...document.querySelectorAll('.gameover-stat-value')].map(e => e.textContent);
    expect(statValues).toContain('15');
    expect(statValues).toContain('7');
    expect(statValues).toContain('4');
    expect(statValues).toContain('3');
  });

  it('calls onPlayAgain when button is clicked', async () => {
    const onPlayAgain = vi.fn();
    cleanup = (await renderInBrowser(
      <GameOverScreen winner="A" metrics={emptyMetrics()} onPlayAgain={onPlayAgain} />,
    )).unmount;

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="play-again-button"]')!);
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('shows appropriate subtitle for victory vs defeat', async () => {
    const { unmount: unmount1 } = await renderInBrowser(
      <GameOverScreen winner="A" metrics={emptyMetrics()} onPlayAgain={() => {}} />,
    );
    const victorySub = document.querySelector('.gameover-subtitle')?.textContent ?? '';
    expect(victorySub).toContain('yours');
    unmount1();

    cleanup = (await renderInBrowser(
      <GameOverScreen winner="B" metrics={emptyMetrics()} onPlayAgain={() => {}} />,
    )).unmount;
    const defeatSub = document.querySelector('.gameover-subtitle')?.textContent ?? '';
    expect(defeatSub).toContain('lost');
  });
});
