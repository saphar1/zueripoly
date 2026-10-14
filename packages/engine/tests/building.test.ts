import { describe, expect, it } from "vitest";
import { getLegalActions, type GameState } from "../src";
import { act, dice, eventsOfType, expectRejected, newGame, own, player, setHouses } from "./helpers";

/** p1 besitzt Hellblau (6, 8, 9) und ist am Zug (vor dem Würfeln). */
function lightblue(): GameState {
  return own(newGame(2), "p1", 6, 8, 9);
}

function levels(state: GameState, ...spaces: number[]) {
  return spaces.map((s) => state.properties[s]?.houses);
}

describe("Bauen", () => {
  it("braucht die ganze Farbgruppe", () => {
    const state = own(newGame(2), "p1", 6, 8);
    expectRejected(state, "p1", { type: "buildHouse", space: 6 }, "groupIncomplete");
    expectRejected(state, "p1", { type: "buildHouse", space: 5 }, "invalidSpace");
    expectRejected(state, "p1", { type: "buildHouse", space: 9 }, "notOwner");
  });

  it("geht nicht, wenn eine Strasse der Gruppe belastet ist", () => {
    const state = lightblue();
    state.properties[9]!.mortgaged = true;
    expectRejected(state, "p1", { type: "buildHouse", space: 6 }, "groupMortgaged");
  });

  it("baut gleichmässig und kostet den Hauspreis", () => {
    let state = lightblue();
    ({ state } = act(state, "p1", { type: "buildHouse", space: 6 }));
    expect(player(state, "p1").money).toBe(1450);
    expect(state.bank.houses).toBe(31);
    expectRejected(state, "p1", { type: "buildHouse", space: 6 }, "unevenBuilding");
    ({ state } = act(state, "p1", { type: "buildHouse", space: 8 }));
    ({ state } = act(state, "p1", { type: "buildHouse", space: 9 }));
    ({ state } = act(state, "p1", { type: "buildHouse", space: 6 }));
    expect(levels(state, 6, 8, 9)).toEqual([2, 1, 1]);
  });

  it("ein Hotel braucht 4 Häuser auf allen Strassen und gibt die 4 Häuser zurück", () => {
    let state = lightblue();
    setHouses(state, 6, 4);
    setHouses(state, 8, 4);
    setHouses(state, 9, 3);
    expectRejected(state, "p1", { type: "buildHouse", space: 6 }, "unevenBuilding");
    ({ state } = act(state, "p1", { type: "buildHouse", space: 9 }));
    expect(state.bank.houses).toBe(32 - 12);
    const { state: after, events } = act(state, "p1", { type: "buildHouse", space: 6 });
    expect(levels(after, 6, 8, 9)).toEqual([5, 4, 4]);
    expect(after.bank).toEqual({ houses: 32 - 8, hotels: 11 });
    expect(eventsOfType(events, "houseBuilt")[0]?.level).toBe(5);
    expectRejected(setHouses(setHouses(after, 8, 5), 9, 5), "p1", { type: "buildHouse", space: 6 }, "maxBuildings");
  });

  it("geht nicht ohne Häuser oder Hotels in der Bank (32 / 12)", () => {
    const state = lightblue();
    state.bank.houses = 0;
    expectRejected(state, "p1", { type: "buildHouse", space: 6 }, "noHousesLeft");
    const hotels = lightblue();
    for (const s of [6, 8, 9]) setHouses(hotels, s, 4);
    hotels.bank.hotels = 0;
    expectRejected(hotels, "p1", { type: "buildHouse", space: 6 }, "noHotelsLeft");
    expect(getLegalActions(hotels, "p1").some((a) => a.type === "buildHouse")).toBe(false);
  });

  it("geht nicht ohne genug Bargeld", () => {
    const state = lightblue();
    player(state, "p1").money = 40;
    expectRejected(state, "p1", { type: "buildHouse", space: 6 }, "notEnoughMoney");
  });

  it("geht vor und nach dem Würfeln, aber nicht im Zug eines anderen", () => {
    let state = lightblue();
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([5, 6]))); // Feld 11: Kaufentscheid
    ({ state } = act(state, "p1", { type: "buildHouse", space: 6 }));
    ({ state } = act(state, "p1", { type: "buyProperty" }));
    ({ state } = act(state, "p1", { type: "buildHouse", space: 8 }));
    ({ state } = act(state, "p1", { type: "endTurn" }));
    expectRejected(state, "p1", { type: "buildHouse", space: 9 }, "notYourTurn");
  });
});

describe("Gebäude verkaufen", () => {
  it("bringt den halben Hauspreis und geht gleichmässig von oben", () => {
    let state = lightblue();
    setHouses(state, 6, 2);
    setHouses(state, 8, 1);
    setHouses(state, 9, 1);
    expectRejected(state, "p1", { type: "sellBuilding", space: 8 }, "unevenBuilding");
    ({ state } = act(state, "p1", { type: "sellBuilding", space: 6 }));
    expect(player(state, "p1").money).toBe(1525);
    expect(state.bank.houses).toBe(32 - 3);
    expectRejected(lightblue(), "p1", { type: "sellBuilding", space: 6 }, "noBuildings");
  });

  it("baut ein Hotel zu 4 Häusern zurück, wenn die Bank 4 Häuser hat", () => {
    let state = lightblue();
    for (const s of [6, 8, 9]) setHouses(state, s, 5);
    ({ state } = act(state, "p1", { type: "sellBuilding", space: 9 }));
    expect(levels(state, 6, 8, 9)).toEqual([5, 5, 4]);
    expect(state.bank).toEqual({ houses: 28, hotels: 10 });
    expect(player(state, "p1").money).toBe(1525);
  });

  it("reisst ein Hotel ganz ab, wenn die Bank keine 4 Häuser hat (Wert von 5 Bauten)", () => {
    let state = lightblue();
    for (const s of [6, 8, 9]) setHouses(state, s, 5);
    // Häuser der Bank anderswo verbauen: Pink und Orange (je 3 × 4) plus Braun (2 × 4) = 32.
    own(state, "p2", 11, 13, 14, 16, 18, 19, 1, 3);
    for (const s of [11, 13, 14, 16, 18, 19, 1, 3]) setHouses(state, s, 4);
    expect(state.bank.houses).toBe(0);
    const { state: after, events } = act(state, "p1", { type: "sellBuilding", space: 9 });
    expect(levels(after, 6, 8, 9)).toEqual([5, 5, 0]);
    expect(after.bank).toEqual({ houses: 0, hotels: 10 });
    expect(player(after, "p1").money).toBe(1500 + 125);
    expect(eventsOfType(events, "buildingSold")[0]).toMatchObject({ fromLevel: 5, toLevel: 0 });
  });
});

describe("Hypotheken", () => {
  it("bringt den Hypothekenwert und kostet beim Zurückzahlen 10 % Zins (aufgerundet auf 5 CHF)", () => {
    let state = own(newGame(2), "p1", 12);
    ({ state } = act(state, "p1", { type: "mortgage", space: 12 }));
    expect(player(state, "p1").money).toBe(1575);
    expect(state.properties[12]?.mortgaged).toBe(true);
    expectRejected(state, "p1", { type: "mortgage", space: 12 }, "alreadyMortgaged");
    ({ state } = act(state, "p1", { type: "unmortgage", space: 12 }));
    expect(player(state, "p1").money).toBe(1575 - 85); // 75 + 10 % (aufgerundet auf 5)
    expectRejected(state, "p1", { type: "unmortgage", space: 12 }, "notMortgaged");
  });

  it("verlangt, dass alle Gebäude der Gruppe vorher verkauft sind", () => {
    const state = lightblue();
    setHouses(state, 9, 1);
    expectRejected(state, "p1", { type: "mortgage", space: 6 }, "groupHasBuildings");
  });

  it("Zurückzahlen braucht genug Bargeld", () => {
    const state = own(newGame(2), "p1", 39);
    state.properties[39]!.mortgaged = true;
    player(state, "p1").money = 219;
    expectRejected(state, "p1", { type: "unmortgage", space: 39 }, "notEnoughMoney");
    player(state, "p1").money = 220;
    expect(act(state, "p1", { type: "unmortgage", space: 39 }).state.properties[39]?.mortgaged).toBe(false);
  });
});
