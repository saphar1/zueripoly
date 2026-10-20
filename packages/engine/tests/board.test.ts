import { describe, expect, it } from "vitest";
import {
  BOARD,
  BOARD_SIZE,
  getSpace,
  GROUP_STREETS,
  isPropertySpace,
  mortgageInterest,
  PROPERTY_INDICES,
  type StreetSpace,
  unmortgageCost,
} from "../src";

describe("Brett", () => {
  it("hat 40 Felder mit fortlaufender Nummer", () => {
    expect(BOARD).toHaveLength(BOARD_SIZE);
    BOARD.forEach((space, i) => expect(space.index).toBe(i));
  });

  it("hat 22 Strassen, 4 Bahnhöfe, 2 Versorger und 12 Spezialfelder", () => {
    const count = (kind: string) => BOARD.filter((s) => s.kind === kind).length;
    expect(count("street")).toBe(22);
    expect(count("station")).toBe(4);
    expect(count("utility")).toBe(2);
    expect(BOARD.filter((s) => !isPropertySpace(s))).toHaveLength(12);
    expect(PROPERTY_INDICES).toHaveLength(28);
  });

  it("hat die Ecken und Spezialfelder am richtigen Ort", () => {
    expect(getSpace(0).kind).toBe("start");
    expect(getSpace(10).kind).toBe("jail");
    expect(getSpace(20).kind).toBe("vacation");
    expect(getSpace(30).kind).toBe("goToJail");
    expect([2, 17, 33].map((i) => getSpace(i).kind)).toEqual(["community", "community", "community"]);
    expect([7, 22, 36].map((i) => getSpace(i).kind)).toEqual(["event", "event", "event"]);
    expect([5, 15, 25, 35].map((i) => getSpace(i).name)).toEqual(["Hauptbahnhof", "Stadelhofen", "Oerlikon", "Hardbrücke"]);
    expect([12, 28].map((i) => getSpace(i).name)).toEqual(["Stromnetz", "Seewasserwerk"]);
    expect(getSpace(4)).toMatchObject({ kind: "tax", amount: 100 });
    expect(getSpace(38)).toMatchObject({ kind: "tax", amount: 50 });
  });

  it("hat die Farbgruppen in der richtigen Grösse", () => {
    expect(GROUP_STREETS).toEqual({
      brown: [1, 3],
      lightblue: [6, 8, 9],
      pink: [11, 13, 14],
      orange: [16, 18, 19],
      red: [21, 23, 24],
      yellow: [26, 27, 29],
      green: [31, 32, 34],
      navy: [37, 39],
    });
  });

  it("hat Hypothek = halber Preis, gleiche Hauspreise je Gruppe und steigende Mieten", () => {
    const streets = BOARD.filter((s): s is StreetSpace => s.kind === "street");
    const housePrice = { brown: 60, lightblue: 60, pink: 110, orange: 110, red: 160, yellow: 160, green: 220, navy: 220 };
    for (const s of streets) {
      expect(s.mortgage).toBe(s.price / 2);
      expect(s.housePrice).toBe(housePrice[s.group]);
      for (let i = 1; i < s.rents.length; i++) expect(s.rents[i]).toBeGreaterThan(s.rents[i - 1] ?? 0);
    }
    expect(BOARD.filter(isPropertySpace).filter((s) => s.kind !== "street").map((s) => s.mortgage)).toEqual([100, 75, 100, 100, 75, 100]);
  });

  it("stimmt bei einigen Stichproben mit docs/brett.md überein", () => {
    expect(getSpace(1)).toMatchObject({ name: "Albisrieden", price: 70, rents: [15, 90, 200, 345, 430, 500] });
    expect(getSpace(14)).toMatchObject({ name: "Höngg", price: 170, rents: [30, 150, 325, 560, 700, 810] });
    expect(getSpace(24)).toMatchObject({ name: "Rennweg", price: 250, rents: [45, 185, 400, 695, 865, 1005] });
    expect(getSpace(39)).toMatchObject({ name: "Bahnhofstrasse", price: 400, rents: [75, 240, 520, 900, 1120, 1300] });
  });

  it("hat nur runde Beträge und eine sinnvolle Mietstaffel (Balance 2026-10-20)", () => {
    for (const space of BOARD) {
      if (!isPropertySpace(space)) continue;
      expect(space.price % 5, space.name).toBe(0);
      expect(space.mortgage % 5, space.name).toBe(0);
      expect(mortgageInterest(space) % 5, space.name).toBe(0);
      expect(unmortgageCost(space) % 5, space.name).toBe(0);
      if (space.kind !== "street") continue;
      const [base, ...houses] = space.rents;
      for (const rent of space.rents) expect(rent % 5, space.name).toBe(0);
      // Grundmiete mindestens 15 % des Preises, erstes Haus mindestens 3 × Grundmiete, Staffel steigt.
      // Obergrenzen (Wunsch des Entwicklers 2026-10-20): 3 Häuser unter 1000 CHF, Hotel höchstens 1300 CHF.
      expect(base, space.name).toBeGreaterThanOrEqual(space.price * 0.15);
      expect(houses[0], space.name).toBeGreaterThanOrEqual(base * 3);
      expect(houses[2], space.name).toBeLessThan(1000);
      expect(houses[4], space.name).toBeLessThanOrEqual(1300);
      for (let i = 1; i < space.rents.length; i++) expect(space.rents[i]!, space.name).toBeGreaterThan(space.rents[i - 1]!);
    }
    // Eine teurere Strasse bringt auf keiner Stufe weniger Miete als die billigere davor.
    const streets = BOARD.filter((s): s is StreetSpace => s.kind === "street");
    for (let i = 1; i < streets.length; i++) {
      const [cheap, dear] = [streets[i - 1]!, streets[i]!];
      expect(dear.price).toBeGreaterThanOrEqual(cheap.price);
      dear.rents.forEach((rent, level) => expect(rent, `${dear.name} Stufe ${level}`).toBeGreaterThanOrEqual(cheap.rents[level]!));
    }
  });
});
