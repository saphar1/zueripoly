import { describe, it } from "vitest";
import { playRandomGames } from "./random-play";

// Zwei Dateien, damit Vitest die 300 Partien parallel ausführen kann.
describe("Zufallspartien", () => {
  it("Partien 151–300 mit 2–6 Spielern laufen ohne Regelverstoss durch", () => playRandomGames(151, 300), 120_000);
});
