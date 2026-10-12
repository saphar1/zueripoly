// Computergegner (regelbasiert, zwei Stufen). Siehe docs/bots.md.
//
// `chooseBotAction` schlägt für den Spieler, auf den das Spiel wartet, genau eine Aktion vor.
// Ausgeführt wird sie wie bei Menschen mit `applyAction`: gleiche Regeln, keine Abkürzungen.
// Der Bot liest nur öffentliches Wissen (nie die Kartenstapel) und würfelt nie selbst.
import { COLOR_GROUPS, getPropertySpace, getStreet, GROUP_STREETS, PROPERTY_INDICES } from "./board";
import {
  type BotContext,
  best,
  cashReserve,
  chance,
  completesGroup,
  eventsThisTurn,
  floorTo10,
  inCompleteGroup,
  legalOf,
  patience,
  pick,
  propertyWorth,
} from "./bot-eval";
import { answerTrade, proposeTrade } from "./bot-trade";
import type { Rng } from "./random";
import {
  calculateRent,
  getPlayer,
  getProperty,
  getWaitingFor,
  groupLevels,
  HOTEL_LEVEL,
  JAIL_FINE,
  minimumBid,
  mortgageInterest,
  unmortgageCost,
} from "./rules";
import type { Action, BotLevel, ColorGroup, GameState, PlayerId, SpaceIndex } from "./types";
import { getLegalActions, validateAction } from "./validate";

/** Zürcher Namen für Computergegner (Vorschläge in der Lobby). */
export const BOT_NAMES: readonly string[] = [
  "Vreni",
  "Ueli",
  "Regula",
  "Housi",
  "Trudi",
  "Fredi",
  "Mägi",
  "Ruedi",
  "Bethli",
  "Kari",
  "Heidi",
  "Sepp",
];

export const BOT_LEVEL_NAMES: Record<BotLevel, string> = {
  easy: "einfach",
  clever: "clever",
};

/** Höchstens so viele Verwaltungsschritte (bauen, verkaufen, belasten, auslösen) pro Zug. Schutz vor Endlosschleifen. */
const MANAGEMENT_LIMIT: Record<BotLevel, number> = { easy: 4, clever: 15 };

/**
 * Wählt die nächste Aktion für einen Computergegner.
 * `playerId` muss der Spieler sein, auf den das Spiel wartet (`getWaitingFor`).
 * `rng` ist die eigene Zufallsquelle der Bots, nicht die des Spiels.
 * `level` überschreibt die Stufe aus dem Spielstand (z. B. wenn ein Bot für einen Menschen übernimmt).
 */
export function chooseBotAction(state: GameState, playerId: PlayerId, rng: Rng, level?: BotLevel): Action {
  if (getWaitingFor(state) !== playerId) throw new Error(`Der Bot ${playerId} ist nicht an der Reihe.`);
  const me = getPlayer(state, playerId);
  const ctx: BotContext = { state, me, level: level ?? me.bot ?? "easy", rng, legal: getLegalActions(state, playerId) };
  if (state.trade) return answerTrade(ctx);
  if (state.mortgageDecision) return resolveMortgages(ctx);
  if (state.debts[0]) return raiseMoney(ctx);
  if (state.auction) return bid(ctx);
  return playTurn(ctx);
}

// ---------------------------------------------------------------------------
// Eigener Zug
// ---------------------------------------------------------------------------

function managementCount(state: GameState, playerId: PlayerId): number {
  return eventsThisTurn(state).filter(
    (e) =>
      (e.type === "houseBuilt" || e.type === "buildingSold" || e.type === "mortgaged" || e.type === "unmortgaged") &&
      e.player === playerId,
  ).length;
}

function canManage(ctx: BotContext): boolean {
  return managementCount(ctx.state, ctx.me.id) < MANAGEMENT_LIMIT[ctx.level];
}

function playTurn(ctx: BotContext): Action {
  if (ctx.state.turn.phase === "buy") return decideBuy(ctx);
  const trade = proposeTrade(ctx);
  if (trade) return trade;
  if (canManage(ctx)) {
    const manage = ctx.level === "clever" ? manageClever(ctx) : manageEasy(ctx);
    if (manage) return manage;
  }
  if (ctx.state.turn.phase === "preRoll") return leaveJailOrRoll(ctx);
  return { type: "endTurn" };
}

/** Punkte für ein Haus auf diesem Feld: Mietzuwachs pro Franken. Bis 3 Häuser zählt der Schnitt (dort lohnt es sich am meisten). */
function buildScore(state: GameState, index: SpaceIndex): number {
  const street = getStreet(index);
  const level = getProperty(state, index).houses;
  if (level < 3) return (street.rents[3] - street.rents[0] * 2) / (3 * street.housePrice);
  return ((street.rents[level + 1] ?? 0) - (street.rents[level] ?? 0)) / street.housePrice;
}

/** Ganze, unbelastete Farbgruppe des Spielers, die bei Häusermangel bis zum Hotel ausgebaut wird (höchste Stufe zuerst). */
function rebuildTarget(state: GameState, playerId: PlayerId): ColorGroup | null {
  const groups = COLOR_GROUPS.filter((group) => {
    const streets = GROUP_STREETS[group];
    if (!streets.every((i) => getProperty(state, i).owner === playerId && !getProperty(state, i).mortgaged)) return false;
    return Math.min(...groupLevels(state, group)) < HOTEL_LEVEL - 1;
  });
  return best(groups, (g) => groupLevels(state, g).reduce((a, b) => a + b, 0)) ?? null;
}

/**
 * Häusermangel: Hat die Bank (fast) keine Häuser mehr, kann niemand mehr bis zum Hotel bauen, und die Partie
 * kann ewig dauern. Dann wie ein echter Spieler umbauen: Häuser einer schwächeren Gruppe verkaufen und die
 * stärkste Gruppe bis zum Hotel ausbauen. Jedes Hotel gibt 4 Häuser an die Bank zurück.
 */
function rebuildForHotels(ctx: BotContext, reserve: number): Action | null {
  const { state, me } = ctx;
  if (state.bank.houses > 1) return null;
  const builds = legalOf(ctx, "buildHouse").filter((a) => me.money - getStreet(a.space).housePrice >= reserve);
  const hotel = builds.find((a) => getProperty(state, a.space).houses === HOTEL_LEVEL - 1);
  if (hotel) return hotel;
  const target = rebuildTarget(state, me.id);
  if (!target) return null;
  const onTarget = builds.find((a) => getStreet(a.space).group === target);
  if (onTarget) return onTarget;
  const price = getStreet(GROUP_STREETS[target][0] as SpaceIndex).housePrice;
  if (state.bank.houses > 0 || me.money - price < reserve) return null;
  // Ein Haus aus einer anderen Gruppe verkaufen (kein Hotel: das würde bei Häusermangel ganz abgerissen).
  const sales = legalOf(ctx, "sellBuilding").filter((a) => {
    const level = getProperty(state, a.space).houses;
    return getStreet(a.space).group !== target && level < HOTEL_LEVEL;
  });
  return best(sales, (a) => -(getStreet(a.space).rents[getProperty(state, a.space).houses] ?? 0)) ?? null;
}

function manageClever(ctx: BotContext): Action | null {
  const { state, me } = ctx;
  // In langen Partien wird mutiger gebaut.
  const reserve = cashReserve(state, me.id) * (1 - patience(state));
  // Für Häuser darf der Bot bis auf 30 % in die Reserve greifen: Häuser bringen am meisten Miete.
  const buildReserve = reserve * 0.3;
  const unmortgages = legalOf(ctx, "unmortgage");
  const cost = (a: { space: SpaceIndex }) => unmortgageCost(getPropertySpace(a.space));

  // 1. Belastete Felder einer ganzen Farbgruppe auslösen: Danach kann dort gebaut werden.
  const inGroup = unmortgages.filter((a) => inCompleteGroup(state, me.id, a.space) && me.money - cost(a) >= reserve);
  if (inGroup[0]) return inGroup[0];

  // 2. Bauen (bei Häusermangel umbauen).
  const rebuild = rebuildForHotels(ctx, buildReserve);
  if (rebuild) return rebuild;
  const builds = legalOf(ctx, "buildHouse").filter((a) => me.money - getStreet(a.space).housePrice >= buildReserve);
  const build = best(builds, (a) => buildScore(state, a.space));
  if (build) return build;

  // 3. Übrige Hypotheken nur auslösen, wenn viel Geld da ist.
  const rich = unmortgages.filter((a) => me.money - cost(a) >= reserve * 2 + 200);
  return best(rich, (a) => getPropertySpace(a.space).price) ?? null;
}

function manageEasy(ctx: BotContext): Action | null {
  const { state, me, rng } = ctx;
  // Auch die einfache Stufe baut in langen Partien bei Häusermangel um, sonst endet die Partie nie.
  if (patience(state) > 0) {
    const rebuild = rebuildForHotels(ctx, 50);
    if (rebuild) return rebuild;
  }
  const builds = legalOf(ctx, "buildHouse").filter((a) => me.money - getStreet(a.space).housePrice >= 50);
  if (builds.length > 0 && chance(rng, 0.25 + patience(state))) return pick(rng, builds) ?? null;
  const unmortgages = legalOf(ctx, "unmortgage").filter((a) => me.money - unmortgageCost(getPropertySpace(a.space)) >= 300);
  if (unmortgages.length > 0 && chance(rng, 0.1)) return pick(rng, unmortgages) ?? null;
  return null;
}

function opponentsHaveBuildings(state: GameState, playerId: PlayerId): boolean {
  return PROPERTY_INDICES.some((i) => {
    const property = getProperty(state, i);
    return property.owner !== null && property.owner !== playerId && property.houses > 0;
  });
}

function leaveJailOrRoll(ctx: BotContext): Action {
  const { state, me, rng } = ctx;
  const roll: Action = { type: "rollDice" };
  if (!me.inJail) return roll;
  const card = legalOf(ctx, "useJailCard")[0];
  const fine = legalOf(ctx, "payJailFine")[0];
  if (ctx.level === "easy") {
    if (card && chance(rng, 0.5)) return card;
    if (fine && chance(rng, 0.4)) return fine;
    return roll;
  }
  // Früh im Spiel raus (es gibt noch viel zu kaufen), später im Gefängnis sicher sitzen bleiben.
  const unowned = PROPERTY_INDICES.filter((i) => getProperty(state, i).owner === null).length;
  if (unowned < 6 || opponentsHaveBuildings(state, me.id)) return roll;
  if (card) return card;
  if (fine && me.money - JAIL_FINE >= cashReserve(state, me.id)) return fine;
  return roll;
}

/** Hypothek auf ein Feld, das wenig bringt (nicht aus ganzen Gruppen, nicht aus `keepGroupOf`). */
function cheapMortgage(ctx: BotContext, keepGroupOf: SpaceIndex | null): Extract<Action, { type: "mortgage" }> | null {
  const { state, me } = ctx;
  const keep = keepGroupOf !== null ? getPropertySpace(keepGroupOf) : null;
  const loose = legalOf(ctx, "mortgage").filter((a) => {
    const space = getPropertySpace(a.space);
    if (keep?.kind === "street" && space.kind === "street" && space.group === keep.group) return false;
    return !inCompleteGroup(state, me.id, a.space);
  });
  return best(loose, (a) => -calculateRent(state, a.space, 7) * 10 + getPropertySpace(a.space).mortgage) ?? null;
}

function decideBuy(ctx: BotContext): Action {
  const { state, me, rng } = ctx;
  const index = state.turn.pendingBuy as SpaceIndex;
  const price = getPropertySpace(index).price;
  const buy = legalOf(ctx, "buyProperty")[0];
  const decline: Action = { type: "declineProperty" };

  if (ctx.level === "easy") return buy && chance(rng, 0.65) ? buy : decline;

  // Wichtig: vollendet eine eigene oder blockiert eine fremde Farbgruppe.
  const important = propertyWorth(state, me.id, index) >= price * 1.4;
  if (buy && (me.money - price >= cashReserve(state, me.id) || important)) return buy;
  if (!buy && completesGroup(state, me.id, index) && canManage(ctx)) {
    // Fehlt Bargeld für die letzte Strasse der Gruppe: Einzelfelder belasten, wenn es dann reicht.
    const mortgageable = legalOf(ctx, "mortgage")
      .filter((a) => !inCompleteGroup(state, me.id, a.space))
      .reduce((sum, a) => sum + getPropertySpace(a.space).mortgage, 0);
    const mortgage = cheapMortgage(ctx, index);
    if (mortgage && me.money + mortgageable >= price) return mortgage;
  }
  return decline;
}

// ---------------------------------------------------------------------------
// Versteigerung
// ---------------------------------------------------------------------------

function bid(ctx: BotContext): Action {
  const { state, me, rng } = ctx;
  const auction = state.auction;
  const pass: Action = { type: "passBid" };
  if (!auction) return pass;
  const min = minimumBid(auction);
  const price = getPropertySpace(auction.space).price;

  if (ctx.level === "easy") {
    if (!chance(rng, 0.7)) return pass;
    const cap = Math.min(price * (0.4 + rng.nextInt(61) / 100), me.money);
    const amount = Math.min(min + 10 * rng.nextInt(5), floorTo10(cap));
    if (amount >= min) return { type: "bid", amount };
    return pass;
  }

  const worth = propertyWorth(state, me.id, auction.space);
  const important = worth >= price * 1.4;
  const limit = important ? me.money : me.money - cashReserve(state, me.id) / 2;
  const max = floorTo10(Math.min(worth, limit));
  if (min > max) {
    // Letzte Strasse einer Gruppe: notfalls Einzelfelder belasten und weiterbieten.
    if (completesGroup(state, me.id, auction.space) && min <= worth && canManage(ctx)) {
      const mortgage = cheapMortgage(ctx, auction.space);
      if (mortgage) return mortgage;
    }
    return pass;
  }
  // In Sprüngen von etwa 10 % des Preises, damit Versteigerungen nicht ewig dauern.
  const step = Math.max(10, floorTo10(price * 0.1));
  const target = auction.highestBidder === null ? floorTo10(price * 0.5) : auction.highestBid + step;
  return { type: "bid", amount: Math.min(max, Math.max(min, target)) };
}

// ---------------------------------------------------------------------------
// Schulden und Hypothekenentscheid
// ---------------------------------------------------------------------------

function raiseMoney(ctx: BotContext): Action {
  const { state, me, rng } = ctx;
  const bankruptcy = legalOf(ctx, "declareBankruptcy")[0];
  if (bankruptcy) return bankruptcy; // Nur erlaubt, wenn wirklich nichts mehr reicht.
  const mortgages = legalOf(ctx, "mortgage");
  const sells = legalOf(ctx, "sellBuilding");
  // Sicherheitsnetz (sollte nie nötig sein): Die Engine treibt dann selbst Geld auf.
  const fallback: Action = { type: "timeout" };

  if (ctx.level === "easy") return pick<Action>(rng, [...mortgages, ...sells]) ?? fallback;

  // 1. Felder ausserhalb ganzer Gruppen belasten (wenig Mietverlust zuerst).
  const loose = cheapMortgage(ctx, null);
  if (loose) return loose;
  // 2. Gebäude verkaufen, wo am wenigsten Miete verloren geht.
  const sell = best(sells, (a) => {
    const street = getStreet(a.space);
    const level = getProperty(state, a.space).houses;
    const lost = (street.rents[level] ?? 0) - (street.rents[level - 1] ?? 0);
    return -lost / street.housePrice;
  });
  if (sell) return sell;
  // 3. Zuletzt Felder aus ganzen Gruppen belasten.
  return best(mortgages, (a) => -calculateRent(state, a.space, 7)) ?? fallback;
}

/** Nach einem Bankrott übernommene belastete Felder: auslösen, soweit die Reserve bleibt. */
function resolveMortgages(ctx: BotContext): Action {
  const { state, me, rng } = ctx;
  const decision = state.mortgageDecision;
  const keepAll: Action = { type: "resolveMortgages", lift: [] };
  if (!decision) return keepAll;
  const spaces = decision.spaces.map((i) => getPropertySpace(i));

  let lift: SpaceIndex[] = [];
  if (ctx.level === "easy") {
    if (chance(rng, 0.5)) lift = [...decision.spaces];
  } else {
    // Zins wird sowieso fällig; dazu kommt pro ausgelöstem Feld der Rest der Ablösung.
    let cost = spaces.reduce((sum, s) => sum + mortgageInterest(s), 0);
    const reserve = cashReserve(state, me.id);
    const order = [...spaces].sort(
      (a, b) => Number(inCompleteGroup(state, me.id, b.index)) - Number(inCompleteGroup(state, me.id, a.index)) || b.price - a.price,
    );
    for (const space of order) {
      const extra = unmortgageCost(space) - mortgageInterest(space);
      if (me.money - cost - extra >= reserve) {
        cost += extra;
        lift.push(space.index);
      }
    }
  }
  const action: Action = { type: "resolveMortgages", lift };
  return validateAction(state, me.id, action) === null ? action : keepAll;
}
