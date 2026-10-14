import { describe, expect, it } from "vitest";
import { canProposeTrade, getWaitingFor, type TradeProposal } from "../src";
import { act, dice, eventsOfType, expectRejected, newGame, own, player, setHouses } from "./helpers";

const side = (spaces: number[] = [], money = 0, jailCards: string[] = []) => ({ spaces, money, jailCards });

function offer(to: string, give = side(), take = side(), lift?: number[]): { type: "proposeTrade"; offer: TradeProposal } {
  return { type: "proposeTrade", offer: { to, give, take, ...(lift ? { lift } : {}) } };
}

describe("Handel", () => {
  it("tauscht Felder, Geld und Freikarten nach Zustimmung", () => {
    let state = own(own(newGame(3), "p1", 1), "p2", 3, 5);
    player(state, "p2").jailCards.push("E08");
    state.decks.event = state.decks.event.filter((c) => c !== "E08");
    ({ state } = act(state, "p1", offer("p2", side([1], 100), side([3, 5], 0, ["E08"]))));
    expect(getWaitingFor(state)).toBe("p2");
    expectRejected(state, "p1", { type: "rollDice" }, "tradeOpen");
    expectRejected(state, "p3", { type: "acceptTrade" }, "notYourTurn");
    expectRejected(state, "p1", { type: "acceptTrade" }, "notYourTurn");
    const { state: after, events } = act(state, "p2", { type: "acceptTrade" });
    expect(after.trade).toBeNull();
    expect([1, 3, 5].map((s) => after.properties[s]?.owner)).toEqual(["p2", "p1", "p1"]);
    expect(player(after, "p1")).toMatchObject({ money: 1400, jailCards: ["E08"] });
    expect(player(after, "p2")).toMatchObject({ money: 1600, jailCards: [] });
    expect(eventsOfType(events, "propertyTransferred")).toHaveLength(3);
    expect(getWaitingFor(after)).toBe("p1");
  });

  it("kann abgelehnt oder zurückgezogen werden", () => {
    let state = own(newGame(2), "p2", 3);
    ({ state } = act(state, "p1", offer("p2", side([], 50), side([3]))));
    const rejected = act(state, "p2", { type: "rejectTrade" });
    expect(rejected.state.trade).toBeNull();
    expect(rejected.state.properties[3]?.owner).toBe("p2");
    expectRejected(state, "p2", { type: "cancelTrade" }, "notYourTurn");
    const cancelled = act(state, "p1", { type: "cancelTrade" });
    expect(eventsOfType(cancelled.events, "tradeCancelled")).toHaveLength(1);
    expectRejected(cancelled.state, "p2", { type: "acceptTrade" }, "noTrade");
  });

  it("nur auf dem eigenen Zug", () => {
    const state = own(newGame(2), "p2", 3);
    expect(canProposeTrade(state, "p2")).toBe(false);
    expectRejected(state, "p2", offer("p1", side([3])), "notYourTurn");
  });

  it("lehnt ungültige Angebote ab", () => {
    const state = own(own(newGame(3), "p1", 1, 6, 8, 9), "p2", 3);
    expectRejected(state, "p1", offer("p2"), "emptyTrade");
    expectRejected(state, "p1", offer("p1", side([1])), "invalidTrade");
    expectRejected(state, "p1", offer("px", side([1])), "invalidTrade");
    expectRejected(state, "p1", offer("p2", side([3])), "notOwner");
    expectRejected(state, "p1", offer("p2", side([4])), "invalidSpace");
    expectRejected(state, "p1", offer("p2", side([], 2000)), "notEnoughMoney");
    expectRejected(state, "p1", offer("p2", side(), side([], 2000)), "partnerCannotPay");
    expectRejected(state, "p1", offer("p2", side([], 0, ["E08"])), "noJailCard");
    expectRejected(state, "p1", offer("p2", side([], -5)), "invalidTrade");
    expectRejected(state, "p1", offer("p2", side([1, 1])), "invalidTrade");
    setHouses(state, 9, 1);
    expectRejected(state, "p1", offer("p2", side([6])), "groupHasBuildings");
  });

  it("belastete Felder: Empfänger zahlt 10 % Zins oder löst sofort ab", () => {
    let state = own(own(newGame(2), "p1", 39), "p2", 37);
    state.properties[39]!.mortgaged = true; // Hypothek 200, Zins 20
    state.properties[37]!.mortgaged = true; // Hypothek 175, Zins 20 (aufgerundet auf 5)
    // p1 gibt 39, bekommt 37 und löst 37 sofort ab (175 + 20 = 195).
    ({ state } = act(state, "p1", offer("p2", side([39]), side([37]), [37])));
    const { state: after } = act(state, "p2", { type: "acceptTrade", lift: [] });
    expect(player(after, "p1").money).toBe(1500 - 195);
    expect(player(after, "p2").money).toBe(1500 - 20);
    expect(after.properties[37]).toMatchObject({ owner: "p1", mortgaged: false });
    expect(after.properties[39]).toMatchObject({ owner: "p2", mortgaged: true });
  });

  it("ein Handel darf keine Schulden erzeugen (Zins muss bezahlbar sein)", () => {
    let state = own(own(newGame(2), "p1", 39), "p2", 3);
    state.properties[39]!.mortgaged = true;
    player(state, "p2").money = 15;
    expectRejected(state, "p1", offer("p2", side([39]), side([3])), "partnerCannotPay");
    player(state, "p2").money = 20;
    ({ state } = act(state, "p1", offer("p2", side([39]), side([3]))));
    expectRejected(state, "p2", { type: "acceptTrade", lift: [39] }, "notEnoughMoney");
    expectRejected(state, "p2", { type: "acceptTrade", lift: [3] }, "invalidTrade");
    expect(player(act(state, "p2", { type: "acceptTrade", lift: [] }).state, "p2").money).toBe(0);
  });

  it("ist bei Schulden auch für den Schuldner möglich", () => {
    let state = own(own(newGame(2), "p1", 39), "p2", 37);
    state.current = 1;
    player(state, "p2").money = 10;
    player(state, "p2").position = 35;
    ({ state } = act(state, "p2", { type: "rollDice" }, dice([1, 3]))); // Miete 75 an p1
    expect(state.debts).toHaveLength(1);
    expect(canProposeTrade(state, "p2")).toBe(true);
    expect(canProposeTrade(state, "p1")).toBe(false);
    ({ state } = act(state, "p2", offer("p1", side([37]), side([], 200))));
    const { state: after } = act(state, "p1", { type: "acceptTrade" });
    expect(after.debts).toEqual([]);
    expect(player(after, "p2").money).toBe(10 + 200 - 75);
    expect(player(after, "p1").money).toBe(1500 - 200 + 75);
  });
});
