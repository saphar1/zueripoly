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
    ({ state } = act(state, "p2", { type: "passBid" }));
    ({ state } = act(state, "p3", { type: "passBid" }));
    ({ state } = act(state, "p1", { type: "passBid" }));
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
    let { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([2, 2])); // Feld 4: Steuer
    expect(player(state, "p1").money).toBe(1300);
    expect(state.turn.phase).toBe("preRoll");
    expect(state.turn.doublesCount).toBe(1);
    expectRejected(state, "p1", { type: "endTurn" }, "wrongPhase");
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 2]))); // Feld 7: Karte
    expect(state.turn.phase === "postRoll" || state.turn.phase === "buy").toBe(true);
  });

  it("schickt beim dritten Pasch sofort ins Gefängnis, ohne zu ziehen", () => {
    let state = cardOnTop(newGame(2), "community", "G16");
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 1]))); // Feld 2: Gemeindekarte +10
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 1]))); // Feld 4: Steuer 200
    expect(state.turn).toMatchObject({ phase: "preRoll", doublesCount: 2 });
    const result = act(state, "p1", { type: "rollDice" }, dice([4, 4]));
    expect(player(result.state, "p1")).toMatchObject({ position: 10, inJail: true, money: 1310 });
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

  it("versteigert ein abgelehntes Feld, links vom Spieler am Zug beginnend", () => {
    let { state } = act(newGame(3), "p1", { type: "rollDice" }, dice([2, 3])); // Feld 5 Hauptbahnhof
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    expect(state.auction).toMatchObject({ space: 5, bidders: ["p2", "p3", "p1"], next: 0 });
    expectRejected(state, "p1", { type: "bid", amount: 10 }, "notYourTurn");
    expectRejected(state, "p2", { type: "bid", amount: 5 }, "bidTooLow");
    expectRejected(state, "p2", { type: "bid", amount: 12.5 }, "invalidAmount");
    expectRejected(state, "p2", { type: "endTurn" }, "wrongPhase");
    ({ state } = act(state, "p2", { type: "bid", amount: 10 }));
    expectRejected(state, "p3", { type: "bid", amount: 15 }, "bidTooLow");
    ({ state } = act(state, "p3", { type: "bid", amount: 25 }));
    ({ state } = act(state, "p1", { type: "bid", amount: 40 }));
    ({ state } = act(state, "p2", { type: "passBid" }));
    expect(state.auction?.bidders).toEqual(["p3", "p1"]);
    const { state: done, events } = act(state, "p3", { type: "passBid" });
    expect(done.auction).toBeNull();
    expect(done.properties[5]?.owner).toBe("p1");
    expect(player(done, "p1").money).toBe(1460);
    expect(eventsOfType(events, "auctionWon")[0]).toMatchObject({ player: "p1", amount: 40 });
    expect(done.turn.phase).toBe("postRoll");
  });

  it("lässt den Bieter vorher Geld auftreiben, aber nicht mehr bieten als er hat", () => {
    let { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([1, 2]));
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    player(state, "p2").money = 20;
    state.properties[39]!.owner = "p2";
    expectRejected(state, "p2", { type: "bid", amount: 30 }, "notEnoughMoney");
    ({ state } = act(state, "p2", { type: "mortgage", space: 39 }));
    expect(player(state, "p2").money).toBe(220);
    ({ state } = act(state, "p2", { type: "bid", amount: 30 }));
    ({ state } = act(state, "p1", { type: "passBid" }));
    expect(state.properties[3]?.owner).toBe("p2");
  });

  it("lässt das Feld frei, wenn niemand bietet", () => {
    let { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([1, 2]));
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    ({ state } = act(state, "p2", { type: "passBid" }));
    const { state: done, events } = act(state, "p1", { type: "passBid" });
    expect(done.properties[3]?.owner).toBeNull();
    expect(eventsOfType(events, "auctionUnsold")).toHaveLength(1);
  });

  it("geht nach einer Versteigerung mit Pasch weiter zum nächsten Wurf", () => {
    let { state } = act(newGame(2), "p1", { type: "rollDice" }, dice([3, 3])); // Feld 6 Seebach
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    ({ state } = act(state, "p2", { type: "bid", amount: 10 }));
    ({ state } = act(state, "p1", { type: "passBid" }));
    expect(state.properties[6]?.owner).toBe("p2");
    expect(state.turn.phase).toBe("preRoll");
    expect(getWaitingFor(state)).toBe("p1");
  });

  it("gewinnt der letzte Bieter auch, wenn er als Einziger übrig bleibt und dann bietet", () => {
    let { state } = act(newGame(3), "p1", { type: "rollDice" }, dice([1, 2]));
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    ({ state } = act(state, "p2", { type: "passBid" }));
    ({ state } = act(state, "p3", { type: "passBid" }));
    expect(state.auction?.bidders).toEqual(["p1"]);
    ({ state } = act(state, "p1", { type: "bid", amount: 10 }));
    expect(state.properties[3]?.owner).toBe("p1");
    expect(player(state, "p1").money).toBe(1490);
  });
});
