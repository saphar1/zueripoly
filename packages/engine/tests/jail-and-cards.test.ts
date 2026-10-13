import { describe, expect, it } from "vitest";
import { getLegalActions, type GameState } from "../src";
import { act, cardOnTop, dice, eventsOfType, expectRejected, newGame, own, placeAt, player, setHouses } from "./helpers";

function jailed(): GameState {
  const state = placeAt(newGame(2), "p1", 10);
  player(state, "p1").inJail = true;
  return state;
}

describe("Gefängnis", () => {
  it("bietet zahlen, Freikarte oder einen Zug aussetzen an, aber kein Würfeln", () => {
    const state = jailed();
    expect(getLegalActions(state, "p1").map((a) => a.type)).toEqual(["payJailFine", "endTurn"]);
    player(state, "p1").jailCards.push("E08");
    state.decks.event = state.decks.event.filter((c) => c !== "E08");
    expect(getLegalActions(state, "p1").map((a) => a.type)).toEqual(["payJailFine", "useJailCard", "endTurn"]);
    expectRejected(state, "p1", { type: "rollDice" }, "inJail");
  });

  it("50 CHF zahlen, dann normal würfeln (Pasch gibt weiteren Wurf)", () => {
    let { state } = act(jailed(), "p1", { type: "payJailFine" });
    expect(player(state, "p1")).toMatchObject({ inJail: false, money: 1450 });
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([3, 3])));
    expect(player(state, "p1").position).toBe(16);
    expect(state.turn.extraRoll || state.turn.phase === "buy").toBe(true);
  });

  it("Freikarte abgeben: Karte geht unter den Stapel", () => {
    const state = jailed();
    player(state, "p1").jailCards.push("G05");
    state.decks.community = state.decks.community.filter((c) => c !== "G05");
    const { state: after } = act(state, "p1", { type: "useJailCard" });
    expect(player(after, "p1")).toMatchObject({ inJail: false, jailCards: [] });
    expect(after.decks.community.at(-1)).toBe("G05");
  });

  it("einen Zug aussitzen: im nächsten eigenen Zug frei und ohne Kaution würfeln", () => {
    let { state, events } = act(jailed(), "p1", { type: "endTurn" });
    expect(eventsOfType(events, "jailTurnServed")).toHaveLength(1);
    expect(player(state, "p1")).toMatchObject({ inJail: true, jailTurns: 1, position: 10 });
    ({ state } = act(state, "p2", { type: "rollDice" }, dice([1, 2]))); // p2 auf Feld 3
    ({ state } = act(state, "p2", { type: "declineProperty" }));
    ({ state, events } = act(state, "p2", { type: "endTurn" }));
    expect(eventsOfType(events, "leftJail")[0]?.method).toBe("served");
    expect(player(state, "p1")).toMatchObject({ inJail: false, jailTurns: 0 });
    expect(state.turn.phase).toBe("preRoll");
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([2, 3])));
    expect(player(state, "p1")).toMatchObject({ position: 15, money: 1500 });
  });

  it("wer ins Gefängnis kommt, beendet den Zug normal und sitzt erst den nächsten aus", () => {
    let { state } = act(placeAt(newGame(2), "p1", 25), "p1", { type: "rollDice" }, dice([2, 3])); // Feld 30
    expect(player(state, "p1")).toMatchObject({ inJail: true, jailTurns: 0 });
    ({ state } = act(state, "p1", { type: "endTurn" }));
    expect(player(state, "p1")).toMatchObject({ inJail: true, jailTurns: 0 });
    ({ state } = act(state, "p2", { type: "rollDice" }, dice([1, 2])));
    ({ state } = act(state, "p2", { type: "declineProperty" }));
    ({ state } = act(state, "p2", { type: "endTurn" }));
    expect(player(state, "p1").inJail).toBe(true);
    expect(getLegalActions(state, "p1").map((a) => a.type)).toEqual(["payJailFine", "endTurn"]);
  });

  it("Zeitlimit im Gefängnis: sitzt den Zug aus", () => {
    const { state, events } = act(jailed(), "p1", { type: "timeout" });
    expect(eventsOfType(events, "jailTurnServed")).toHaveLength(1);
    expect(player(state, "p1")).toMatchObject({ inJail: true, jailTurns: 1, money: 1500 });
    expect(state.players[state.current]?.id).toBe("p2");
  });

  it("lehnt Gefängnis-Aktionen ausserhalb des Gefängnisses ab", () => {
    const state = newGame(2);
    expectRejected(state, "p1", { type: "payJailFine" }, "notInJail");
    expectRejected(jailed(), "p1", { type: "useJailCard" }, "noJailCard");
  });
});

describe("Steuern, Ferien und Jackpot", () => {
  it("Steuerfelder kosten 100 bzw. 50 CHF", () => {
    const { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([1, 3]));
    expect(player(state, "p1").money).toBe(1400);
    const late = placeAt(newGame(2), "p1", 35);
    expect(player(act(late, "p1", { type: "rollDice" }, dice([1, 2])).state, "p1").money).toBe(1450);
  });

  it("ohne Jackpot passiert auf Ferien am Zürichsee nichts", () => {
    const state = placeAt(newGame(2), "p1", 15);
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([2, 3]));
    expect(player(after, "p1").money).toBe(1500);
  });

  it("mit Jackpot fliessen Steuern, Bussen und Gefängnisgeld in den Topf, Ferien kassieren ihn", () => {
    let state = newGame(2, { jackpot: true });
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 3]))); // Steuer 100
    expect(state.jackpot).toBe(100);
    ({ state } = act(state, "p1", { type: "endTurn" }));
    placeAt(state, "p2", 10).players[1]!.inJail = true;
    ({ state } = act(state, "p2", { type: "payJailFine" }));
    expect(state.jackpot).toBe(150);
    ({ state } = act(state, "p2", { type: "rollDice" }, dice([4, 6]))); // Feld 20
    expect(state.jackpot).toBe(0);
    expect(player(state, "p2").money).toBe(1500 - 50 + 150);
  });
});

describe("Karten", () => {
  it("Karten kommen unter den Stapel, Freikarten bleiben beim Spieler", () => {
    let state = cardOnTop(newGame(2), "community", "G09");
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 1])));
    expect(state.decks.community.at(-1)).toBe("G09");
    expect(player(state, "p1").money).toBe(1520);
    cardOnTop(state, "event", "E08");
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([2, 3]))); // Feld 7
    expect(player(state, "p1").jailCards).toEqual(["E08"]);
    expect(state.decks.event).not.toContain("E08");
    expect(state.decks.event).toHaveLength(15);
  });

  it("E01 / G01: auf Start vorrücken und 200 CHF", () => {
    const state = cardOnTop(placeAt(newGame(2), "p1", 31), "community", "G01");
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([1, 1])); // Feld 33
    expect(player(after, "p1")).toMatchObject({ position: 0, money: 1700 });
  });

  it("E02: zum Utoquai, Start-Geld nur beim Überqueren", () => {
    const before = cardOnTop(placeAt(newGame(2), "p1", 4), "event", "E02");
    const { state: a } = act(before, "p1", { type: "rollDice" }, dice([1, 2])); // Feld 7 → 34
    expect(player(a, "p1")).toMatchObject({ position: 34, money: 1500 });
    expect(a.turn.pendingBuy).toBe(34);
    const after = cardOnTop(placeAt(newGame(2), "p1", 33), "event", "E02");
    const { state: b } = act(after, "p1", { type: "rollDice" }, dice([1, 2])); // Feld 36 → 34 über Start
    expect(player(b, "p1")).toMatchObject({ position: 34, money: 1700 });
  });

  it("E05: nächster Bahnhof, doppelte Miete", () => {
    const state = cardOnTop(own(placeAt(newGame(2), "p1", 33), "p2", 5, 15), "event", "E05");
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([1, 2])); // Feld 36 → 5 über Start
    expect(player(after, "p1").position).toBe(5);
    expect(player(after, "p1").money).toBe(1500 + 200 - 100);
    expect(player(after, "p2").money).toBe(1600);
  });

  it("E04: nächster Versorger, neu würfeln und 10-fach zahlen", () => {
    const state = cardOnTop(own(placeAt(newGame(2), "p1", 19), "p2", 28), "event", "E04");
    const { state: after, events } = act(state, "p1", { type: "rollDice" }, dice([1, 2], [3, 4])); // Feld 22 → 28
    expect(player(after, "p1").position).toBe(28);
    expect(eventsOfType(events, "diceRolled").map((e) => e.purpose)).toEqual(["move", "utilityRent"]);
    expect(player(after, "p2").money).toBe(1570);
  });

  it("E04: freier Versorger darf gekauft werden", () => {
    const state = cardOnTop(placeAt(newGame(2), "p1", 4), "event", "E04");
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([1, 2]));
    expect(after.turn).toMatchObject({ phase: "buy", pendingBuy: 12 });
  });

  it("E09: 3 Felder zurück, ohne Start-Geld; von 36 auf eine Gemeindekarte", () => {
    const state = cardOnTop(cardOnTop(placeAt(newGame(2), "p1", 33), "event", "E09"), "community", "G16");
    const { state: after, events } = act(state, "p1", { type: "rollDice" }, dice([1, 2]));
    expect(player(after, "p1")).toMatchObject({ position: 33, money: 1510 });
    expect(eventsOfType(events, "moved").map((e) => e.direction)).toEqual(["forward", "backward"]);
    expect(eventsOfType(events, "cardDrawn").map((e) => e.card)).toEqual(["E09", "G16"]);
  });

  it("E09: von Feld 7 zurück auf die Steuer", () => {
    const state = cardOnTop(newGame(2), "event", "E09");
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([3, 4]));
    expect(player(after, "p1")).toMatchObject({ position: 4, money: 1400 });
  });

  it("E10 / G06: direkt ins Gefängnis, auch nach einem Pasch kein weiterer Wurf", () => {
    const state = cardOnTop(newGame(2), "community", "G06");
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([1, 1]));
    expect(player(after, "p1")).toMatchObject({ position: 10, inJail: true, money: 1500 });
    expect(after.turn.phase).toBe("postRoll");
  });

  it("E11 / G15: Reparaturen pro Haus und Hotel", () => {
    const state = cardOnTop(own(placeAt(newGame(2), "p1", 13), "p1", 6, 8, 9), "community", "G15");
    setHouses(state, 6, 4);
    setHouses(state, 8, 4);
    setHouses(state, 9, 5);
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([1, 3])); // Feld 17
    expect(player(after, "p1").money).toBe(1500 - 8 * 40 - 115);
    const none = cardOnTop(placeAt(newGame(2), "p1", 13), "community", "G15");
    expect(player(act(none, "p1", { type: "rollDice" }, dice([1, 3])).state, "p1").money).toBe(1500);
  });

  it("E13: jedem Mitspieler 50 CHF zahlen, G07 / G10: jeder zahlt dir", () => {
    const pay = cardOnTop(newGame(4), "event", "E13");
    const { state: a } = act(pay, "p1", { type: "rollDice" }, dice([3, 4]));
    expect(a.players.map((p) => p.money)).toEqual([1350, 1550, 1550, 1550]);
    const collect = cardOnTop(newGame(4), "community", "G10");
    const { state: b } = act(collect, "p1", { type: "rollDice" }, dice([1, 1]));
    expect(b.players.map((p) => p.money)).toEqual([1530, 1490, 1490, 1490]);
  });

  it("E12, G03, G12: Bussen an die Bank", () => {
    const state = cardOnTop(newGame(2), "event", "E12");
    expect(player(act(state, "p1", { type: "rollDice" }, dice([3, 4])).state, "p1").money).toBe(1485);
  });
});
