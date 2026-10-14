// Hilfsfunktionen für die Engine-Tests.
import { expect } from "vitest";
import {
  applyAction,
  checkInvariants,
  createGame,
  createSeededRng,
  DICE_OUTCOMES,
  diceRollIndex,
  getProperty,
  TOKENS,
  type Action,
  type CardId,
  type DeckId,
  type ErrorCode,
  type GameEvent,
  type GameOptions,
  type GameState,
  type PlayerId,
  type Rng,
  type SpaceIndex,
} from "../src";

/** Zufallsquelle mit vorgegebenen Würfen. Wird mehr gewürfelt als vorgegeben, schlägt der Test fehl. */
export function dice(...rolls: [number, number][]): Rng {
  // Ein Wurf = eine Zufallszahl aus der gewichteten Würfeltabelle (random.ts).
  const values = rolls.map((roll) => diceRollIndex(roll));
  return {
    nextInt(max: number): number {
      const value = values.shift();
      if (value === undefined) throw new Error("Testdrehbuch: keine Würfe mehr vorgegeben.");
      if (max !== DICE_OUTCOMES) throw new Error(`Testdrehbuch: unerwartete Zufallszahl bis ${max}.`);
      return value;
    },
  };
}

/** Neues Spiel mit fester Reihenfolge p1, p2, …; p1 ist am Zug. */
export function newGame(playerCount = 2, options: Partial<GameOptions> = {}): GameState {
  const players = TOKENS.slice(0, playerCount).map((token, i) => ({
    id: `p${i + 1}`,
    name: `Spieler ${i + 1}`,
    token,
  }));
  const state = createGame({ players, options }, createSeededRng(7));
  state.players.sort((a, b) => a.id.localeCompare(b.id));
  state.current = 0;
  state.log = [];
  return state;
}

export interface Step {
  state: GameState;
  events: GameEvent[];
}

/** Führt eine Aktion aus; schlägt fehl, wenn sie abgelehnt wird. Prüft danach die Invarianten. */
export function act(state: GameState, playerId: PlayerId, action: Action, rng: Rng = dice()): Step {
  const result = applyAction(state, playerId, action, rng);
  if (!result.ok) throw new Error(`${playerId}: ${action.type} abgelehnt (${result.error.code}).`);
  expect(checkInvariants(result.state)).toEqual([]);
  return { state: result.state, events: result.events };
}

/** Erwartet, dass die Aktion mit dem angegebenen Fehler abgelehnt wird. */
export function expectRejected(state: GameState, playerId: PlayerId, action: Action, code: ErrorCode): void {
  const result = applyAction(state, playerId, action, dice());
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

/** Setzt den Besitz direkt (Testaufbau). */
export function own(state: GameState, playerId: PlayerId | null, ...spaces: SpaceIndex[]): GameState {
  for (const space of spaces) getProperty(state, space).owner = playerId;
  return state;
}

/** Baut direkt (Testaufbau) und hält den Gebäudevorrat der Bank korrekt. */
export function setHouses(state: GameState, space: SpaceIndex, level: number): GameState {
  const property = getProperty(state, space);
  const before = property.houses;
  if (before === 5) state.bank.hotels += 1;
  else state.bank.houses += before;
  if (level === 5) state.bank.hotels -= 1;
  else state.bank.houses -= level;
  property.houses = level;
  return state;
}

export function player(state: GameState, id: PlayerId) {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`Spieler ${id} fehlt.`);
  return p;
}

export function placeAt(state: GameState, id: PlayerId, position: SpaceIndex): GameState {
  player(state, id).position = position;
  return state;
}

/** Legt eine Karte oben auf den Stapel. */
export function cardOnTop(state: GameState, deck: DeckId, card: CardId): GameState {
  state.decks[deck] = [card, ...state.decks[deck].filter((c) => c !== card)];
  return state;
}

export function eventsOfType<T extends GameEvent["type"]>(events: GameEvent[], type: T) {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}
