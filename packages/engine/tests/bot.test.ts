import { describe, expect, it } from "vitest";
import {
  applyAction,
  BOT_NAMES,
  chooseBotAction,
  createGame,
  createSeededRng,
  getWaitingFor,
  TOKENS,
  validateAction,
  type Action,
  type BotLevel,
  type GameState,
  type TradeOffer,
} from "../src";
import { act, newGame, own, placeAt, player, setHouses } from "./helpers";

const rng = () => createSeededRng(42);
const choose = (state: GameState, id: string, level: BotLevel = "clever") => chooseBotAction(state, id, rng(), level);

/** Spieler p1 steht auf einem freien Feld und entscheidet über den Kauf. */
function buyDecision(space: number, money: number): GameState {
  const state = newGame(2);
  placeAt(state, "p1", space);
  player(state, "p1").money = money;
  state.turn = { ...state.turn, phase: "buy", pendingBuy: space, dice: [1, 2] };
  return state;
}

function offer(from: string, to: string, give: Partial<TradeOffer["give"]>, take: Partial<TradeOffer["take"]>): TradeOffer {
  return {
    from,
    to,
    give: { spaces: [], money: 0, jailCards: [], ...give },
    take: { spaces: [], money: 0, jailCards: [], ...take },
    lift: [],
  };
}

describe("Computergegner: Kaufen", () => {
  it("clever kauft die letzte Strasse einer Farbgruppe, auch wenn das Geld knapp wird", () => {
    const state = own(buyDecision(3, 100), "p1", 1);
    expect(choose(state, "p1")).toEqual({ type: "buyProperty" });
  });

  it("clever lässt ein gewöhnliches Feld versteigern, wenn sonst die Reserve fehlt", () => {
    expect(choose(buyDecision(6, 150), "p1")).toEqual({ type: "declineProperty" });
  });

  it("clever kauft ein gewöhnliches Feld, wenn genug Geld bleibt", () => {
    expect(choose(buyDecision(6, 1500), "p1")).toEqual({ type: "buyProperty" });
  });

  it("clever belastet ein Einzelfeld, um die letzte Strasse einer Gruppe kaufen zu können", () => {
    const state = own(buyDecision(3, 40), "p1", 1, 15);
    expect(choose(state, "p1")).toEqual({ type: "mortgage", space: 15 });
  });

});

describe("Computergegner: Bauen und Gefängnis", () => {
  it("clever baut auf einer ganzen Farbgruppe gleichmässig", () => {
    let state = own(newGame(2), "p1", 16, 18, 19);
    player(state, "p1").money = 1000;
    state.turn.phase = "postRoll";
    const bot = rng();
    for (let i = 0; i < 20; i++) {
      const action = chooseBotAction(state, "p1", bot, "clever");
      if (action.type === "endTurn") break;
      expect(action.type).toBe("buildHouse");
      state = act(state, "p1", action).state;
    }
    const levels = [16, 18, 19].map((i) => state.properties[i]!.houses);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(1);
    expect(player(state, "p1").money).toBeGreaterThanOrEqual(30);
  });

  it("bei Häusermangel baut clever um: Haus einer schwachen Gruppe verkaufen, starke Gruppe ausbauen", () => {
    let state = own(newGame(2), "p1", 16, 18, 19, 21, 23, 24);
    own(state, "p2", 31, 32, 34, 37, 39);
    for (const i of [16, 18, 19]) setHouses(state, i, 3);
    for (const i of [21, 23, 24]) setHouses(state, i, 1);
    for (const i of [31, 32, 34, 37, 39]) setHouses(state, i, 4);
    expect(state.bank.houses).toBe(0);
    player(state, "p1").money = 2000;
    state.turn.phase = "postRoll";
    const sell = choose(state, "p1");
    expect(sell.type).toBe("sellBuilding");
    if (sell.type === "sellBuilding") expect([21, 23, 24]).toContain(sell.space);
    state = act(state, "p1", sell).state;
    const build = choose(state, "p1");
    expect(build.type).toBe("buildHouse");
    if (build.type === "buildHouse") expect([16, 18, 19]).toContain(build.space);
  });

  it("clever zahlt früh im Spiel die Kaution, bleibt aber sitzen, wenn Gegner gebaut haben", () => {
    const state = placeAt(newGame(2), "p1", 10);
    player(state, "p1").inJail = true;
    expect(choose(state, "p1")).toEqual({ type: "payJailFine" });
    own(state, "p2", 1, 3);
    setHouses(state, 1, 1);
    expect(choose(state, "p1")).toEqual({ type: "endTurn" });
  });
});

describe("Computergegner: Schulden", () => {
  function inDebt(amount: number, money: number): GameState {
    const state = newGame(2);
    player(state, "p1").money = money;
    state.debts = [{ debtor: "p1", creditor: "bank", amount, reason: "tax", space: 4 }];
    return state;
  }

  it("clever belastet zuerst Einzelfelder, bevor Häuser verkauft werden", () => {
    const state = own(inDebt(300, 50), "p1", 16, 18, 19, 5);
    for (const i of [16, 18, 19]) setHouses(state, i, 2);
    expect(choose(state, "p1")).toEqual({ type: "mortgage", space: 5 });
  });

  it("danach verkauft clever Häuser statt Bankrott zu erklären", () => {
    const state = own(inDebt(300, 50), "p1", 16, 18, 19);
    for (const i of [16, 18, 19]) setHouses(state, i, 2);
    expect(choose(state, "p1").type).toBe("sellBuilding");
  });

  it("Bankrott nur, wenn wirklich nichts mehr reicht", () => {
    expect(choose(inDebt(300, 50), "p1")).toEqual({ type: "declareBankruptcy" });
    expect(choose(inDebt(300, 50), "p1", "easy")).toEqual({ type: "declareBankruptcy" });
  });
});

describe("Computergegner: Handel", () => {
  /** p2 besitzt zwei orange Strassen, p1 die dritte (Zürich West). */
  function orangeOffer(money: number): GameState {
    const state = own(newGame(2), "p2", 16, 18);
    own(state, "p1", 19);
    player(state, "p2").money = 2000;
    state.trade = offer("p2", "p1", { money }, { spaces: [19] });
    return state;
  }

  it("clever gibt die letzte Strasse einer fremden Gruppe nicht für wenig Geld her", () => {
    expect(choose(orangeOffer(220), "p1")).toEqual({ type: "rejectTrade" });
  });

  it("clever nimmt ein sehr gutes Angebot an", () => {
    expect(choose(orangeOffer(1500), "p1").type).toBe("acceptTrade");
  });

  it("einfach rechnet nur mit Listenpreisen und verkauft die Strasse für das Doppelte", () => {
    expect(choose(orangeOffer(400), "p1", "easy").type).toBe("acceptTrade");
  });

  it("clever nimmt einen fairen Tausch an, bei dem beide eine Farbgruppe bekommen", () => {
    const state = own(newGame(3), "p1", 3, 16, 18);
    own(state, "p2", 1, 19);
    state.trade = offer("p2", "p1", { spaces: [19] }, { spaces: [3] });
    expect(choose(state, "p1").type).toBe("acceptTrade");
  });

  it("clever macht höchstens ein Handelsangebot pro Zug", () => {
    let state = own(newGame(3), "p1", 16, 18);
    own(state, "p2", 19);
    player(state, "p1").money = 3000;
    const first = choose(state, "p1");
    expect(first.type).toBe("proposeTrade");
    state = act(state, "p1", first).state;
    state = act(state, "p2", { type: "rejectTrade" }).state;
    expect(choose(state, "p1").type).not.toBe("proposeTrade");
  });
});

describe("Computergegner: Fairness", () => {
  /** Spielstände aus einer Bot-Partie, an denen ein Bot entscheiden muss. */
  function snapshots(count: number): GameState[] {
    const gameRng = createSeededRng(99);
    const botRng = createSeededRng(5);
    const players = ["clever", "easy", "clever", "easy"].map((bot, i) => ({
      id: `b${i + 1}`,
      name: BOT_NAMES[i]!,
      token: TOKENS[i]!,
      bot: bot as BotLevel,
    }));
    let state = createGame({ players }, gameRng);
    const result: GameState[] = [];
    for (let step = 0; step < count && state.winner === null; step++) {
      result.push(state);
      const waiting = getWaitingFor(state)!;
      const next = applyAction(state, waiting, chooseBotAction(state, waiting, botRng), gameRng);
      if (!next.ok) throw new Error(next.error.code);
      state = next.state;
    }
    return result;
  }

  it("die Reihenfolge der Kartenstapel (geheim) ändert keinen Entscheid", () => {
    for (const state of snapshots(400)) {
      const waiting = getWaitingFor(state)!;
      const shuffled: GameState = { ...state, decks: { event: [...state.decks.event].reverse(), community: [...state.decks.community].reverse() } };
      for (const level of ["easy", "clever"] as const) {
        expect(chooseBotAction(shuffled, waiting, createSeededRng(1), level)).toEqual(chooseBotAction(state, waiting, createSeededRng(1), level));
      }
    }
  });

  it("jeder Vorschlag ist eine gültige Aktion der Engine", () => {
    for (const state of snapshots(600)) {
      const waiting = getWaitingFor(state)!;
      for (const level of ["easy", "clever"] as const) {
        const action: Action = chooseBotAction(state, waiting, createSeededRng(3), level);
        expect(validateAction(state, waiting, action)).toBeNull();
        expect(action.type).not.toBe("timeout");
      }
    }
  });

  it("ein Bot entscheidet nur, wenn er an der Reihe ist", () => {
    const state = newGame(2);
    expect(() => chooseBotAction(state, "p2", rng())).toThrow();
  });
});
