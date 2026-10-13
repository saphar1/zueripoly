import { describe, expect, it } from "vitest";
import { getLegalActions, getWaitingFor } from "../src";
import { act, cardOnTop, dice, eventsOfType, expectRejected, newGame, placeAt, player } from "./helpers";

describe("Würfeln und Ziehen", () => {
  it("zieht um die Augensumme und wechselt nach Zug beenden zum nächsten Spieler", () => {
    let { state, events } = act(newGame(3), "p1", { type: "rollDice" }, dice([2, 4]));
    expect(player(state, "p1").position).toBe(6);
    expect(state.turn.phase).toBe("buy");
    expect(eventsOfType(events, "diceRolled")[0]?.dice).toEqual([2, 4]);
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    expect(state.turn.phase).toBe("postRoll");
    ({ state, events } = act(state, "p1", { type: "endTurn" }));
    expect(getWaitingFor(state)).toBe("p2");
    expect(state.turnNumber).toBe(2);
    expect(eventsOfType(events, "turnStarted")[0]?.player).toBe("p2");
  });

  it("lässt nur den Spieler am Zug würfeln und nur einmal ohne Pasch", () => {
    const state = newGame(2);
    expectRejected(state, "p2", { type: "rollDice" }, "notYourTurn");
    expectRejected(state, "p1", { type: "endTurn" }, "wrongPhase");
    expectRejected(state, "nobody", { type: "rollDice" }, "unknownPlayer");
    const after = act(state, "p1", { type: "rollDice" }, dice([1, 2])).state;
    expectRejected(after, "p1", { type: "rollDice" }, "wrongPhase");
    expectRejected(after, "p1", { type: "endTurn" }, "wrongPhase");
  });

  it("zahlt 200 CHF beim Überqueren von Start", () => {
    const state = placeAt(newGame(2), "p1", 36);
    const { state: after, events } = act(state, "p1", { type: "rollDice" }, dice([3, 3])); // 36 + 6 = 2
    expect(player(after, "p1").position).toBe(2);
    expect(eventsOfType(events, "moved")[0]).toMatchObject({ from: 36, to: 2, passedStart: true });
    expect(eventsOfType(events, "moneyTransferred").find((e) => e.reason === "start")?.amount).toBe(200);
  });

  it("zahlt 200 CHF beim Landen auf Start, aber nicht doppelt", () => {
    const state = placeAt(newGame(2), "p1", 33);
    const { state: after, events } = act(state, "p1", { type: "rollDice" }, dice([3, 4])); // 33 + 7 = 40 → 0
    expect(player(after, "p1").position).toBe(0);
    expect(player(after, "p1").money).toBe(1700);
    expect(eventsOfType(events, "moneyTransferred").filter((e) => e.reason === "start")).toHaveLength(1);
  });

  it("gibt nach einem Pasch einen weiteren Wurf", () => {
    let { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([2, 2])); // Feld 4: Steuer 100
    expect(player(state, "p1").money).toBe(1400);
    expect(state.turn.phase).toBe("preRoll");
    expect(state.turn.doublesCount).toBe(1);
    expectRejected(state, "p1", { type: "endTurn" }, "wrongPhase");
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 2]))); // Feld 7: Karte
    expect(state.turn.phase === "postRoll" || state.turn.phase === "buy").toBe(true);
  });

  it("schickt beim dritten Pasch sofort ins Gefängnis, ohne zu ziehen", () => {
    let state = cardOnTop(newGame(2), "community", "G16");
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 1]))); // Feld 2: Gemeindekarte +10
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 1]))); // Feld 4: Steuer 100
    expect(state.turn).toMatchObject({ phase: "preRoll", doublesCount: 2 });
    const result = act(state, "p1", { type: "rollDice" }, dice([4, 4]));
    expect(player(result.state, "p1")).toMatchObject({ position: 10, inJail: true, money: 1410 });
    expect(eventsOfType(result.events, "sentToJail")[0]).toMatchObject({ reason: "doubles", from: 4 });
    expect(eventsOfType(result.events, "moved")).toHaveLength(0);
    expect(result.state.turn.phase).toBe("postRoll");
    expectRejected(result.state, "p1", { type: "rollDice" }, "wrongPhase");
  });

  it("schickt beim Landen auf «Gehe ins Gefängnis» ins Gefängnis, ohne Start-Geld und ohne weiteren Wurf", () => {
    const state = placeAt(newGame(2), "p1", 26);
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([2, 2]));
    expect(player(after, "p1")).toMatchObject({ position: 10, inJail: true, money: 1500 });
    expect(after.turn.phase).toBe("postRoll");
  });

  it("lässt Besucher auf Feld 10 normal weiterspielen", () => {
    const state = placeAt(newGame(2), "p1", 4);
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([2, 4]));
    expect(player(after, "p1")).toMatchObject({ position: 10, inJail: false });
    expect(after.turn.phase).toBe("postRoll");
  });

  it("nennt die gültigen Aktionen", () => {
    const state = newGame(2);
    expect(getLegalActions(state, "p1").map((a) => a.type)).toEqual(["rollDice"]);
    expect(getLegalActions(state, "p2")).toEqual([]);
  });
});

describe("Kaufen und Versteigern", () => {
  it("kauft ein freies Feld zum Preis", () => {
    let { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([1, 2])); // Feld 3 Altstetten, 60
    expect(getLegalActions(state, "p1").map((a) => a.type)).toEqual(expect.arrayContaining(["buyProperty", "declineProperty"]));
    ({ state } = act(state, "p1", { type: "buyProperty" }));
    expect(state.properties[3]?.owner).toBe("p1");
    expect(player(state, "p1").money).toBe(1440);
    expect(state.turn.phase).toBe("postRoll");
  });

  it("kann nicht kaufen ohne genug Bargeld", () => {
    const state = placeAt(newGame(2), "p1", 35);
    player(state, "p1").money = 300;
    const { state: after } = act(state, "p1", { type: "rollDice" }, dice([1, 3])); // Feld 39, 400
    expectRejected(after, "p1", { type: "buyProperty" }, "notEnoughMoney");
  });

  it("nicht kaufen: das Feld bleibt frei, keine Versteigerung", () => {
    let { state, events } = act(newGame(3), "p1", { type: "rollDice" }, dice([2, 3])); // Feld 5 Hauptbahnhof
    ({ state, events } = act(state, "p1", { type: "declineProperty" }));
    expect(state.properties[5]?.owner).toBeNull();
    expect(eventsOfType(events, "propertyDeclined")).toEqual([{ type: "propertyDeclined", player: "p1", space: 5 }]);
    expect(player(state, "p1").money).toBe(1500);
    expect(state.turn.phase).toBe("postRoll");
    expect(getWaitingFor(state)).toBe("p1");
    // Der Nächste kann das Feld zum vollen Preis kaufen.
    ({ state } = act(state, "p1", { type: "endTurn" }));
    placeAt(state, "p2", 0);
    ({ state } = act(state, "p2", { type: "rollDice" }, dice([1, 4])));
    ({ state } = act(state, "p2", { type: "buyProperty" }));
    expect(state.properties[5]?.owner).toBe("p2");
    expect(player(state, "p2").money).toBe(1300);
  });

  it("nach einem Pasch geht es auch ohne Kauf mit dem nächsten Wurf weiter", () => {
    let { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([3, 3])); // Feld 6 Seebach
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    expect(state.properties[6]?.owner).toBeNull();
    expect(state.turn.phase).toBe("preRoll");
    expect(getWaitingFor(state)).toBe("p1");
  });
});
