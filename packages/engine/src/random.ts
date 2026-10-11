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

export function rollDie(rng: Rng): number {
  return rng.nextInt(6) + 1;
}

export function rollDice(rng: Rng): Dice {
  return [rollDie(rng), rollDie(rng)];
}

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
