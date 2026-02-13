import type { Ancestries, Backgrounds, Classes } from "../api/index";

/**
 * XP required to reach the next level from level n.
 */
export function calculateXpToNextLevel(n: number): number {
  if (n < 1) return 1;
  let xpToNextLevel = 2;
  let multiplier = 1.1;
  for (let level = 1; level < n; level++) {
    xpToNextLevel = Math.ceil(xpToNextLevel * multiplier);
    if (level < 200 && level % 10 === 0) {
      multiplier = Math.max(multiplier - 0.005, 1.01);
    }
  }
  return xpToNextLevel;
}

export function calculateSpeed(
  ancestry: Ancestries | null,
  background: Backgrounds | null,
  characterClass: Classes | null
): number {
  return (
    30 +
    (ancestry?.bonusSpeed ?? 0) +
    (background?.bonusSpeed ?? 0) +
    (characterClass?.bonusSpeed ?? 0)
  );
}

export function calculateAttributes(
  ancestry: Ancestries | null,
  background: Backgrounds | null,
  characterClass: Classes | null
): {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
} {
  return {
    STR:
      10 +
      (ancestry?.bonusStrength ?? 0) +
      (background?.bonusStrength ?? 0) +
      (characterClass?.bonusStrength ?? 0),
    DEX:
      10 +
      (ancestry?.bonusDexterity ?? 0) +
      (background?.bonusDexterity ?? 0) +
      (characterClass?.bonusDexterity ?? 0),
    CON:
      10 +
      (ancestry?.bonusConstitution ?? 0) +
      (background?.bonusConstitution ?? 0) +
      (characterClass?.bonusConstitution ?? 0),
    INT:
      10 +
      (ancestry?.bonusIntelligence ?? 0) +
      (background?.bonusIntelligence ?? 0) +
      (characterClass?.bonusIntelligence ?? 0),
    WIS:
      10 +
      (ancestry?.bonusWisdom ?? 0) +
      (background?.bonusWisdom ?? 0) +
      (characterClass?.bonusWisdom ?? 0),
    CHA:
      10 +
      (ancestry?.bonusCharisma ?? 0) +
      (background?.bonusCharisma ?? 0) +
      (characterClass?.bonusCharisma ?? 0),
  };
}

export function calculateHP(
  ancestry: Ancestries | null,
  background: Backgrounds | null,
  characterClass: Classes | null
): number {
  return (
    10 +
    (ancestry?.bonusConstitution ?? 0) +
    (background?.bonusConstitution ?? 0) +
    (characterClass?.bonusConstitution ?? 0)
  );
}

export function calculateMana(
  ancestry: Ancestries | null,
  background: Backgrounds | null,
  characterClass: Classes | null
): number {
  return (
    10 +
    (ancestry?.bonusIntelligence ?? 0) +
    (background?.bonusIntelligence ?? 0) +
    (characterClass?.bonusIntelligence ?? 0)
  );
}
