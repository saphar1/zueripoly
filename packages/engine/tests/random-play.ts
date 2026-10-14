// Zufallspartien: komplette Spiele mit zufälligen, aber gültigen Aktionen.
// Nach jeder Aktion werden die Invarianten geprüft, am Ende das ganze Geld-Protokoll.
import { expect } from "vitest";
import {
  applyAction,
  canProposeTrade,
  checkInvariants,
  checkMoneyLog,
  createGame,
  createSeededRng,
  deserializeGame,
  findPropertySpace,
  getActivePlayers,
  getLegalActions,
  getOwnedSpaces,
  getWaitingFor,
  isFreeOfBuildings,
  removePlayer,
  serializeGame,
  TOKENS,
  validateAction,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Rng,
  type SeededRng,
} from "../src";

// Lange Partien (meist 5–6 Spieler) werden hier abgebrochen. Einzelne Zufallspartien enden nie,
// z. B. bei Häusermangel: alle 32 Häuser verbaut, kein Hotel möglich, beide Spieler reich.
const MAX_STEPS = 6000;

export interface GameSummary {
  finished: boolean;
  steps: number;
  trades: number;
  bankruptcies: number;
  hotels: number;
  timeouts: number;
  removed: number;
}

function chance(rng: Rng, p: number): boolean {
  return rng.nextInt(1000) < p * 1000;
}

function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[rng.nextInt(items.length)];
}

function randomSubset<T>(rng: Rng, items: readonly T[], max: number): T[] {
  return items.filter(() => chance(rng, 0.3)).slice(0, max);
}

function randomTrade(state: GameState, from: PlayerId, rng: Rng): Action | null {
  const partners = getActivePlayers(state).filter((p) => p.id !== from);
  const partner = pick(rng, partners);
  if (!partner) return null;
  const me = state.players.find((p) => p.id === from);
  if (!me) return null;
  const tradeable = (id: PlayerId) =>
    getOwnedSpaces(state, id).filter((i) => {
      const space = findPropertySpace(i);
      return space !== null && isFreeOfBuildings(state, space);
    });
  const giveSpaces = randomSubset(rng, tradeable(from), 2);
  const takeSpaces = randomSubset(rng, tradeable(partner.id), 2);
  const action: Action = {
    type: "proposeTrade",
    offer: {
      to: partner.id,
      give: {
        spaces: giveSpaces,
        money: chance(rng, 0.5) ? 10 * rng.nextInt(Math.floor(me.money / 10) + 1) : 0,
        jailCards: chance(rng, 0.5) ? me.jailCards.slice(0, 1) : [],
      },
      take: {
        spaces: takeSpaces,
        money: chance(rng, 0.3) ? 10 * rng.nextInt(Math.floor(partner.money / 20) + 1) : 0,
        jailCards: chance(rng, 0.5) ? partner.jailCards.slice(0, 1) : [],
      },
      lift: takeSpaces.filter((i) => state.properties[i]?.mortgaged && chance(rng, 0.5)),
    },
  };
  return validateAction(state, from, action) === null ? action : null;
}

/** Zufällige, aber nicht völlig planlose Spielweise, damit Partien auch zu Ende gehen. */
function chooseAction(state: GameState, playerId: PlayerId, rng: Rng): Action {
  if (chance(rng, 0.01)) return { type: "timeout" };
  const legal = getLegalActions(state, playerId);
  const of = (type: Action["type"]) => legal.filter((a) => a.type === type);
  const first = (type: Action["type"]) => of(type)[0];

  if (state.trade) {
    const accept = first("acceptTrade");
    if (accept && chance(rng, 0.5)) {
      const mortgaged = state.trade.give.spaces.filter((i) => state.properties[i]?.mortgaged);
      const withLift: Action = { type: "acceptTrade", lift: randomSubset(rng, mortgaged, 2) };
      return validateAction(state, playerId, withLift) === null ? withLift : accept;
    }
    return { type: "rejectTrade" };
  }
  if (state.mortgageDecision) return pick(rng, of("resolveMortgages")) ?? { type: "resolveMortgages", lift: [] };

  if (state.debts[0]) {
    if (canProposeTrade(state, playerId) && chance(rng, 0.05)) {
      const trade = randomTrade(state, playerId, rng);
      if (trade) return trade;
    }
    const raise = [...of("mortgage"), ...of("sellBuilding")];
    const bankrupt = first("declareBankruptcy");
    if (bankrupt && (raise.length === 0 || chance(rng, 0.3))) return bankrupt;
    return pick(rng, raise) ?? { type: "timeout" };
  }

  // Eigener Zug
  if (canProposeTrade(state, playerId) && chance(rng, 0.02)) {
    const trade = randomTrade(state, playerId, rng);
    if (trade) return trade;
  }
  const permit = pick(rng, of("useBuildPermit"));
  if (permit && chance(rng, 0.5)) return permit;
  const build = pick(rng, of("buildHouse"));
  if (build && chance(rng, 0.6)) return build;
  const unmortgage = pick(rng, of("unmortgage"));
  if (unmortgage && chance(rng, 0.15)) return unmortgage;
  const mortgage = pick(rng, of("mortgage"));
  if (mortgage && chance(rng, 0.01)) return mortgage;
  const sell = pick(rng, of("sellBuilding"));
  if (sell && chance(rng, 0.01)) return sell;

  if (state.turn.phase === "buy") {
    const buy = first("buyProperty");
    return buy && chance(rng, 0.85) ? buy : { type: "declineProperty" };
  }
  if (state.turn.phase === "preRoll") {
    const card = first("useJailCard");
    if (card && chance(rng, 0.5)) return card;
    const fine = first("payJailFine");
    if (fine && chance(rng, 0.3)) return fine;
    // Im Gefängnis: einen Zug aussitzen.
    return first("rollDice") ?? { type: "endTurn" };
  }
  return { type: "endTurn" };
}

/**
 * Eine Zufallspartie. `removeChance`: Wahrscheinlichkeit pro Schritt, dass ein zufälliger Spieler
 * von aussen aus dem Spiel genommen wird (online: Host entscheidet bei Abwesenheit).
 */
export function playRandomGame(seed: number, removeChance = 0): GameSummary {
  const gameRng: SeededRng = createSeededRng(seed * 7919 + 1);
  const policy = createSeededRng(seed);
  const playerCount = 2 + (seed % 5);
  const players = TOKENS.slice(0, playerCount).map((token, i) => ({ id: `s${seed}p${i}`, name: `Spieler ${i}`, token }));
  const options = { startMoney: [500, 800, 1000, 1500][seed % 4] ?? 1500, jackpot: seed % 3 === 0 };
  let state = createGame({ players, options }, gameRng);
  const events: GameEvent[] = [...state.log];
  const summary: GameSummary = { finished: false, steps: 0, trades: 0, bankruptcies: 0, hotels: 0, timeouts: 0, removed: 0 };

  for (let step = 0; step < MAX_STEPS && state.winner === null; step++) {
    const waiting = getWaitingFor(state);
    if (waiting === null) throw new Error(`Seed ${seed}: niemand an der Reihe, aber kein Gewinner.`);

    // Nur der wartende Spieler (und ein Anbieter beim Zurückziehen) darf handeln. Stichprobe, weil teuer.
    for (const p of step % 5 === 0 ? getActivePlayers(state) : []) {
      if (p.id === waiting) continue;
      const others = getLegalActions(state, p.id).map((a) => a.type);
      const allowed = state.trade?.from === p.id ? ["cancelTrade"] : [];
      if (others.join() !== allowed.join()) {
        throw new Error(`Seed ${seed}, Schritt ${step}: ${p.id} hätte Aktionen ${others.join()}, wartet wird auf ${waiting}.`);
      }
    }

    if (removeChance > 0 && chance(policy, removeChance)) {
      const victim = pick(policy, getActivePlayers(state));
      const removed = victim && removePlayer(state, victim.id);
      if (!removed || !removed.ok) throw new Error(`Seed ${seed}, Schritt ${step}: Entfernen abgelehnt.`);
      state = removed.state;
      events.push(...removed.events);
      summary.steps = step + 1;
      const problems = checkInvariants(state);
      if (problems.length > 0) throw new Error(`Seed ${seed}, Schritt ${step} nach Entfernen von ${victim.id}: ${problems.join(" | ")}`);
      continue;
    }

    let actor = waiting;
    let action = chooseAction(state, waiting, policy);
    if (state.trade && chance(policy, 0.1)) {
      actor = state.trade.from;
      action = { type: "cancelTrade" };
    }
    if (getLegalActions(state, actor).length === 0 && action.type !== "timeout" && action.type !== "proposeTrade") {
      throw new Error(`Seed ${seed}, Schritt ${step}: ${actor} hat keine gültige Aktion (Sackgasse).`);
    }

    const result = applyAction(state, actor, action, gameRng);
    if (!result.ok) {
      throw new Error(`Seed ${seed}, Schritt ${step}: ${actor} ${JSON.stringify(action)} abgelehnt: ${result.error.code}`);
    }
    state = result.state;
    events.push(...result.events);
    summary.steps = step + 1;

    const problems = checkInvariants(state);
    if (problems.length > 0) {
      throw new Error(`Seed ${seed}, Schritt ${step} nach ${JSON.stringify(action)}: ${problems.join(" | ")}`);
    }
  }

  const moneyProblems = checkMoneyLog(state, events);
  if (moneyProblems.length > 0) throw new Error(`Seed ${seed}: ${moneyProblems.join(" | ")}`);
  expect(deserializeGame(serializeGame(state, gameRng.getState())).state).toEqual(state);

  summary.finished = state.winner !== null;
  summary.trades = events.filter((e) => e.type === "tradeAccepted").length;
  summary.bankruptcies = events.filter((e) => e.type === "bankrupt").length;
  summary.hotels = events.filter((e) => e.type === "houseBuilt" && e.level === 5).length;
  summary.timeouts = events.filter((e) => e.type === "timeout").length;
  summary.removed = events.filter((e) => e.type === "playerRemoved").length;
  return summary;
}

/** Spielt die Partien `from` bis `to` (Seeds) und prüft, dass sie sinnvoll verlaufen. */
export function playRandomGames(from: number, to: number, removeChance = 0): void {
  const results: GameSummary[] = [];
  for (let seed = from; seed <= to; seed++) results.push(playRandomGame(seed, removeChance));
  const games = results.length;
  const finished = results.filter((r) => r.finished).length;
  const total = (key: keyof Omit<GameSummary, "finished">) => results.reduce((sum, r) => sum + r[key], 0);
  console.log(
    `Zufallspartien ${from}–${to}: ${finished}/${games} mit Gewinner, ${total("steps")} Aktionen, ` +
      `${total("trades")} Handel, ${total("bankruptcies")} Bankrotte, ${total("hotels")} Hotels, ${total("timeouts")} Zeitabläufe` +
      (removeChance > 0 ? `, ${total("removed")} entfernt` : ""),
  );
  // Die meisten Partien sollen mit einem Gewinner enden (sonst hängt etwas im Ablauf).
  expect(finished).toBeGreaterThan(games * 0.8);
  expect(total("trades")).toBeGreaterThan(0);
  expect(total("hotels")).toBeGreaterThan(0);
  if (removeChance > 0) expect(total("removed")).toBeGreaterThan(0);
}
