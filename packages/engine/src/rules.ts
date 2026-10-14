// Regelberechnungen gemäss docs/regeln.md. Nur Abfragen, hier wird nichts verändert.
import {
  findPropertySpace,
  getPropertySpace,
  GROUP_STREETS,
  PROPERTY_INDICES,
  STATION_INDICES,
  STATION_RENTS,
  UTILITY_INDICES,
  UTILITY_MULTIPLIERS,
} from "./board";
import {
  BANK,
  JACKPOT,
  type ColorGroup,
  type DebtReason,
  type ErrorCode,
  type GameOptions,
  type GameState,
  type MoneyParty,
  type PlayerId,
  type PlayerState,
  type PropertyState,
  type PropertySpace,
  type SpaceIndex,
} from "./types";

export const START_SALARY = 200;
export const JAIL_FINE = 50;
/** So viele Züge sitzt man im Gefängnis aus (ohne Kaution oder Freikarte); danach ist man frei. */
export const JAIL_TURNS = 1;
/** Der dritte Pasch in Folge führt ins Gefängnis. */
export const MAX_DOUBLES = 3;
export const TOTAL_HOUSES = 32;
export const TOTAL_HOTELS = 12;
/** Stufe «Hotel» in `PropertyState.houses`. */
export const HOTEL_LEVEL = 5;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const START_MONEY_MIN = 500;
export const START_MONEY_MAX = 5000;
export const START_MONEY_STEP = 100;
export const TURN_TIME_LIMITS = [30, 60, 90] as const;

export const DEFAULT_OPTIONS: GameOptions = {
  startMoney: 1500,
  jackpot: false,
  turnTimeLimit: null,
};

/** Zahlungen an die Bank, die mit Jackpot-Option in den Topf fliessen. */
export const JACKPOT_REASONS: readonly DebtReason[] = ["tax", "card", "jailFine"];

// ---------------------------------------------------------------------------
// Spieler und Felder
// ---------------------------------------------------------------------------

export function findPlayer(state: GameState, id: PlayerId): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function getPlayer(state: GameState, id: PlayerId): PlayerState {
  const player = findPlayer(state, id);
  if (!player) throw new Error(`Spieler ${id} gibt es nicht.`);
  return player;
}

export function getCurrentPlayer(state: GameState): PlayerState {
  const player = state.players[state.current];
  if (!player) throw new Error(`Ungültiger Spielerindex ${state.current}.`);
  return player;
}

/** Spieler, die noch im Spiel sind, in Zugreihenfolge. */
export function getActivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.bankrupt);
}

export function getProperty(state: GameState, index: SpaceIndex): PropertyState {
  const property = state.properties[index];
  if (!property) throw new Error(`Feld ${index} ist nicht kaufbar.`);
  return property;
}

/** Alle Felder eines Spielers, in Brettreihenfolge. */
export function getOwnedSpaces(state: GameState, playerId: PlayerId): SpaceIndex[] {
  return PROPERTY_INDICES.filter((i) => getProperty(state, i).owner === playerId);
}

export function groupLevels(state: GameState, group: ColorGroup): number[] {
  return GROUP_STREETS[group].map((i) => getProperty(state, i).houses);
}

export function ownsWholeGroup(state: GameState, playerId: PlayerId, group: ColorGroup): boolean {
  return GROUP_STREETS[group].every((i) => getProperty(state, i).owner === playerId);
}

export function groupHasBuildings(state: GameState, group: ColorGroup): boolean {
  return groupLevels(state, group).some((level) => level > 0);
}

export function groupHasMortgage(state: GameState, group: ColorGroup): boolean {
  return GROUP_STREETS[group].some((i) => getProperty(state, i).mortgaged);
}

/** Darf das Feld ohne Gebäude gehandelt oder belastet werden? Bei Strassen zählt die ganze Farbgruppe. */
export function isFreeOfBuildings(state: GameState, space: PropertySpace): boolean {
  return space.kind !== "street" || !groupHasBuildings(state, space.group);
}

export function countBuildings(state: GameState, playerId: PlayerId): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const index of getOwnedSpaces(state, playerId)) {
    const level = getProperty(state, index).houses;
    if (level === HOTEL_LEVEL) hotels += 1;
    else houses += level;
  }
  return { houses, hotels };
}

// ---------------------------------------------------------------------------
// Geld
// ---------------------------------------------------------------------------

/** 10 % Zins auf den Hypothekenwert, aufgerundet auf 5 CHF (nur runde Beträge im Spiel). */
export function mortgageInterest(space: PropertySpace): number {
  return Math.ceil(space.mortgage / 50) * 5;
}

/** Hypothek zurückzahlen: Hypothekenwert plus 10 % Zins. */
export function unmortgageCost(space: PropertySpace): number {
  return space.mortgage + mortgageInterest(space);
}

/** Kosten beim Erhalt eines belasteten Feldes (Handel, Bankrott): sofort ablösen oder nur Zins. */
export function mortgageTransferCost(space: PropertySpace, lift: boolean): number {
  return lift ? unmortgageCost(space) : mortgageInterest(space);
}

/** Erlös aus dem Verkauf aller Gebäude auf einem Feld (Hotel = 5 Häuser, je halber Hauspreis). */
export function buildingSaleValue(state: GameState, index: SpaceIndex): number {
  const space = getPropertySpace(index);
  if (space.kind !== "street") return 0;
  return getProperty(state, index).houses * (space.housePrice / 2);
}

/** So viel Geld kann ein Spieler höchstens noch auftreiben (alle Gebäude verkaufen, alles belasten). */
export function liquidationValue(state: GameState, playerId: PlayerId): number {
  let total = 0;
  for (const index of getOwnedSpaces(state, playerId)) {
    const property = getProperty(state, index);
    total += buildingSaleValue(state, index);
    if (!property.mortgaged) total += getPropertySpace(index).mortgage;
  }
  return total;
}

/** Wohin eine Zahlung an die Bank fliesst: mit Jackpot-Option in den Topf (Steuern, Karten, Gefängnis). */
export function bankSink(state: GameState, reason: DebtReason): MoneyParty {
  return state.options.jackpot && JACKPOT_REASONS.includes(reason) ? JACKPOT : BANK;
}

// ---------------------------------------------------------------------------
// Miete
// ---------------------------------------------------------------------------

/**
 * Miete für ein Feld bei normaler Landung (ohne Kartenzuschlag).
 * `diceSum` braucht es nur für Versorger.
 */
export function calculateRent(state: GameState, index: SpaceIndex, diceSum: number): number {
  const space = getPropertySpace(index);
  const property = getProperty(state, index);
  if (property.owner === null || property.mortgaged) return 0;
  const owner = property.owner;

  switch (space.kind) {
    case "street": {
      if (property.houses > 0) return space.rents[property.houses] ?? 0;
      const doubled = ownsWholeGroup(state, owner, space.group) && !groupHasMortgage(state, space.group);
      return doubled ? space.rents[0] * 2 : space.rents[0];
    }
    case "station": {
      const owned = STATION_INDICES.filter((i) => getProperty(state, i).owner === owner).length;
      return STATION_RENTS[owned - 1] ?? 0;
    }
    case "utility": {
      const owned = UTILITY_INDICES.filter((i) => getProperty(state, i).owner === owner).length;
      return diceSum * (UTILITY_MULTIPLIERS[owned - 1] ?? 0);
    }
  }
}

// ---------------------------------------------------------------------------
// Prüfungen für Bauen, Verkaufen und Hypotheken (geben einen Fehlercode oder null zurück)
// ---------------------------------------------------------------------------

/** Darf der Spieler hier bauen? Mit `free` (Baubewilligung) zählt das Bargeld nicht. */
export function checkBuild(state: GameState, playerId: PlayerId, index: unknown, free = false): ErrorCode | null {
  const space = findPropertySpace(index);
  if (!space || space.kind !== "street") return "invalidSpace";
  const property = getProperty(state, space.index);
  if (property.owner !== playerId) return "notOwner";
  if (!ownsWholeGroup(state, playerId, space.group)) return "groupIncomplete";
  if (groupHasMortgage(state, space.group)) return "groupMortgaged";
  if (property.houses >= HOTEL_LEVEL) return "maxBuildings";
  // Gleichmässig bauen: nur auf einer Strasse mit der tiefsten Stufe der Gruppe.
  if (property.houses > Math.min(...groupLevels(state, space.group))) return "unevenBuilding";
  if (property.houses === HOTEL_LEVEL - 1) {
    if (state.bank.hotels < 1) return "noHotelsLeft";
  } else if (state.bank.houses < 1) {
    return "noHousesLeft";
  }
  if (free) return null;
  const player = getPlayer(state, playerId);
  if (player.money < space.housePrice) return "notEnoughMoney";
  return null;
}

export function checkSellBuilding(state: GameState, playerId: PlayerId, index: unknown): ErrorCode | null {
  const space = findPropertySpace(index);
  if (!space || space.kind !== "street") return "invalidSpace";
  const property = getProperty(state, space.index);
  if (property.owner !== playerId) return "notOwner";
  if (property.houses === 0) return "noBuildings";
  // Gleichmässig verkaufen: nur von einer Strasse mit der höchsten Stufe der Gruppe.
  if (property.houses < Math.max(...groupLevels(state, space.group))) return "unevenBuilding";
  return null;
}

export function checkMortgage(state: GameState, playerId: PlayerId, index: unknown): ErrorCode | null {
  const space = findPropertySpace(index);
  if (!space) return "invalidSpace";
  const property = getProperty(state, space.index);
  if (property.owner !== playerId) return "notOwner";
  if (property.mortgaged) return "alreadyMortgaged";
  if (!isFreeOfBuildings(state, space)) return "groupHasBuildings";
  return null;
}

export function checkUnmortgage(state: GameState, playerId: PlayerId, index: unknown): ErrorCode | null {
  const space = findPropertySpace(index);
  if (!space) return "invalidSpace";
  const property = getProperty(state, space.index);
  if (property.owner !== playerId) return "notOwner";
  if (!property.mortgaged) return "notMortgaged";
  if (getPlayer(state, playerId).money < unmortgageCost(space)) return "notEnoughMoney";
  return null;
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

/**
 * Auf wen das Spiel gerade wartet (genau ein Spieler), oder null, wenn das Spiel zu Ende ist.
 * Reihenfolge: offenes Handelsangebot (Empfänger), Hypothekenentscheid, Schuld, sonst der Spieler am Zug.
 * Ein Anbieter darf sein offenes Angebot ausserdem jederzeit zurückziehen.
 */
export function getWaitingFor(state: GameState): PlayerId | null {
  if (state.winner !== null) return null;
  if (state.trade) return state.trade.to;
  if (state.mortgageDecision) return state.mortgageDecision.player;
  const debt = state.debts[0];
  if (debt) return debt.debtor;
  return getCurrentPlayer(state).id;
}

/** Darf der Spieler jetzt ein Handelsangebot machen? (Eigener Zug ohne offene Vorgänge oder bei eigener Schuld.) */
export function canProposeTrade(state: GameState, playerId: PlayerId): boolean {
  if (state.winner !== null || state.trade || state.mortgageDecision) return false;
  const player = findPlayer(state, playerId);
  if (!player || player.bankrupt) return false;
  const debt = state.debts[0];
  if (debt) return debt.debtor === playerId;
  return getCurrentPlayer(state).id === playerId;
}
