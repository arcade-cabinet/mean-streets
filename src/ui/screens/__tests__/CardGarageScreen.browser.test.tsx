import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderInBrowser, settleBrowser } from '../../../test/render-browser';
import {
  loadProfile,
  resetPersistenceForTests,
  saveProfile,
} from '../../../ui/deckbuilder/storage';
import { saveCollection } from '../../../platform/persistence/collection';
import { loadToughCards } from '../../../sim/cards/catalog';
import {
  generateDrugs,
  generateWeapons,
  loadCurrencyCatalog,
} from '../../../sim/turf/generators';
import { CardGarageScreen } from '../CardGarageScreen';

async function waitForSelector(selector: string, timeoutMs = 10000): Promise<Element | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const match = document.querySelector(selector);
    if (match) return match;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return document.querySelector(selector);
}

async function seedGarageCollection(): Promise<void> {
  await saveCollection([
    loadToughCards()[0],
    generateWeapons()[0],
    generateDrugs()[0],
    loadCurrencyCatalog()[0],
  ]);
}

describe('CardGarageScreen', () => {
  let cleanup: (() => void) | undefined;

  afterEach(async () => {
    await resetPersistenceForTests();
    cleanup?.();
  });

  it('renders loading state then loads collection', async () => {
    await seedGarageCollection();
    cleanup = (await renderInBrowser(
      <CardGarageScreen onBack={() => {}} />,
    )).unmount;

    expect(document.querySelector('[data-testid="card-garage-screen"]')).not.toBeNull();
    await waitForSelector('.garage-header-copy');
    expect(document.querySelector('.garage-loading')).toBeNull();
  });

  it('shows category sections after loading', async () => {
    await seedGarageCollection();
    cleanup = (await renderInBrowser(
      <CardGarageScreen onBack={() => {}} />,
    )).unmount;

    await waitForSelector('[data-testid="garage-section-tough"]');

    expect(document.querySelector('[data-testid="garage-section-tough"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="garage-section-weapon"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="garage-section-drug"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="garage-section-currency"]')).not.toBeNull();
  });

  it('shows difficulty filter bar', async () => {
    await seedGarageCollection();
    cleanup = (await renderInBrowser(
      <CardGarageScreen onBack={() => {}} />,
    )).unmount;

    await waitForSelector('[data-testid="garage-diff-filter"]');

    expect(document.querySelector('[data-testid="garage-diff-all"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="garage-diff-easy"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="garage-diff-medium"]')).not.toBeNull();
  });

  it('back button calls onBack', async () => {
    await seedGarageCollection();
    const onBack = vi.fn();
    cleanup = (await renderInBrowser(
      <CardGarageScreen onBack={onBack} />,
    )).unmount;

    await waitForSelector('[data-testid="garage-back"]');
    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="garage-back"]')!);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('difficulty filter changes visible cards', async () => {
    await seedGarageCollection();
    cleanup = (await renderInBrowser(
      <CardGarageScreen onBack={() => {}} />,
    )).unmount;

    await waitForSelector('[data-testid="garage-diff-filter"]');

    await userEvent.click(document.querySelector<HTMLButtonElement>('[data-testid="garage-diff-medium"]')!);
    await settleBrowser();

    const subtitle = document.querySelector('.garage-subtitle')?.textContent ?? '';
    expect(subtitle).toContain('unlocked');
  });

  it('merges duplicate copies into the next rolled rarity and persists the result', async () => {
    const profile = await loadProfile();
    profile.unlockedCardIds = ['card-001'];
    profile.cardInstances = {
      'card-001': {
        rolledRarity: 'common',
        unlockDifficulty: 'hard',
      },
    };
    profile.cardInventory = [
      {
        cardId: 'card-001',
        rolledRarity: 'common',
        unlockDifficulty: 'easy',
      },
      {
        cardId: 'card-001',
        rolledRarity: 'common',
        unlockDifficulty: 'hard',
      },
    ];
    await saveProfile(profile);

    cleanup = (await renderInBrowser(
      <CardGarageScreen onBack={() => {}} />,
    )).unmount;

    await waitForSelector('[data-testid="garage-merge-card-001-common"]');
    await userEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="garage-merge-card-001-common"]',
      )!,
    );
    await settleBrowser();
    await waitForSelector('[data-testid="garage-row-card-001-uncommon"]');

    const updated = await loadProfile();
    expect(updated.cardInventory).toEqual([
      {
        cardId: 'card-001',
        rolledRarity: 'uncommon',
        unlockDifficulty: 'hard',
      },
    ]);
    expect(updated.cardInstances?.['card-001']).toEqual({
      rolledRarity: 'uncommon',
      unlockDifficulty: 'hard',
    });
    expect(
      document.querySelector('[data-testid="garage-row-card-001-common"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="garage-row-card-001-uncommon"]'),
    ).not.toBeNull();
  });
});
