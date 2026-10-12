import { describe, expect, it } from "vitest";
import { duelSetup, playBotGame } from "./bot-sim";

// 100 Zweikämpfe «clever» gegen «einfach» (Sitzplatz abwechselnd). Alle müssen enden,
// und die clevere Stufe muss klar öfter gewinnen.
describe("Bot-Partien (Zweikampf)", () => {
  it("clever schlägt einfach in mindestens 70 % der Zweikämpfe", () => {
    const results = Array.from({ length: 100 }, (_, i) => playBotGame(duelSetup(i + 1)));
    const unfinished = results.filter((r) => !r.finished).map((r) => r.seed);
    const clever = results.filter((r) => r.winnerLevel === "clever").length;
    console.log(`Zweikämpfe clever gegen einfach: clever gewinnt ${clever} von ${results.length}, längste Partie ${Math.max(...results.map((r) => r.turns))} Züge`);
    expect(unfinished).toEqual([]);
    expect(clever).toBeGreaterThanOrEqual(70);
  }, 120_000);
});
