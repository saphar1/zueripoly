// Spielstand von Lokal und Solo im Browser (ein Speicherplatz). Gespeichert wird nach jeder Aktion,
// gelöscht beim Spielende. «Spiel verlassen» behält den Stand fürs Hauptmenü («Spielstand fortsetzen»).
// - localStorage: der Stand selbst, überlebt Neuladen und Schliessen.
// - sessionStorage: Merker «dieses Fenster spielt gerade». Nur dann führt Neuladen direkt ins Spiel.
// Speicher kann fehlen oder voll sein (privates Fenster): Jeder Zugriff steht in try/catch.
import type { GameConfig, GameState } from "@zueripoly/engine";
import { createSeededRng, deserializeGame, serializeGame } from "@zueripoly/engine";
import type { GameSession } from "./use-local-game";

export type SaveMode = "local" | "solo";

const SAVE_KEY = "zueripoly.localGame";
const PLAYING_KEY = "zueripoly.inLocalGame";
const VERSION = 1;

interface StoredGame {
  version: typeof VERSION;
  mode: SaveMode;
  config: GameConfig;
  /** `serializeGame` der Engine (Spielstand + Zustand der Spiel-Zufallsquelle). */
  game: string;
  botRng: number;
  savedAt: number;
}

export interface LocalSave {
  mode: SaveMode;
  config: GameConfig;
  state: GameState;
  rngState: number;
  botRngState: number;
  savedAt: number;
}

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveLocalGame(mode: SaveMode, config: GameConfig, session: GameSession, state: GameState): void {
  const stored: StoredGame = {
    version: VERSION,
    mode,
    config,
    game: serializeGame(state, session.rng.getState()),
    botRng: session.botRng.getState(),
    savedAt: Date.now(),
  };
  try {
    storage("local")?.setItem(SAVE_KEY, JSON.stringify(stored));
    storage("session")?.setItem(PLAYING_KEY, "1");
  } catch {
    // Speicher voll oder gesperrt: Das Spiel läuft weiter, nur ohne Sicherung.
  }
}

/** Gespeicherter Stand oder null (auch wenn er kaputt ist; dann wird er verworfen). */
export function loadLocalGame(): LocalSave | null {
  let raw: string | null = null;
  try {
    raw = storage("local")?.getItem(SAVE_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredGame>;
    if (stored.version !== VERSION || (stored.mode !== "local" && stored.mode !== "solo") || !stored.config) throw new Error("alt");
    if (typeof stored.game !== "string" || typeof stored.botRng !== "number") throw new Error("unvollständig");
    const { state, rngState } = deserializeGame(stored.game);
    if (rngState === null || state.winner !== null) throw new Error("nicht fortsetzbar");
    return { mode: stored.mode, config: stored.config, state, rngState, botRngState: stored.botRng, savedAt: stored.savedAt ?? 0 };
  } catch {
    clearLocalGame();
    return null;
  }
}

export function clearLocalGame(): void {
  try {
    storage("local")?.removeItem(SAVE_KEY);
  } catch {
    // nichts zu tun
  }
  leaveLocalGame();
}

/** Dieses Fenster spielt nicht mehr (Hauptmenü). Der Stand bleibt. */
export function leaveLocalGame(): void {
  try {
    storage("session")?.removeItem(PLAYING_KEY);
  } catch {
    // nichts zu tun
  }
}

/** Hat dieses Fenster vor dem Neuladen gespielt? */
export function wasPlayingHere(): boolean {
  try {
    return storage("session")?.getItem(PLAYING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Spiel mit den gespeicherten Zufallsquellen: Würfel und Bots machen genau dort weiter. */
export function sessionFromSave(save: LocalSave): GameSession {
  return { initial: save.state, rng: createSeededRng(save.rngState), botRng: createSeededRng(save.botRngState) };
}

/** Kurzer Satz zum Stand fürs Menü und die Lobby: «Solo · Zug 34 · Anna, Ueli, Vreni». */
export function describeSave(save: LocalSave): string {
  const mode = save.mode === "solo" ? "Solo" : "Lokal";
  const names = save.state.players.filter((p) => !p.bankrupt).map((p) => p.name);
  return `${mode} · Zug ${save.state.turnNumber} · ${names.join(", ")}`;
}
