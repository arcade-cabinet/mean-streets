import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellProvider } from '../../../platform';
import { StackFanModal } from '../StackFanModal';
import type { Turf, ToughCard, WeaponCard } from '../../../sim/turf/types';

function tough(id: string, name: string): ToughCard {
  return {
    kind: 'tough',
    id,
    name,
    tagline: '',
    archetype: 'bruiser',
    affiliation: 'kings_row',
    power: 5,
    resistance: 4,
    rarity: 'common',
    abilities: [],
  };
}

function weapon(): WeaponCard {
  return {
    kind: 'weapon',
    id: 'weapon-bat',
    name: 'Baseball Bat',
    category: 'blunt',
    power: 3,
    resistance: 1,
    rarity: 'common',
    abilities: [],
  };
}

function makeTurf(): Turf {
  return {
    id: 'test',
    stack: [
      tough('tough-a', 'Alpha'),
      weapon(),
      tough('tough-b', 'Bravo'),
    ],
  };
}

function wrap(ui: React.ReactElement) {
  return <AppShellProvider>{ui}</AppShellProvider>;
}

describe('StackFanModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      wrap(<StackFanModal turf={makeTurf()} open={false} onClose={vi.fn()} />),
    );
    expect(container.querySelector('.stack-fan-backdrop')).toBeNull();
  });

  it('renders nothing for empty stack even when open', () => {
    const turf: Turf = { id: 'empty', stack: [] };
    const { container } = render(
      wrap(<StackFanModal turf={turf} open={true} onClose={vi.fn()} />),
    );
    expect(container.querySelector('.stack-fan-backdrop')).toBeNull();
  });

  it('renders dialog when open with cards', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    expect(screen.getByTestId('stack-fan-test')).not.toBeNull();
    expect(screen.getByRole('dialog')).not.toBeNull();
  });

  it('shows stack count in header', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    expect(screen.getByText('Stack (3 cards)')).not.toBeNull();
  });

  it('defaults to showing the top card (last in stack)', () => {
    const { container } = render(
      wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />),
    );
    const activeCard = container.querySelector('.stack-fan-card-active');
    expect(activeCard).not.toBeNull();
    expect(activeCard!.textContent).toContain('Top');
  });

  it('shows position labels: Bottom, #N, Top', () => {
    const { container } = render(
      wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />),
    );
    const positions = container.querySelectorAll('.stack-fan-card-position');
    expect(positions[0].textContent).toBe('Bottom');
    expect(positions[1].textContent).toBe('#2');
    expect(positions[2].textContent).toBe('Top');
  });

  it('shows counter reflecting current card index', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    expect(screen.getByText('3 / 3')).not.toBeNull();
  });

  it('renders pips for each card in stack', () => {
    const { container } = render(
      wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />),
    );
    const pips = container.querySelectorAll('.stack-fan-pip');
    expect(pips.length).toBe(3);
    expect(pips[2].classList.contains('stack-fan-pip-active')).toBe(true);
  });

  it('navigates to previous card via prev button', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    const prevBtn = screen.getByLabelText('Previous card');
    fireEvent.click(prevBtn);
    expect(screen.getByText('2 / 3')).not.toBeNull();
  });

  it('navigates to next card via next button', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    fireEvent.click(screen.getByLabelText('Previous card'));
    fireEvent.click(screen.getByLabelText('Previous card'));
    expect(screen.getByText('1 / 3')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Next card'));
    expect(screen.getByText('2 / 3')).not.toBeNull();
  });

  it('disables prev button at first card', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    fireEvent.click(screen.getByLabelText('Previous card'));
    fireEvent.click(screen.getByLabelText('Previous card'));
    expect((screen.getByLabelText('Previous card') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables next button at last card', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    expect((screen.getByLabelText('Next card') as HTMLButtonElement).disabled).toBe(true);
  });

  it('navigates via pip click', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    fireEvent.click(screen.getByLabelText('View card 1'));
    expect(screen.getByText('1 / 3')).not.toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={onClose} />));
    fireEvent.click(screen.getByLabelText('Close stack fan'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={onClose} />));
    fireEvent.click(screen.getByTestId('stack-fan-test'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={onClose} />));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('navigates via ArrowLeft and ArrowRight keys', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    expect(screen.getByText('3 / 3')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('2 / 3')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('3 / 3')).not.toBeNull();
  });

  it('has aria-modal attribute', () => {
    render(wrap(<StackFanModal turf={makeTurf()} open={true} onClose={vi.fn()} />));
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
  });
});
