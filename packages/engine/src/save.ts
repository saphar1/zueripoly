// Spielstand als JSON speichern und laden.
import { checkInvariants } from "./invariants";
import type { GameState } from "./types";

export const SAVE_FORMAT = "zueripoly-save";
export const SAVE_VERSION = 1;

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  /** Zustand der Zufallsquelle (`SeededRng.getState()`), damit nach dem Laden gleich weitergewürfelt wird. */
  rngState: number | null;
  state: GameState;
}

export function serializeGame(state: GameState, rngState: number | null = null): string {
  const file: SaveFile = { format: SAVE_FORMAT, version: SAVE_VERSION, rngState, state };
  return JSON.stringify(file);
}

/** Lädt einen Spielstand. Wirft einen Fehler (de-CH), wenn die Datei kaputt oder unbekannt ist. */
export function deserializeGame(json: string): { state: GameState; rngState: number | null } {
  let file: Partial<SaveFile>;
  try {
    file = JSON.parse(json) as Partial<SaveFile>;
  } catch {
    throw new Error("Der Spielstand ist kein gültiges JSON.");
  }
  if (!file || file.format !== SAVE_FORMAT) throw new Error("Das ist kein ZüriPoly-Spielstand.");
  if (file.version !== SAVE_VERSION) throw new Error(`Unbekannte Spielstand-Version ${String(file.version)}.`);
  const state = file.state;
  if (!state || state.formatVersion !== 1 || !Array.isArray(state.players) || !state.properties || !state.turn) {
    throw new Error("Der Spielstand ist unvollständig.");
  }
  let problems: string[];
  try {
    problems = checkInvariants(state);
  } catch {
    throw new Error("Der Spielstand ist beschädigt.");
  }
  if (problems.length > 0) throw new Error(`Der Spielstand ist beschädigt: ${problems.join(" ")}`);
  const rngState = typeof file.rngState === "number" ? file.rngState : null;
  return { state, rngState };
}
