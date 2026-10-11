import { describe, expect, it } from "vitest";
import { calculateRent } from "../src";
import { act, dice, eventsOfType, newGame, own, placeAt, player, setHouses } from "./helpers";

/** p2 landet mit dem Wurf auf dem Feld; Rückgabe: bezahlte Miete an p1. */
function rentPaid(state: ReturnType<typeof newGame>, from: number, roll: [number, number]) {
  state.current = 1;
  placeAt(state, "p2", from);
  const { state: after, events } = act(state, "p2", { type: "rollDice" }, dice(roll));
  const rent = eventsOfType(events, "moneyTransferred").find((e) => e.reason === "rent");
  if (rent) {
    expect(rent.from).toBe("p2");
    expect(rent.to).toBe("p1");
  }
  return { amount: rent?.amount ?? 0, after };
}

describe("Miete", () => {
  it("Strasse ohne Haus: Grundmiete", () => {
    const state = own(newGame(2), "p1", 39);
    expect(rentPaid(state, 35, [1, 3]).amount).toBe(50);
  });

  it("ganze Farbgruppe ohne Häuser: doppelte Miete", () => {
    const state = own(newGame(2), "p1", 37, 39);
    expect(rentPaid(state, 35, [1, 3]).amount).toBe(100);
  });

  it("keine Verdopplung, wenn eine Strasse der Gruppe belastet ist", () => {
    const state = own(newGame(2), "p1", 37, 39);
    state.properties[37]!.mortgaged = true;
    expect(rentPaid(state, 35, [1, 3]).amount).toBe(50);
  });

  it("belastetes Feld bringt keine Miete", () => {
    const state = own(newGame(2), "p1", 39);
    state.properties[39]!.mortgaged = true;
    const { amount, after } = rentPaid(state, 35, [1, 3]);
    expect(amount).toBe(0);
    expect(player(after, "p2").money).toBe(1500);
  });

  it("Häuser und Hotel nach Mietstaffel", () => {
    for (const [level, expected] of [
      [1, 200],
      [2, 600],
      [3, 1400],
      [4, 1700],
      [5, 2000],
    ] as const) {
      const state = own(newGame(2), "p1", 37, 39);
      setHouses(state, 37, level === 5 ? 4 : level);
      setHouses(state, 39, level);
      player(state, "p2").money = 5000;
      expect(rentPaid(state, 35, [1, 3]).amount).toBe(expected);
    }
  });

  it("unbebaute Strasse behält die Verdopplung, wenn eine andere der Gruppe bebaut ist", () => {
    const state = own(newGame(2), "p1", 6, 8, 9);
    setHouses(state, 9, 1);
    expect(calculateRent(state, 6, 0)).toBe(12);
    expect(calculateRent(state, 9, 0)).toBe(40);
  });

  it("Bahnhöfe: 25 / 50 / 100 / 200", () => {
    const stations = [5, 15, 25, 35];
    for (let n = 1; n <= 4; n++) {
      const state = own(newGame(2), "p1", ...stations.slice(0, n));
      expect(rentPaid(state, 1, [2, 2]).amount).toBe([25, 50, 100, 200][n - 1]);
    }
  });

  it("Versorger: 4 × bzw. 10 × die Augensumme", () => {
    const one = own(newGame(2), "p1", 12);
    expect(rentPaid(one, 7, [2, 3]).amount).toBe(20);
    const both = own(newGame(2), "p1", 12, 28);
    expect(rentPaid(both, 7, [2, 3]).amount).toBe(50);
  });

  it("eigenes Feld: keine Miete", () => {
    const state = own(newGame(2), "p2", 39);
    expect(rentPaid(state, 35, [1, 3]).amount).toBe(0);
  });

  it("Besitzer im Gefängnis erhält trotzdem Miete", () => {
    const state = own(newGame(2), "p1", 39);
    placeAt(state, "p1", 10).players[0]!.inJail = true;
    expect(rentPaid(state, 35, [1, 3]).amount).toBe(50);
  });
});
