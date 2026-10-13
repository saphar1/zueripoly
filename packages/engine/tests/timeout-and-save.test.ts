import { describe, expect, it } from "vitest";
import {
  applyAction,
  createSeededRng,
  deserializeGame,
  getLegalActions,
  getWaitingFor,
  serializeGame,
  SAVE_FORMAT,
} from "../src";
import { act, cardOnTop, dice, eventsOfType, expectRejected, newGame, own, placeAt, player, setHouses } from "./helpers";

describe("Zeitlimit (timeout)", () => {
  it("würfelt, kauft nicht und beendet den Zug", () => {
    let state = newGame(2, { turnTimeLimit: 30 });
    expectRejected(state, "p2", { type: "timeout" }, "notYourTurn");
    ({ state } = act(state, "p1", { type: "timeout" }, dice([1, 2])));
    expect(state.turn.phase).toBe("buy");
    ({ state } = act(state, "p1", { type: "timeout" }));
    expect(state.properties[3]?.owner).toBeNull();
    expect(state.turn.phase).toBe("postRoll");
    const { state: after, events } = act(state, "p1", { type: "timeout" });
    expect(eventsOfType(events, "timeout")).toHaveLength(1);
    expect(eventsOfType(events, "turnEnded")).toHaveLength(1);
    expect(getWaitingFor(after)).toBe("p2");
  });

  it("lehnt ein offenes Handelsangebot ab", () => {
    let state = own(newGame(2), "p2", 3);
    ({ state } = act(state, "p1", { type: "proposeTrade", offer: { to: "p2", give: { spaces: [], money: 10, jailCards: [] }, take: { spaces: [3], money: 0, jailCards: [] } } }));
    const { state: after } = act(state, "p2", { type: "timeout" });
    expect(after.trade).toBeNull();
    expect(after.properties[3]?.owner).toBe("p2");
  });

  it("treibt bei Schulden automatisch Geld auf (zuerst belasten, dann verkaufen)", () => {
    const start = own(own(newGame(2), "p1", 39), "p2", 6, 8, 9, 15);
    for (const s of [6, 8, 9]) setHouses(start, s, 2);
    player(start, "p2").money = 0;
    start.current = 1;
    placeAt(start, "p2", 35);
    let { state } = act(start, "p2", { type: "rollDice" }, dice([1, 3])); // Miete 50
    ({ state } = act(state, "p2", { type: "timeout" }));
    expect(state.debts).toEqual([]);
    expect(state.properties[15]?.mortgaged).toBe(true);
    expect([6, 8, 9].map((s) => state.properties[s]?.houses)).toEqual([2, 2, 2]);
    expect(player(state, "p2").money).toBe(50);
  });

  it("erklärt Bankrott, wenn nichts mehr reicht", () => {
    const start = own(newGame(3), "p1", 39);
    player(start, "p2").money = 0;
    start.current = 1;
    placeAt(start, "p2", 35);
    const { state } = act(start, "p2", { type: "rollDice" }, dice([1, 3]));
    const { state: after } = act(state, "p2", { type: "timeout" });
    expect(player(after, "p2").bankrupt).toBe(true);
    expect(getWaitingFor(after)).toBe("p3");
  });

  it("lässt im Gefängnis würfeln", () => {
    const state = placeAt(newGame(2), "p1", 10);
    player(state, "p1").inJail = true;
    const { state: after } = act(state, "p1", { type: "timeout" }, dice([1, 2]));
    expect(player(after, "p1")).toMatchObject({ inJail: true, jailTurns: 1 });
  });
});

describe("Spielstand speichern und laden", () => {
  it("ergibt nach dem Laden genau denselben Spielstand und spielt gleich weiter", () => {
    const rng = createSeededRng(2024);
    const state = act(newGame(3, { jackpot: true }), "p1", { type: "rollDice" }, rng).state;
    const json = serializeGame(state, rng.getState());
    const loaded = deserializeGame(json);
    expect(loaded.state).toEqual(state);
    expect(loaded.rngState).toBe(rng.getState());
    // Gleiche Aktion mit der weitergeführten Zufallsquelle ergibt denselben Folgezustand.
    const waiting = getWaitingFor(state) ?? "";
    const next = getLegalActions(state, waiting)[0] ?? { type: "endTurn" as const };
    const original = applyAction(state, waiting, next, rng);
    const resumed = applyAction(loaded.state, waiting, next, createSeededRng(loaded.rngState ?? 0));
    expect(resumed).toEqual(original);
  });

  it("lehnt kaputte oder fremde Dateien ab", () => {
    const state = newGame(2);
    expect(() => deserializeGame("{nicht json")).toThrow(/JSON/);
    expect(() => deserializeGame(JSON.stringify({ format: "anderes" }))).toThrow(/kein ZüriPoly/);
    expect(() => deserializeGame(JSON.stringify({ format: SAVE_FORMAT, version: 99, state }))).toThrow(/Version/);
    const broken = structuredCloneJson(state);
    broken.bank.houses = 40;
    expect(() => deserializeGame(serializeGame(broken))).toThrow(/beschädigt/);
    expect(() => deserializeGame(JSON.stringify({ format: SAVE_FORMAT, version: 1, state: { formatVersion: 1 } }))).toThrow(/unvollständig/);
  });

  it("verändert den alten Zustand nie", () => {
    const state = newGame(2);
    const before = JSON.stringify(state);
    const result = applyAction(state, "p1", { type: "rollDice" }, dice([3, 4]));
    expect(result.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
});

function structuredCloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
