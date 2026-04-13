import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAppShell } from '../../platform';
import type { CrewCard, ModifierCard } from '../../sim/turf/types';
import { QuarterCard } from '../cards';
import { createDeckCatalog } from '../deckbuilder/catalog';
import {
  loadCrewPresets,
  loadDeckLoadouts,
  loadModifierPresets,
  saveCrewPreset,
  saveDeckLoadout,
  saveModifierPreset,
  type CardPreset,
  type DeckLoadout,
} from '../deckbuilder/storage';
import {
  MODIFIER_MINIMUMS,
  countModifierComposition,
  hasValidModifierComposition,
} from '../deckbuilder/rules';

interface DeckBuilderScreenProps {
  onBack: () => void;
  onStartGame: (deck: { crew: CrewCard[]; modifiers: ModifierCard[] }) => void;
}

type ModifierTab = 'all' | 'weapon' | 'product' | 'cash';
type SelectionMode = 'add' | 'remove' | null;

const CREW_GOAL = 25;
const MOD_GOAL = 25;

function nowId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}

function cardName(card: CrewCard | ModifierCard): string {
  if (card.type === 'crew') return card.displayName;
  if (card.type === 'cash') return `$${card.denomination}`;
  return card.name;
}

function applyPresetIds(
  presetIds: string[],
  allIds: string[],
  cap: number,
): string[] {
  return presetIds.filter((id) => allIds.includes(id)).slice(0, cap);
}

function cardIsLocked(card: CrewCard | ModifierCard): boolean {
  return card.type === 'cash' ? false : card.locked;
}

interface LaneHeaderProps {
  title: string;
  subtitle: string;
  count: number;
  goal: number;
  presetName: string;
  presetOptions: CardPreset[];
  selectedPresetId: string;
  onPresetNameChange: (value: string) => void;
  onPresetSelect: (value: string) => void;
  onSavePreset: () => void;
  children?: ReactNode;
}

function LaneHeader({
  title,
  subtitle,
  count,
  goal,
  presetName,
  presetOptions,
  selectedPresetId,
  onPresetNameChange,
  onPresetSelect,
  onSavePreset,
  children,
}: LaneHeaderProps) {
  return (
    <div className="deck-lane-header">
      <div>
        <p className="deck-lane-kicker">{subtitle}</p>
        <div className="deck-lane-title-row">
          <h2 className="deck-lane-title">{title}</h2>
          <span className={`deck-counter ${count === goal ? 'deck-counter-complete' : ''}`}>
            {count}/{goal}
          </span>
        </div>
      </div>

      <div className="deck-lane-controls">
        {children}
        <select
          className="deck-select"
          value={selectedPresetId}
          onChange={(event) => onPresetSelect(event.target.value)}
        >
          <option value="">Load preset</option>
          {presetOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <input
          className="deck-input"
          value={presetName}
          onChange={(event) => onPresetNameChange(event.target.value)}
          placeholder={`Name ${title.toLowerCase()} preset`}
        />
        <button className="deck-mini-button" onClick={onSavePreset}>
          Save
        </button>
      </div>
    </div>
  );
}

export function DeckBuilderScreen({ onBack, onStartGame }: DeckBuilderScreenProps) {
  const { layout } = useAppShell();
  const { allCrew, allModifiers } = useMemo(() => {
    const catalog = createDeckCatalog();
    return { allCrew: catalog.crew, allModifiers: catalog.modifiers };
  }, []);

  const [selectedCrewIds, setSelectedCrewIds] = useState<string[]>([]);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [modifierTab, setModifierTab] = useState<ModifierTab>('all');
  const [crewPresetName, setCrewPresetName] = useState('');
  const [modifierPresetName, setModifierPresetName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [selectedCrewPresetId, setSelectedCrewPresetId] = useState('');
  const [selectedModifierPresetId, setSelectedModifierPresetId] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [crewPresets, setCrewPresets] = useState<CardPreset[]>([]);
  const [modifierPresets, setModifierPresets] = useState<CardPreset[]>([]);
  const [savedDecks, setSavedDecks] = useState<DeckLoadout[]>([]);
  const [pointerDown, setPointerDown] = useState<'crew' | 'modifier' | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(null);

  useEffect(() => {
    void (async () => {
      const [nextCrew, nextMods, nextDecks] = await Promise.all([
        loadCrewPresets(),
        loadModifierPresets(),
        loadDeckLoadouts(),
      ]);
      setCrewPresets(nextCrew);
      setModifierPresets(nextMods);
      setSavedDecks(nextDecks);
    })();
  }, []);

  const visibleModifiers = useMemo(() => {
    if (modifierTab === 'all') return allModifiers;
    return allModifiers.filter((card) => card.type === modifierTab);
  }, [allModifiers, modifierTab]);

  const selectedCrew = useMemo(
    () => selectedCrewIds
      .map((id) => allCrew.find((card) => card.id === id))
      .filter((card): card is CrewCard => !!card),
    [allCrew, selectedCrewIds],
  );

  const selectedModifiers = useMemo(
    () => selectedModifierIds
      .map((id) => allModifiers.find((card) => card.id === id))
      .filter((card): card is ModifierCard => !!card),
    [allModifiers, selectedModifierIds],
  );

  const modifierComposition = useMemo(
    () => countModifierComposition(selectedModifiers),
    [selectedModifiers],
  );
  const hasLegalModifierMix = useMemo(
    () => hasValidModifierComposition(selectedModifiers),
    [selectedModifiers],
  );

  const canSaveDeck = selectedCrew.length === CREW_GOAL
    && selectedModifiers.length === MOD_GOAL
    && hasLegalModifierMix
    && deckName.trim().length > 0;
  const canStartGame = selectedCrew.length === CREW_GOAL
    && selectedModifiers.length === MOD_GOAL
    && hasLegalModifierMix;

  function toggleCrew(id: string, forcedMode?: SelectionMode) {
    setSelectedCrewIds((prev) => {
      const selected = prev.includes(id);
      const mode = forcedMode ?? (selected ? 'remove' : 'add');
      if (mode === 'add') {
        if (selected || prev.length >= CREW_GOAL) return prev;
        return [...prev, id];
      }
      return prev.filter((cardId) => cardId !== id);
    });
  }

  function toggleModifier(id: string, forcedMode?: SelectionMode) {
    setSelectedModifierIds((prev) => {
      const selected = prev.includes(id);
      const mode = forcedMode ?? (selected ? 'remove' : 'add');
      if (mode === 'add') {
        if (selected || prev.length >= MOD_GOAL) return prev;
        return [...prev, id];
      }
      return prev.filter((cardId) => cardId !== id);
    });
  }

  function handleCrewPointerDown(id: string) {
    setPointerDown('crew');
    const nextMode: SelectionMode = selectedCrewIds.includes(id) ? 'remove' : 'add';
    setSelectionMode(nextMode);
    toggleCrew(id, nextMode);
  }

  function handleModifierPointerDown(id: string) {
    setPointerDown('modifier');
    const nextMode: SelectionMode = selectedModifierIds.includes(id) ? 'remove' : 'add';
    setSelectionMode(nextMode);
    toggleModifier(id, nextMode);
  }

  function stopPointerSelection() {
    setPointerDown(null);
    setSelectionMode(null);
  }

  function saveCrewSelectionPreset() {
    if (!crewPresetName.trim()) return;
    void (async () => {
      const next = await saveCrewPreset({
        id: nowId('crew-preset'),
        name: crewPresetName.trim(),
        cardIds: selectedCrewIds,
        updatedAt: new Date().toISOString(),
      });
      setCrewPresets(next);
      setCrewPresetName('');
    })();
  }

  function saveModifierSelectionPreset() {
    if (!modifierPresetName.trim()) return;
    void (async () => {
      const next = await saveModifierPreset({
        id: nowId('mod-preset'),
        name: modifierPresetName.trim(),
        cardIds: selectedModifierIds,
        updatedAt: new Date().toISOString(),
      });
      setModifierPresets(next);
      setModifierPresetName('');
    })();
  }

  function loadCrewSelectionPreset(presetId: string) {
    setSelectedCrewPresetId(presetId);
    const preset = crewPresets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setSelectedCrewIds(applyPresetIds(preset.cardIds, allCrew.map((card) => card.id), CREW_GOAL));
  }

  function loadModifierSelectionPreset(presetId: string) {
    setSelectedModifierPresetId(presetId);
    const preset = modifierPresets.find((entry) => entry.id === presetId);
    if (!preset) return;
    setSelectedModifierIds(applyPresetIds(preset.cardIds, allModifiers.map((card) => card.id), MOD_GOAL));
  }

  function saveDeck() {
    if (!canSaveDeck) return;
    void (async () => {
      const nextDecks = await saveDeckLoadout({
        id: nowId('deck'),
        name: deckName.trim(),
        crewIds: selectedCrewIds,
        modifierIds: selectedModifierIds,
        updatedAt: new Date().toISOString(),
      });
      setSavedDecks(nextDecks);
      setSelectedDeckId(nextDecks[0]?.id ?? '');
      setDeckName('');
    })();
  }

  function handleStartGame() {
    if (!canStartGame) return;
    onStartGame({
      crew: selectedCrew,
      modifiers: selectedModifiers,
    });
  }

  function loadDeck(deckId: string) {
    setSelectedDeckId(deckId);
    const deck = savedDecks.find((entry) => entry.id === deckId);
    if (!deck) return;
    setSelectedCrewIds(applyPresetIds(deck.crewIds, allCrew.map((card) => card.id), CREW_GOAL));
    setSelectedModifierIds(applyPresetIds(deck.modifierIds, allModifiers.map((card) => card.id), MOD_GOAL));
    setDeckName(deck.name);
  }

  return (
    <div
      className={`deckbuilder-shell deckbuilder-shell-${layout.deckbuilderVariant}`}
      data-testid="deckbuilder-screen"
      data-layout-variant={layout.deckbuilderVariant}
      onPointerUp={stopPointerSelection}
      onPointerCancel={stopPointerSelection}
      onPointerLeave={() => {
        if (!pointerDown) return;
        stopPointerSelection();
      }}
    >
      <header className="deckbuilder-header">
        <div>
          <p className="deckbuilder-kicker">Deck Workshop</p>
          <h1 className="deckbuilder-title">Build The Crew</h1>
        </div>

        <div className="deckbuilder-actions">
          <select className="deck-select" value={selectedDeckId} onChange={(event) => loadDeck(event.target.value)}>
            <option value="">Load saved deck</option>
            {savedDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
          <input
            className="deck-input deck-input-wide"
            value={deckName}
            onChange={(event) => setDeckName(event.target.value)}
            placeholder="Name full deck loadout"
            data-testid="deck-name-input"
          />
          <button className="deck-mini-button" onClick={saveDeck} disabled={!canSaveDeck} data-testid="save-deck-button">
            Save Deck
          </button>
          <button className="deck-mini-button" onClick={onBack}>
            Menu
          </button>
          <button
            className={`menu-button menu-button-primary ${!canStartGame ? 'menu-button-disabled' : ''}`}
            onClick={handleStartGame}
            disabled={!canStartGame}
            data-testid="start-game-button"
          >
            <span className="menu-button-label">Start Game</span>
          </button>
        </div>
      </header>

      <section className="deck-lane">
        <LaneHeader
          title="Crew"
          subtitle="Swipe or drag across full-size cards to mark the lineup."
          count={selectedCrew.length}
          goal={CREW_GOAL}
          presetName={crewPresetName}
          presetOptions={crewPresets}
          selectedPresetId={selectedCrewPresetId}
          onPresetNameChange={setCrewPresetName}
          onPresetSelect={loadCrewSelectionPreset}
          onSavePreset={saveCrewSelectionPreset}
        />

        <div className="deck-rail" data-testid="crew-rail">
          {allCrew.map((card) => {
            const selected = selectedCrewIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                data-card-type="crew"
                data-testid={`collection-card-${card.id}`}
                className={`deck-card deck-card-full ${selected ? 'deck-card-selected' : ''} ${card.locked ? 'deck-card-locked' : ''}`}
                onPointerDown={() => handleCrewPointerDown(card.id)}
                onPointerEnter={() => {
                  if (pointerDown === 'crew' && selectionMode) toggleCrew(card.id, selectionMode);
                }}
                disabled={card.locked}
                title={card.unlockCondition}
              >
                <div className="deck-card-topline">
                  <span className="deck-card-power">P{card.power}</span>
                  <span className="deck-card-defense">R{card.resistance}</span>
                </div>
                <div className="deck-card-name">{card.displayName}</div>
                <div className="deck-card-meta">{card.affiliation}</div>
                <div className="deck-card-ability">{card.archetype}</div>
                {selected && <span className="deck-card-badge">Selected</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="deck-lane">
        <LaneHeader
          title="Modifiers"
          subtitle="Tap or drag through quarter-cards to stack the tools, cash, and product."
          count={selectedModifiers.length}
          goal={MOD_GOAL}
          presetName={modifierPresetName}
          presetOptions={modifierPresets}
          selectedPresetId={selectedModifierPresetId}
          onPresetNameChange={setModifierPresetName}
          onPresetSelect={loadModifierSelectionPreset}
          onSavePreset={saveModifierSelectionPreset}
        >
          <div className="deck-tab-row">
            {(['all', 'weapon', 'product', 'cash'] as ModifierTab[]).map((tab) => (
              <button
                key={tab}
                className={`deck-tab ${modifierTab === tab ? 'deck-tab-active' : ''}`}
                onClick={() => setModifierTab(tab)}
                data-testid={
                  tab === 'all'
                    ? 'tab-all'
                    : tab === 'weapon'
                      ? 'tab-weapons'
                      : tab === 'product'
                        ? 'tab-drugs'
                        : 'tab-cash'
                }
              >
                {tab === 'all' ? 'All' : tab === 'product' ? 'Drugs' : `${tab[0].toUpperCase()}${tab.slice(1)}s`}
              </button>
            ))}
          </div>
        </LaneHeader>

        <div className="deck-rail deck-rail-quarters" data-testid="modifier-rail">
          {visibleModifiers.map((card) => {
            const selected = selectedModifierIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                data-card-type={card.type}
                data-testid={`collection-card-${card.id}`}
                className={`deck-card deck-card-quarter ${selected ? 'deck-card-selected' : ''} ${cardIsLocked(card) ? 'deck-card-locked' : ''}`}
                onPointerDown={() => handleModifierPointerDown(card.id)}
                onPointerEnter={() => {
                  if (pointerDown === 'modifier' && selectionMode) toggleModifier(card.id, selectionMode);
                }}
                disabled={cardIsLocked(card)}
                title={card.type === 'cash' ? 'Cash card' : card.unlockCondition}
              >
                <QuarterCard card={card} compact />
                <span className="deck-quarter-name">{cardName(card)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="deckbuilder-footer">
        <div className="deckbuilder-summary">
          <span className={`deck-counter ${selectedCrew.length === CREW_GOAL ? 'deck-counter-complete' : ''}`}>Crew {selectedCrew.length}/25</span>
          <span className={`deck-counter ${selectedModifiers.length === MOD_GOAL ? 'deck-counter-complete' : ''}`}>Mods {selectedModifiers.length}/25</span>
          <span
            className={`deck-counter ${modifierComposition.weapon >= MODIFIER_MINIMUMS.weapon ? 'deck-counter-complete' : ''}`}
            data-testid="modifier-rule-weapons"
          >
            Weapons {modifierComposition.weapon}/3
          </span>
          <span
            className={`deck-counter ${modifierComposition.product >= MODIFIER_MINIMUMS.product ? 'deck-counter-complete' : ''}`}
            data-testid="modifier-rule-drugs"
          >
            Drugs {modifierComposition.product}/3
          </span>
          <span
            className={`deck-counter ${modifierComposition.cash >= MODIFIER_MINIMUMS.cash ? 'deck-counter-complete' : ''}`}
            data-testid="modifier-rule-cash"
          >
            Cash {modifierComposition.cash}/3
          </span>
          <span className="deckbuilder-note">Selected cards stay highlighted until removed or replaced by a loaded preset.</span>
        </div>
      </footer>
    </div>
  );
}
