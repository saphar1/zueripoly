import { describe, expect, it } from "vitest";
import {
  checkInvariants,
  createGame,
  createSeededRng,
  getWaitingFor,
  validateGameConfig,
  type GameConfig,
  type PlayerConfig,
  type Rng,
} from "../src";

const four: PlayerConfig[] = [
  { id: "a", name: "Anna", token: "tram" },
  { id: "b", name: "Beat", token: "swan" },
  { id: "c", name: "Chiara", token: "boeoegg", bot: "easy" },
  { id: "d", name: "Dario", token: "bike" },
];

describe("Spiel erstellen", () => {
  it("startet mit Standardoptionen, 1500 CHF und 32/12 Gebäuden", () => {
    const state = createGame({ players: four }, createSeededRng(1));
    expect(state.options).toEqual({ startMoney: 1500, jackpot: false, turnTimeLimit: null });
    expect(state.players.every((p) => p.money === 1500 && p.position === 0 && !p.inJail)).toBe(true);
    expect(state.bank).toEqual({ houses: 32, hotels: 12 });
    expect(state.decks.event).toHaveLength(16);
    expect(state.decks.community).toHaveLength(16);
    expect(state.turn.phase).toBe("preRoll");
    expect(state.players.find((p) => p.id === "c")?.bot).toBe("easy");
    expect(checkInvariants(state)).toEqual([]);
    expect(getWaitingFor(state)).toBe(state.players[0]?.id);
  });

  it("übernimmt Optionen aus der Lobby", () => {
    const state = createGame({ players: four, options: { startMoney: 2500, jackpot: true, turnTimeLimit: 60 } }, createSeededRng(1));
    expect(state.players.every((p) => p.money === 2500)).toBe(true);
    expect(state.options).toEqual({ startMoney: 2500, jackpot: true, turnTimeLimit: 60 });
  });

  it("würfelt die Reihenfolge aus und spielt danach im Uhrzeigersinn", () => {
    // a: 3, b: 11, c: 7, d: 5 → b beginnt, dann c, d, a.
    const state = createGame({ players: four }, scriptedStart([1, 2], [5, 6], [3, 4], [1, 4]));
    expect(state.players.map((p) => p.id)).toEqual(["b", "c", "d", "a"]);
    expect(state.log[0]).toMatchObject({ type: "startOrderRolled", round: 1 });
  });

  it("würfelt bei Gleichstand nur unter den Gleichen neu", () => {
    // Runde 1: a 10, b 4, c 10, d 10. Runde 2: a 6, c 9, d 9. Runde 3: c 3, d 12 → d beginnt.
    const state = createGame(
      { players: four },
      scriptedStart([4, 6], [2, 2], [5, 5], [6, 4], [3, 3], [4, 5], [6, 3], [1, 2], [6, 6]),
    );
    expect(state.players.map((p) => p.id)).toEqual(["d", "a", "b", "c"]);
    const rounds = state.log.filter((e) => e.type === "startOrderRolled");
    expect(rounds).toHaveLength(3);
    expect(rounds[1]).toMatchObject({ rolls: [{ player: "a" }, { player: "c" }, { player: "d" }] });
  });

  it("lehnt ungültige Einstellungen ab", () => {
    const base = (patch: Partial<GameConfig>): GameConfig => ({ players: four, ...patch });
    expect(validateGameConfig(base({ players: four.slice(0, 1) }))).toMatch(/2 bis 6/);
    expect(validateGameConfig(base({ players: [...four, ...four.slice(0, 3).map((p, i) => ({ ...p, id: `x${i}`, token: "coffee" as const }))] }))).not.toBeNull();
    expect(validateGameConfig(base({ players: [four[0]!, { ...four[1]!, token: "tram" }] }))).toMatch(/Figur/);
    expect(validateGameConfig(base({ players: [four[0]!, { ...four[1]!, id: "a" }] }))).toMatch(/eindeutig/);
    expect(validateGameConfig(base({ players: [four[0]!, { ...four[1]!, id: "bank" }] }))).toMatch(/reserviert/);
    expect(validateGameConfig(base({ players: [four[0]!, { ...four[1]!, name: "  " }] }))).toMatch(/Namen/);
    expect(validateGameConfig(base({ options: { startMoney: 450 } }))).toMatch(/Startkapital/);
    expect(validateGameConfig(base({ options: { startMoney: 1550 } }))).toMatch(/Startkapital/);
    expect(validateGameConfig(base({ options: { startMoney: 5100 } }))).toMatch(/Startkapital/);
    expect(validateGameConfig(base({ options: { turnTimeLimit: 45 as 30 } }))).toMatch(/Zeitlimit/);
    expect(validateGameConfig(base({ options: { startMoney: 500, turnTimeLimit: 90 } }))).toBeNull();
    expect(() => createGame(base({ players: [] }), createSeededRng(1))).toThrow();
  });

  it("erlaubt 2 bis 6 Spieler", () => {
    const six: PlayerConfig[] = (["tram", "swan", "boeoegg", "fondue", "bike", "coffee"] as const).map((token, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      token,
    }));
    for (let n = 2; n <= 6; n++) {
      const state = createGame({ players: six.slice(0, n) }, createSeededRng(n));
      expect(state.players).toHaveLength(n);
      expect(checkInvariants(state)).toEqual([]);
    }
  });
});

/** Würfe für die Startreihenfolge aus dem Drehbuch, alles andere (Mischen) aus einem festen Seed. */
function scriptedStart(...rolls: [number, number][]): Rng {
  const script = rolls.flatMap(([a, b]) => [a - 1, b - 1]);
  const fallback = createSeededRng(1);
  return {
    nextInt(max: number): number {
      const value = max === 6 ? script.shift() : undefined;
      return value ?? fallback.nextInt(max);
    },
  };
}
