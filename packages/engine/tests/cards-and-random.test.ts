import { describe, expect, it } from "vitest";
import {
  COMMUNITY_CARDS,
  createSeededRng,
  EVENT_CARDS,
  getCard,
  rollDice,
  shuffle,
} from "../src";

describe("Karten", () => {
  it("hat 16 Ereignis- und 16 Gemeindekarten mit eindeutigen IDs", () => {
    expect(EVENT_CARDS).toHaveLength(16);
    expect(COMMUNITY_CARDS).toHaveLength(16);
    const ids = [...EVENT_CARDS, ...COMMUNITY_CARDS].map((c) => c.id);
    expect(new Set(ids).size).toBe(32);
    expect(EVENT_CARDS.every((c) => c.deck === "event" && c.id.startsWith("E"))).toBe(true);
    expect(COMMUNITY_CARDS.every((c) => c.deck === "community" && c.id.startsWith("G"))).toBe(true);
  });

  it("hat genau eine Freikarte je Stapel (E08, G05)", () => {
    const free = [...EVENT_CARDS, ...COMMUNITY_CARDS].filter((c) => c.effect.kind === "getOutOfJailFree");
    expect(free.map((c) => c.id)).toEqual(["E08", "G05"]);
  });

  it("hat Texte in Schweizer Schreibweise (kein ß)", () => {
    for (const card of [...EVENT_CARDS, ...COMMUNITY_CARDS]) {
      expect(card.text).not.toContain("ß");
      expect(card.text.length).toBeGreaterThan(10);
    }
  });

  it("findet Karten über die ID", () => {
    expect(getCard("E09").effect).toEqual({ kind: "moveBy", steps: -3 });
    expect(() => getCard("X99")).toThrow();
  });
});

describe("Zufallsquelle", () => {
  it("liefert mit gleichem Seed die gleiche Folge", () => {
    const a = createSeededRng(123);
    const b = createSeededRng(123);
    const seqA = Array.from({ length: 50 }, () => a.nextInt(1000));
    const seqB = Array.from({ length: 50 }, () => b.nextInt(1000));
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(40);
  });

  it("macht nach dem Wiederherstellen des Zustands genau gleich weiter", () => {
    const a = createSeededRng(99);
    a.nextInt(6);
    a.nextInt(6);
    const b = createSeededRng(a.getState());
    expect(Array.from({ length: 20 }, () => a.nextInt(6))).toEqual(Array.from({ length: 20 }, () => b.nextInt(6)));
  });

  it("würfelt nur 1 bis 6 und jede Zahl kommt vor", () => {
    const rng = createSeededRng(5);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) {
      for (const d of rollDice(rng)) counts[d] = (counts[d] ?? 0) + 1;
    }
    expect(counts[0]).toBe(0);
    for (let face = 1; face <= 6; face++) {
      expect(counts[face]).toBeGreaterThan(1800);
      expect(counts[face]).toBeLessThan(2200);
    }
  });

  it("mischt eine Kopie, ohne Karten zu verlieren", () => {
    const items = EVENT_CARDS.map((c) => c.id);
    const shuffled = shuffle(items, createSeededRng(1));
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(items[0]).toBe("E01");
    expect(shuffle(items, createSeededRng(1))).toEqual(shuffled);
  });

  it("lehnt ungültige Obergrenzen ab", () => {
    expect(() => createSeededRng(1).nextInt(0)).toThrow();
  });
});
