import { describe, expect, it } from "vitest";
import { chooseBotAction, createSeededRng, getCard, getLegalActions, type GameState } from "../src";
import { act, cardOnTop, dice, eventsOfType, expectRejected, newGame, own, placeAt, player, setHouses } from "./helpers";

/** p1 hält die Baubewilligung E06 (nicht mehr im Stapel). */
function withPermit(state: GameState): GameState {
  player(state, "p1").buildPermits.push("E06");
  state.decks.event = state.decks.event.filter((c) => c !== "E06");
  return state;
}

describe("Baubewilligung (E06)", () => {
  it("ist eine Ereigniskarte, die man behält", () => {
    expect(getCard("E06")).toMatchObject({ deck: "event", effect: { kind: "buildPermit" } });
    const state = cardOnTop(placeAt(newGame(2), "p1", 2), "event", "E06");
    const { state: after, events } = act(state, "p1", { type: "rollDice" }, dice([2, 3])); // Feld 7
    expect(eventsOfType(events, "cardDrawn")[0]?.card).toBe("E06");
    expect(player(after, "p1").buildPermits).toEqual(["E06"]);
    expect(after.decks.event).not.toContain("E06");
  });

  it("baut gratis ein Haus nach den normalen Bauregeln", () => {
    let state = withPermit(own(newGame(2), "p1", 1, 3));
    expect(getLegalActions(state, "p1").filter((a) => a.type === "useBuildPermit")).toEqual([
      { type: "useBuildPermit", space: 1 },
      { type: "useBuildPermit", space: 3 },
    ]);
    const { state: after, events } = act(state, "p1", { type: "useBuildPermit", space: 3 });
    state = after;
    expect(state.properties[3]?.houses).toBe(1);
    expect(player(state, "p1")).toMatchObject({ money: 1500, buildPermits: [] });
    expect(state.bank.houses).toBe(31);
    expect(state.decks.event.at(-1)).toBe("E06");
    expect(eventsOfType(events, "buildPermitUsed")).toEqual([{ type: "buildPermitUsed", player: "p1", card: "E06", space: 3 }]);
    expect(eventsOfType(events, "moneyTransferred")).toEqual([]);
    // Gleichmässig bauen gilt auch hier: Die Karte ist verbraucht, und Altstetten ist schon höher.
    expectRejected(state, "p1", { type: "useBuildPermit", space: 1 }, "noBuildPermit");
  });

  it("geht auch ohne Bargeld, aber nur mit ganzer, unbelasteter Gruppe und gleichmässig", () => {
    const state = withPermit(own(newGame(2), "p1", 1, 3, 6));
    player(state, "p1").money = 0;
    expectRejected(state, "p1", { type: "buildHouse", space: 1 }, "notEnoughMoney");
    expectRejected(state, "p1", { type: "useBuildPermit", space: 6 }, "groupIncomplete");
    setHouses(state, 1, 1);
    expectRejected(state, "p1", { type: "useBuildPermit", space: 1 }, "unevenBuilding");
    expect(act(state, "p1", { type: "useBuildPermit", space: 3 }).state.properties[3]?.houses).toBe(1);
    state.properties[1]!.houses = 0;
    state.bank.houses = 32;
    state.properties[3]!.mortgaged = true;
    expectRejected(state, "p1", { type: "useBuildPermit", space: 1 }, "groupMortgaged");
  });

  it("baut ein Hotel, wenn alle Strassen der Gruppe 4 Häuser haben", () => {
    const state = withPermit(own(newGame(2), "p1", 1, 3));
    setHouses(state, 1, 4);
    setHouses(state, 3, 4);
    const { state: after } = act(state, "p1", { type: "useBuildPermit", space: 1 });
    expect(after.properties[1]?.houses).toBe(5);
    expect(after.bank).toMatchObject({ hotels: 11, houses: 32 - 8 + 4 });
  });

  it("geht nicht, wenn die Bank keine Häuser mehr hat", () => {
    const state = withPermit(own(newGame(2), "p1", 1, 3));
    state.bank.houses = 0;
    expectRejected(state, "p1", { type: "useBuildPermit", space: 1 }, "noHousesLeft");
  });

  it("geht bei einem Bankrott unter den Stapel, auch wenn ein Mitspieler Gläubiger ist", () => {
    const start = withPermit(own(newGame(3), "p2", 39));
    setHouses(own(start, "p2", 37), 39, 5);
    setHouses(start, 37, 4);
    player(start, "p1").money = 0;
    placeAt(start, "p1", 35);
    let { state } = act(start, "p1", { type: "rollDice" }, dice([1, 3])); // Bahnhofstrasse mit Hotel
    const { state: after, events } = act(state, "p1", { type: "declareBankruptcy" });
    state = after;
    expect(player(state, "p1")).toMatchObject({ bankrupt: true, buildPermits: [] });
    expect(player(state, "p2").buildPermits).toEqual([]);
    expect(state.decks.event.at(-1)).toBe("E06");
    expect(eventsOfType(events, "buildPermitReturned")).toEqual([{ type: "buildPermitReturned", card: "E06", from: "p1" }]);
  });

  it("wird von Computergegnern sofort eingesetzt", () => {
    for (const level of ["easy", "clever"] as const) {
      const state = withPermit(own(newGame(2), "p1", 1, 3));
      player(state, "p1").bot = level;
      const action = chooseBotAction(state, "p1", createSeededRng(1));
      expect(action.type).toBe("useBuildPermit");
    }
  });
});
