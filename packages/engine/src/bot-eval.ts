// Bewertungen für die Computergegner: Was ist ein Feld wert, was eine ganze Spielposition?
// Nur Abfragen, hier wird nichts verändert. Die Bots nutzen nur öffentliches Wissen
// (Geld, Besitz, Gebäude, Hypotheken, Protokoll), nie die Reihenfolge der Kartenstapel.
import {
  COLOR_GROUPS,
  getPropertySpace,
  getSpace,
  getStreet,
  GROUP_STREETS,
  PROPERTY_INDICES,
  STATION_INDICES,
  UTILITY_INDICES,
} from "./board";
import type { Rng } from "./random";
import { calculateRent, getActivePlayers, getPlayer, getProperty, unmortgageCost } from "./rules";
import type { Action, BotLevel, ColorGroup, GameEvent, GameState, PlayerId, PlayerState, SpaceIndex } from "./types";

/** Alles, was ein Bot für einen Entscheid braucht. */
export interface BotContext {
  state: GameState;
  me: PlayerState;
  level: BotLevel;
  /** Eigene Zufallsquelle der Bots, nie die Spiel-Zufallsquelle (Würfel, Karten). */
  rng: Rng;
  /** Gültige Aktionen (`getLegalActions`), einmal pro Entscheid berechnet. */
  legal: Action[];
}

// ---------------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------------

/** Trifft mit Wahrscheinlichkeit p (0 bis 1) zu. */
export function chance(rng: Rng, p: number): boolean {
  return p > 0 && rng.nextInt(1000) < p * 1000;
}

export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[rng.nextInt(items.length)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function floorTo10(value: number): number {
  return Math.floor(value / 10) * 10;
}

export function ceilTo10(value: number): number {
  return Math.ceil(value / 10) * 10;
}

/** Der beste Eintrag nach Punktzahl (höchste zuerst), bei Gleichstand der erste. */
export function best<T>(items: readonly T[], score: (item: T) => number): T | undefined {
  let top: T | undefined;
  let topScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > topScore) {
      top = item;
      topScore = s;
    }
  }
  return top;
}

/** Gültige Aktionen eines Typs, mit passendem Typ für TypeScript. */
export function legalOf<T extends Action["type"]>(ctx: BotContext, type: T): Extract<Action, { type: T }>[] {
  return ctx.legal.filter((a): a is Extract<Action, { type: T }> => a.type === type);
}

/**
 * Das Gedächtnis der Bots: alle Ereignisse seit Beginn des laufenden Zuges.
 * Steht im Protokoll kein Zugbeginn mehr (sehr langer Zug), gilt das ganze Protokoll.
 */
export function eventsThisTurn(state: GameState): GameEvent[] {
  for (let i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i]?.type === "turnStarted") return state.log.slice(i + 1);
  }
  return state.log;
}

// ---------------------------------------------------------------------------
// Farbgruppen
// ---------------------------------------------------------------------------

function ownerOf(state: GameState, index: SpaceIndex): PlayerId | null {
  return getProperty(state, index).owner;
}

/** Gehört dem Spieler die ganze Farbgruppe dieses Feldes? (Bahnhöfe und Versorger: nein) */
export function inCompleteGroup(state: GameState, playerId: PlayerId, index: SpaceIndex): boolean {
  const space = getSpace(index);
  return space.kind === "street" && GROUP_STREETS[space.group].every((i) => ownerOf(state, i) === playerId);
}

/** Würde der Spieler mit diesem Feld seine Farbgruppe vollenden? */
export function completesGroup(state: GameState, playerId: PlayerId, index: SpaceIndex): boolean {
  const space = getSpace(index);
  return space.kind === "street" && GROUP_STREETS[space.group].every((i) => i === index || ownerOf(state, i) === playerId);
}

/** Mietpotenzial einer ganzen Farbgruppe: 60 % der Mieten mit drei Häusern. */
function groupPotential(group: ColorGroup): number {
  return 0.6 * GROUP_STREETS[group].reduce((sum, i) => sum + getStreet(i).rents[3], 0);
}

// ---------------------------------------------------------------------------
// Bewertung einer Spielposition (Stufe «clever»)
// ---------------------------------------------------------------------------

/** Bonus für mehrere Felder derselben Gruppe (ohne ganze Gruppe). Halb so viel, wenn ein Gegner mitbesitzt. */
const PARTIAL_BONUS = 0.3;
/** Wert je Bahnhof bei 1, 2, 3 oder 4 Bahnhöfen (Faktor auf den Preis). */
const STATION_FACTORS = [1, 1.15, 1.35, 1.6] as const;
/** Wert je Versorger bei 1 oder 2 Versorgern. */
const UTILITY_FACTORS = [0.8, 1.1] as const;
const JAIL_CARD_VALUE = 30;

/** Ausbaustand einer Farbgruppe: 0 ohne Häuser, 1 ab drei Häusern pro Strasse. */
function developed(state: GameState, group: ColorGroup): number {
  const levels = GROUP_STREETS[group].map((i) => getProperty(state, i).houses);
  return Math.min(1, levels.reduce((a, b) => a + b, 0) / (3 * levels.length));
}

/** So viel kostet es, alle eigenen ganzen Farbgruppen auf drei Häuser pro Strasse auszubauen. */
function developmentCost(state: GameState, playerId: PlayerId): number {
  let cost = 0;
  for (const group of COLOR_GROUPS) {
    const streets = GROUP_STREETS[group];
    if (!streets.every((i) => ownerOf(state, i) === playerId)) continue;
    for (const i of streets) cost += Math.max(0, 3 - getProperty(state, i).houses) * getStreet(i).housePrice;
  }
  return cost;
}

function groupValue(state: GameState, playerId: PlayerId, group: ColorGroup): number {
  const streets = GROUP_STREETS[group];
  const mine = streets.filter((i) => ownerOf(state, i) === playerId);
  if (mine.length === 0) return 0;
  const base = mine.reduce((sum, i) => sum + getStreet(i).price, 0);
  if (mine.length === streets.length) {
    // Das Mietpotenzial zählt erst mit Häusern ganz; ohne Häuser zur Hälfte.
    const buildings = mine.reduce((sum, i) => sum + getProperty(state, i).houses * getStreet(i).housePrice, 0);
    return base + groupPotential(group) * (0.5 + 0.5 * developed(state, group)) + buildings;
  }
  const contested = streets.some((i) => {
    const owner = ownerOf(state, i);
    return owner !== null && owner !== playerId;
  });
  const share = (mine.length - 1) / (streets.length - 1);
  return base * (1 + PARTIAL_BONUS * share * (contested ? 0.5 : 1));
}

function setValue(state: GameState, playerId: PlayerId, indices: readonly SpaceIndex[], factors: readonly number[]): number {
  const count = indices.filter((i) => ownerOf(state, i) === playerId).length;
  if (count === 0) return 0;
  return count * getPropertySpace(indices[0] as SpaceIndex).price * (factors[count - 1] ?? 1);
}

/**
 * Geldreserve: so viel Bargeld möchte ein cleverer Bot behalten.
 * Wächst mit der höchsten Miete, die auf dem Brett bei einem Gegner fällig werden kann.
 */
export function cashReserve(state: GameState, playerId: PlayerId): number {
  let threat = 0;
  for (const index of PROPERTY_INDICES) {
    const property = getProperty(state, index);
    if (property.owner === null || property.owner === playerId || property.mortgaged) continue;
    threat = Math.max(threat, calculateRent(state, index, 7));
  }
  return clamp(Math.round((50 + threat * 0.4) / 10) * 10, 100, 500);
}

/**
 * Wert einer ganzen Spielposition in CHF: Bargeld, Besitz, Gebäude, Freikarten.
 * Ganze Farbgruppen zählen viel mehr als ihre Einzelfelder (Mietpotenzial), umso mehr, je weiter ausgebaut.
 * Belastete Felder zählen die Ablösung ab, Bargeld unter der Reserve zählt weniger (Risiko).
 */
export function positionValue(state: GameState, playerId: PlayerId): number {
  const player = getPlayer(state, playerId);
  if (player.bankrupt) return 0;
  const reserve = cashReserve(state, playerId);
  // Bargeld unter der Reserve ist riskant; Bargeld für den Ausbau eigener Gruppen ist mehr wert (wird zu Miete).
  let value = player.money - Math.max(0, reserve - player.money) * 0.5;
  value += Math.min(player.money, developmentCost(state, playerId)) * 0.5;
  value += player.jailCards.length * JAIL_CARD_VALUE;
  for (const group of COLOR_GROUPS) value += groupValue(state, playerId, group);
  value += setValue(state, playerId, STATION_INDICES, STATION_FACTORS);
  value += setValue(state, playerId, UTILITY_INDICES, UTILITY_FACTORS);
  for (const index of PROPERTY_INDICES) {
    const property = getProperty(state, index);
    if (property.owner === playerId && property.mortgaged) value -= unmortgageCost(getPropertySpace(index));
  }
  return value;
}

/** Wie viel wertvoller die Position des Spielers wäre, wenn ihm das Feld gehörte (ohne Kaufpreis). */
function gainIfOwned(state: GameState, playerId: PlayerId, index: SpaceIndex): number {
  const property = getProperty(state, index);
  const after: GameState = { ...state, properties: { ...state.properties, [index]: { ...property, owner: playerId } } };
  return positionValue(after, playerId) - positionValue(state, playerId);
}

/**
 * Was ein freies Feld dem Spieler wert ist: eigener Gewinn plus ein Teil dessen,
 * was er einem Gegner wegnimmt (Blockieren einer fremden Farbgruppe).
 */
export function propertyWorth(state: GameState, playerId: PlayerId, index: SpaceIndex): number {
  const price = getPropertySpace(index).price;
  let block = 0;
  for (const other of getActivePlayers(state)) {
    if (other.id !== playerId) block = Math.max(block, gainIfOwned(state, other.id, index) - price);
  }
  return gainIfOwned(state, playerId, index) + 0.5 * block;
}

// ---------------------------------------------------------------------------
// Bewertung nach Listenpreis (Stufe «einfach»)
// ---------------------------------------------------------------------------

/** Bargeld plus Listenpreise des Besitzes (belastete Felder abzüglich Hypothek). Ohne Farbgruppen. */
export function listValue(state: GameState, playerId: PlayerId): number {
  let value = getPlayer(state, playerId).money;
  for (const index of PROPERTY_INDICES) {
    const property = getProperty(state, index);
    if (property.owner !== playerId) continue;
    const space = getPropertySpace(index);
    value += property.mortgaged ? space.price - space.mortgage : space.price;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Lange Partien
// ---------------------------------------------------------------------------

/**
 * Kompromissbereitschaft von 0 bis 0,6: Dauert eine Partie sehr lange (ab etwa 40 Runden),
 * geben die Bots beim Handeln schrittweise nach. So entstehen ganze Farbgruppen und die Partie endet.
 */
export function patience(state: GameState): number {
  const rounds = state.turnNumber / Math.max(1, state.players.length);
  return clamp((rounds - 40) / 100, 0, 0.6);
}

/**
 * Handelsregel der Stufe «clever»: Der eigene Gewinn muss mindestens so gross sein wie
 * dieser Anteil vom Gewinn des Partners. Im Zweikampf zählt jeder Vorteil des Gegners voll (1,0),
 * mit mehreren Gegnern weniger (0,85). In langen Partien sinkt der Anteil (`patience`).
 */
export function fairRatio(state: GameState): number {
  return (getActivePlayers(state).length <= 2 ? 1 : 0.85) - patience(state);
}
