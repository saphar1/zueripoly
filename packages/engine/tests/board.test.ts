import { describe, expect, it } from "vitest";
import {
  BOARD,
  BOARD_SIZE,
  getSpace,
  GROUP_STREETS,
  isPropertySpace,
  PROPERTY_INDICES,
  type StreetSpace,
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
    expect(getSpace(4)).toMatchObject({ kind: "tax", amount: 200 });
    expect(getSpace(38)).toMatchObject({ kind: "tax", amount: 100 });
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
    const housePrice = { brown: 50, lightblue: 50, pink: 100, orange: 100, red: 150, yellow: 150, green: 200, navy: 200 };
    for (const s of streets) {
      expect(s.mortgage).toBe(s.price / 2);
      expect(s.housePrice).toBe(housePrice[s.group]);
      for (let i = 1; i < s.rents.length; i++) expect(s.rents[i]).toBeGreaterThan(s.rents[i - 1] ?? 0);
    }
    expect(BOARD.filter(isPropertySpace).filter((s) => s.kind !== "street").map((s) => s.mortgage)).toEqual([100, 75, 100, 100, 75, 100]);
  });

  it("stimmt bei einigen Stichproben mit docs/brett.md überein", () => {
    expect(getSpace(1)).toMatchObject({ name: "Albisrieden", price: 60, rents: [2, 10, 30, 90, 160, 250] });
    expect(getSpace(14)).toMatchObject({ name: "Höngg", price: 160, rents: [12, 60, 180, 500, 700, 900] });
    expect(getSpace(24)).toMatchObject({ name: "Rennweg", price: 240, rents: [20, 100, 300, 750, 925, 1100] });
    expect(getSpace(39)).toMatchObject({ name: "Bahnhofstrasse", price: 400, rents: [50, 200, 600, 1400, 1700, 2000] });
  });
});
