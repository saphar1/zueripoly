// Zufallsquelle. Die Engine würfelt und mischt nie selbst mit Math.random,
// sondern bekommt eine Zufallsquelle übergeben. So sind Tests und Wiederholungen
// mit demselben Startwert (Seed) immer gleich.
import type { Dice } from "./types";

export interface Rng {
  /** Ganze Zufallszahl von 0 bis maxExclusive - 1. */
  nextInt(maxExclusive: number): number;
}

export interface SeededRng extends Rng {
  /** Aktueller innerer Zustand. `createSeededRng(getState())` macht genau dort weiter. */
  getState(): number;
}

/** Seedbare Zufallsquelle (Verfahren «Mulberry32», 32 Bit, schnell und für Spiele genügend gut). */
export function createSeededRng(seed: number): SeededRng {
  let state = seed >>> 0;
  return {
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error(`Ungültige Obergrenze für Zufallszahl: ${maxExclusive}`);
      }
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const float = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(float * maxExclusive);
    },
    getState(): number {
      return state;
    },
  };
}

/** Zufälliger Startwert für ein neues Spiel (für Client und Server, nicht für Tests). */
export function createRandomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/**
 * Gewichte der 36 Würfelpaare: Ein Pasch ist etwas seltener als bei echten Würfeln
 * (Wunsch des Entwicklers, 2026-10-14). Pasch 5, sonst 6 → 6 × 5 / (6 × 5 + 30 × 6) = 1 von 7.
 */
export const DOUBLES_WEIGHT = 5;
export const OTHER_WEIGHT = 6;

/** Alle Würfelpaare, jedes so oft, wie sein Gewicht sagt (210 Einträge). */
const DICE_TABLE: readonly Dice[] = (() => {
  const table: Dice[] = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      for (let w = 0; w < (a === b ? DOUBLES_WEIGHT : OTHER_WEIGHT); w++) table.push([a, b]);
    }
  }
  return table;
})();

/** Wirft beide Würfel mit einer einzigen Zufallszahl aus der gewichteten Tabelle. */
export function rollDice(rng: Rng): Dice {
  const [a, b] = DICE_TABLE[rng.nextInt(DICE_TABLE.length)] as Dice;
  return [a, b];
}

/** Index in der Tabelle, der genau diesen Wurf ergibt (für Tests mit vorgegebenen Würfen). */
export function diceRollIndex(dice: Dice): number {
  const index = DICE_TABLE.findIndex(([a, b]) => a === dice[0] && b === dice[1]);
  if (index < 0) throw new Error(`Ungültiger Wurf ${dice[0]} + ${dice[1]}.`);
  return index;
}

/** Anzahl Einträge der Würfeltabelle (Obergrenze für `nextInt` beim Würfeln). */
export const DICE_OUTCOMES = DICE_TABLE.length;

/** Mischt eine Kopie der Liste (Fisher-Yates). Die Eingabe bleibt unverändert. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}
