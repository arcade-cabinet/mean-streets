import type {
  AuthoredTough,
  AuthoredWeapon,
  AuthoredDrug,
  AuthoredCurrency,
  CompiledTough,
  CompiledWeapon,
  CompiledDrug,
  CompiledCurrency,
} from './schemas';
import { latestStat, latestRarity } from './schemas';

export function compileTough(authored: AuthoredTough): CompiledTough {
  return {
    kind: 'tough',
    id: authored.id,
    name: authored.name,
    ...(authored.tagline ? { tagline: authored.tagline } : {}),
    archetype: authored.archetype,
    affiliation: authored.affiliation,
    power: latestStat(authored.power),
    resistance: latestStat(authored.resistance),
    maxHp: authored.maxHp,
    hp: authored.hp,
    rarity: latestRarity(authored.rarity),
    abilities: authored.abilities,
    unlocked: authored.unlocked,
    ...(authored.unlockCondition
      ? { unlockCondition: authored.unlockCondition }
      : {}),
    locked: authored.locked,
    portrait: authored.portrait,
  };
}

export function compileWeapon(authored: AuthoredWeapon): CompiledWeapon {
  return {
    kind: 'weapon',
    id: authored.id,
    name: authored.name,
    category: authored.category,
    power: latestStat(authored.power),
    resistance: latestStat(authored.resistance),
    rarity: latestRarity(authored.rarity),
    abilities: authored.abilities,
    unlocked: authored.unlocked,
    ...(authored.unlockCondition
      ? { unlockCondition: authored.unlockCondition }
      : {}),
    locked: authored.locked,
    portrait: authored.portrait,
  };
}

export function compileDrug(authored: AuthoredDrug): CompiledDrug {
  return {
    kind: 'drug',
    id: authored.id,
    name: authored.name,
    category: authored.category,
    power: latestStat(authored.power),
    resistance: latestStat(authored.resistance),
    rarity: latestRarity(authored.rarity),
    abilities: authored.abilities,
    unlocked: authored.unlocked,
    ...(authored.unlockCondition
      ? { unlockCondition: authored.unlockCondition }
      : {}),
    locked: authored.locked,
    portrait: authored.portrait,
  };
}

export function compileCurrency(authored: AuthoredCurrency): CompiledCurrency {
  return {
    kind: 'currency',
    id: authored.id,
    name: authored.name,
    denomination: authored.denomination,
    rarity: latestRarity(authored.rarity),
    ...(authored.abilities ? { abilities: authored.abilities } : {}),
    unlocked: authored.unlocked,
    locked: authored.locked,
    portrait: authored.portrait,
  };
}
