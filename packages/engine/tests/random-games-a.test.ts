import { describe, it } from "vitest";
import { playRandomGames } from "./random-play";

// Zwei Dateien, damit Vitest die 300 Partien parallel ausführen kann.
describe("Zufallspartien", () => {
  it("Partien 1–150 mit 2–6 Spielern laufen ohne Regelverstoss durch", () => playRandomGames(1, 150), 120_000);
});
