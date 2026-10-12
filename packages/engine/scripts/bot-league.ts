// Bot-Liga: Viele Partien Bot gegen Bot, Ergebnis als Tabelle je Paarung.
// Start: npm run bots -w @zueripoly/engine   (optional: -- --games 200 --check)
// Zeigt, ob die Stufe «clever» die Stufe «einfach» wirklich öfter schlägt, und ob alle Partien enden.
import { BOT_LEVEL_NAMES, type BotLevel } from "../src";
import { playBotGame, type BotGameResult } from "../tests/bot-sim";

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const GAMES = option("games", 200);
const CHECK = args.includes("--check");

interface Matchup {
  title: string;
  levels: BotLevel[];
}

const MATCHUPS: Matchup[] = [
  { title: "einfach gegen einfach", levels: ["easy", "easy"] },
  { title: "clever gegen einfach", levels: ["clever", "easy"] },
  { title: "clever gegen clever", levels: ["clever", "clever"] },
  { title: "1 clever gegen 3 einfach", levels: ["clever", "easy", "easy", "easy"] },
  { title: "2 clever gegen 2 einfach", levels: ["clever", "easy", "clever", "easy"] },
  { title: "6 gemischt (3 + 3)", levels: ["clever", "easy", "clever", "easy", "clever", "easy"] },
];

/** Sitzplätze rotieren, damit niemand vom Platz profitiert. */
function rotate<T>(items: T[], by: number): T[] {
  const k = by % items.length;
  return [...items.slice(k), ...items.slice(0, k)];
}

const pad = (text: string | number, width: number) => String(text).padStart(width);
const percent = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((100 * part) / whole)} %`);

console.log(`Bot-Liga: ${GAMES} Partien je Paarung${CHECK ? ", mit Invariantenprüfung" : ""}\n`);
console.log(
  `${"Paarung".padEnd(26)}${pad("Partien", 8)}${pad("beendet", 9)}${pad("Siege clever", 14)}${pad("Siege einfach", 15)}` +
    `${pad("Ø Züge", 8)}${pad("max. Züge", 11)}${pad("Ø Handel", 10)}${pad("Zeit", 8)}`,
);

const started = Date.now();
for (const [m, matchup] of MATCHUPS.entries()) {
  const t0 = Date.now();
  const results: BotGameResult[] = [];
  for (let g = 0; g < GAMES; g++) {
    const seed = 100_000 * (m + 1) + g;
    results.push(playBotGame({ seed, levels: rotate(matchup.levels, g), check: CHECK }));
  }
  const finished = results.filter((r) => r.finished);
  const wins = (level: BotLevel) => finished.filter((r) => r.winnerLevel === level).length;
  const avg = (key: "turns" | "trades") => Math.round(results.reduce((s, r) => s + r[key], 0) / results.length);
  const seatsOf = (level: BotLevel) => matchup.levels.filter((l) => l === level).length;
  // Erwartungswert bei gleich starken Bots: Anteil der Sitzplätze dieser Stufe.
  const share = (level: BotLevel) => (seatsOf(level) === 0 ? "–" : `${percent(wins(level), finished.length)}`);
  console.log(
    `${matchup.title.padEnd(26)}${pad(results.length, 8)}${pad(finished.length, 9)}${pad(share("clever"), 14)}${pad(share("easy"), 15)}` +
      `${pad(avg("turns"), 8)}${pad(Math.max(...results.map((r) => r.turns)), 11)}${pad(avg("trades"), 10)}${pad(`${((Date.now() - t0) / 1000).toFixed(1)} s`, 8)}`,
  );
  const unfinished = results.filter((r) => !r.finished).map((r) => r.seed);
  if (unfinished.length > 0) console.log(`   nicht beendet: Seeds ${unfinished.join(", ")}`);
}
console.log(`\nStufen: ${Object.values(BOT_LEVEL_NAMES).join(", ")}. Gesamtzeit ${((Date.now() - started) / 1000).toFixed(1)} s.`);
