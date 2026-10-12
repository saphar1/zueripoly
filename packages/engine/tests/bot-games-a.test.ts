import { describe, expect, it } from "vitest";
import { mixedSetup, playBotGame } from "./bot-sim";

// 100 gemischte Partien: 2–6 Bots, beide Stufen, verschiedenes Startkapital, mit und ohne Topf.
// Jede Aktion muss gültig sein, nach jeder Aktion gelten die Invarianten, und jede Partie endet mit Gewinner.
describe("Bot-Partien (gemischt)", () => {
  it("100 Partien mit 2–6 Bots enden ohne ungültigen Zug mit Gewinner", () => {
    const results = Array.from({ length: 100 }, (_, i) => playBotGame(mixedSetup(i + 1)));
    const unfinished = results.filter((r) => !r.finished).map((r) => r.seed);
    const total = (key: "steps" | "trades" | "bankruptcies" | "hotels") => results.reduce((sum, r) => sum + r[key], 0);
    console.log(
      `Bot-Partien gemischt: ${results.length - unfinished.length}/${results.length} mit Gewinner, ${total("steps")} Aktionen, ` +
        `${total("trades")} Handel, ${total("bankruptcies")} Bankrotte, ${total("hotels")} Hotels, längste Partie ${Math.max(...results.map((r) => r.turns))} Züge`,
    );
    expect(unfinished).toEqual([]);
    expect(total("trades")).toBeGreaterThan(0);
    expect(total("hotels")).toBeGreaterThan(0);
  }, 120_000);
});
