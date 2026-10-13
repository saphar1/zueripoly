import { describe, expect, it } from "vitest";
import { getLegalActions, getWaitingFor, liquidationValue, type GameState } from "../src";
import { act, cardOnTop, dice, eventsOfType, expectRejected, newGame, own, placeAt, player, setHouses } from "./helpers";

/** p2 ist am Zug, steht auf 35 und landet mit [1, 3] auf der Bahnhofstrasse (39) von p1. */
function landOnBahnhofstrasse(state: GameState): GameState {
  state.current = 1;
  placeAt(state, "p2", 35);
  return act(state, "p2", { type: "rollDice" }, dice([1, 3])).state;
}

describe("Schulden", () => {
  it("wer zahlen kann, zahlt sofort", () => {
    const state = landOnBahnhofstrasse(own(newGame(2), "p1", 39));
    expect(state.debts).toEqual([]);
    expect(player(state, "p2").money).toBe(1450);
  });

  it("wer nicht bar zahlen kann, muss Geld auftreiben; danach wird automatisch bezahlt", () => {
    const start = own(own(newGame(2), "p1", 37, 39), "p2", 1, 3, 5);
    setHouses(start, 39, 1);
    setHouses(start, 37, 1);
    setHouses(start, 1, 2);
    setHouses(start, 3, 2);
    player(start, "p2").money = 100;
    let state = landOnBahnhofstrasse(start); // Miete 200
    expect(state.debts).toEqual([{ debtor: "p2", creditor: "p1", amount: 200, reason: "rent", space: 39 }]);
    expect(getWaitingFor(state)).toBe("p2");
    expect(getLegalActions(state, "p2").map((a) => a.type).sort()).toEqual(["mortgage", "sellBuilding", "sellBuilding"]);
    expectRejected(state, "p2", { type: "declareBankruptcy" }, "canStillPay");
    expectRejected(state, "p2", { type: "endTurn" }, "wrongPhase");
    expectRejected(state, "p1", { type: "rollDice" }, "notYourTurn");
    ({ state } = act(state, "p2", { type: "mortgage", space: 5 })); // +100 = 200 → bezahlt
    expect(state.debts).toEqual([]);
    expect(player(state, "p2").money).toBe(0);
    expect(player(state, "p1").money).toBe(1700);
    expect(state.turn.phase).toBe("postRoll");
  });

  it("mehrere Schulden werden der Reihe nach beglichen", () => {
    let state = cardOnTop(newGame(3), "community", "G07");
    player(state, "p2").money = 20;
    own(state, "p2", 39);
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 1])));
    expect(state.debts.map((d) => d.debtor)).toEqual(["p2", "p3"]);
    expect(getWaitingFor(state)).toBe("p2");
    ({ state } = act(state, "p2", { type: "mortgage", space: 39 }));
    expect(state.debts).toEqual([]);
    expect(state.players.map((p) => p.money)).toEqual([1600, 170, 1450]);
    expect(getWaitingFor(state)).toBe("p1");
  });
});

describe("Bankrott", () => {
  it("ist nur möglich, wenn alles Verkaufen und Belasten nicht reicht", () => {
    const state = own(own(newGame(3), "p1", 39), "p2", 1);
    player(state, "p2").money = 10;
    expect(liquidationValue(state, "p2")).toBe(30);
    const after = landOnBahnhofstrasse(state); // Miete 50, möglich: 10 + 30 = 40
    expect(getLegalActions(after, "p2").map((a) => a.type)).toContain("declareBankruptcy");
  });

  it("an einen Mitspieler: Gebäude zum halben Preis an die Bank, alles an den Gläubiger", () => {
    const start = own(own(newGame(3), "p1", 37, 39), "p2", 6, 8, 9, 12);
    setHouses(start, 37, 5);
    setHouses(start, 39, 5); // Miete 2000
    for (const s of [6, 8, 9]) setHouses(start, s, 2);
    start.properties[12]!.mortgaged = true;
    player(start, "p2").jailCards.push("G05");
    start.decks.community = start.decks.community.filter((c) => c !== "G05");
    player(start, "p2").money = 100;
    let state = landOnBahnhofstrasse(start);
    // Möglich: 100 + 6 Häuser à 25 + Hypotheken 50 + 50 + 60 = 410 < 2000
    const { state: after, events } = act(state, "p2", { type: "declareBankruptcy" });
    state = after;
    expect(player(state, "p2")).toMatchObject({ bankrupt: true, money: 0, jailCards: [] });
    expect([6, 8, 9, 12].map((s) => state.properties[s]?.owner)).toEqual(["p1", "p1", "p1", "p1"]);
    expect([6, 8, 9].map((s) => state.properties[s]?.houses)).toEqual([0, 0, 0]);
    expect(state.bank.houses).toBe(32);
    expect(player(state, "p1")).toMatchObject({ money: 1500 + 100 + 150, jailCards: ["G05"] });
    expect(eventsOfType(events, "bankrupt")[0]).toEqual({ type: "bankrupt", player: "p2", creditor: "p1" });
    // Belastetes Feld: p1 entscheidet (ablösen oder 10 % Zins).
    expect(state.mortgageDecision).toEqual({ player: "p1", spaces: [12] });
    expect(getWaitingFor(state)).toBe("p1");
    expectRejected(state, "p1", { type: "rollDice" }, "wrongPhase");
    ({ state } = act(state, "p1", { type: "resolveMortgages", lift: [] }));
    expect(player(state, "p1").money).toBe(1750 - 8);
    expect(state.properties[12]?.mortgaged).toBe(true);
    // p2 war am Zug: jetzt ist p3 dran.
    expect(getWaitingFor(state)).toBe("p3");
    expect(state.winner).toBeNull();
  });

  it("an die Bank: Gebäude zurück, Felder sind wieder frei und unbelastet (keine Versteigerung)", () => {
    const start = own(newGame(3), "p2", 1, 3, 5);
    setHouses(start, 1, 1);
    start.properties[5]!.mortgaged = true;
    player(start, "p2").money = 0;
    start.current = 1;
    placeAt(start, "p2", 0);
    // Steuer 100; möglich wären nur 25 (Haus) + 2 × 30 (Hypotheken) = 85.
    let { state } = act(start, "p2", { type: "rollDice" }, dice([1, 3]));
    expect(state.debts[0]).toMatchObject({ debtor: "p2", creditor: "bank", amount: 100 });
    ({ state } = act(state, "p2", { type: "declareBankruptcy" }));
    expect(state.bank.houses).toBe(32);
    for (const space of [1, 3, 5]) expect(state.properties[space]).toMatchObject({ owner: null, mortgaged: false, houses: 0 });
    expect(getWaitingFor(state)).toBe("p3");
    // Wer auf ein zurückgegebenes Feld kommt, kann es zum vollen Preis kaufen.
    placeAt(state, "p3", 0);
    ({ state } = act(state, "p3", { type: "rollDice" }, dice([2, 3])));
    expect(state.turn).toMatchObject({ phase: "buy", pendingBuy: 5 });
  });

  it("der letzte verbliebene Spieler gewinnt", () => {
    const start = own(newGame(2), "p1", 39);
    player(start, "p2").money = 10;
    const state = landOnBahnhofstrasse(start);
    const { state: after, events } = act(state, "p2", { type: "declareBankruptcy" });
    expect(after.winner).toBe("p1");
    expect(player(after, "p1").money).toBe(1510);
    expect(eventsOfType(events, "gameWon")[0]?.player).toBe("p1");
    expect(getWaitingFor(after)).toBeNull();
    expect(getLegalActions(after, "p1")).toEqual([]);
    expectRejected(after, "p1", { type: "rollDice" }, "gameOver");
  });

  it("ausgeschiedene Spieler können nichts mehr tun", () => {
    const start = own(newGame(3), "p1", 39);
    player(start, "p2").money = 0;
    const state = act(landOnBahnhofstrasse(start), "p2", { type: "declareBankruptcy" }).state;
    expectRejected(state, "p2", { type: "rollDice" }, "playerOut");
  });
});
