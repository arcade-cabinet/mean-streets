import cardsData from '../../data/cards.json';
import { type CharacterCard, CharacterCardSchema } from './schemas';

interface AuthoredCrewCardRecord {
  id: string;
  displayName: string;
  archetype: string;
  affiliation: string;
  dayAtk: number;
  dayDef: number;
  nightAtk: number;
  nightDef: number;
  abilityDesc: string;
  unlocked: boolean;
}

const authoredCards = cardsData as AuthoredCrewCardRecord[];

function toCharacterCard(card: AuthoredCrewCardRecord): CharacterCard {
  const normalized: CharacterCard = {
    id: card.id,
    displayName: card.displayName,
    archetype: card.archetype,
    affiliation: card.affiliation,
    // The active turf engine uses one attack/resistance pair, so authored day/night
    // values are collapsed to the stronger side for now instead of inventing extra rules.
    power: Math.max(card.dayAtk, card.nightAtk),
    resistance: Math.max(card.dayDef, card.nightDef),
    abilityText: card.abilityDesc,
    unlocked: card.unlocked,
    locked: false,
  };

  return CharacterCardSchema.parse(normalized);
}

export function loadAuthoredCrewCards(): CharacterCard[] {
  return authoredCards.map(toCharacterCard);
}

export function loadStarterCrewCards(starterCount = 25): CharacterCard[] {
  return loadAuthoredCrewCards().map((card, index) => ({
    ...card,
    unlocked: index < starterCount || card.unlocked,
  }));
}
