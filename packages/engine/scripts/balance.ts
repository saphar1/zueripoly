// Balance-Messung: Viele Bot-Partien, ausgewertet nach Mieten und Spielverlauf.
// Start: npm run balance -w @zueripoly/engine   (optional: -- --games 200 --players 4)
// Zeigt, wie lange Partien dauern, wann gebaut wird und wie hoch die Mieten je Stufe ausfallen.
// Gedacht zum Vergleichen von Varianten der Tabelle in board.ts (docs/bots.md, Abschnitt Balance-Versuche).
import {
  applyAction,
  BOARD,
  BOT_NAMES,
  chooseBotAction,
  createGame,
  createSeededRng,
  getWaitingFor,
  TOKENS,
  type BotLevel,
  type GameState,
} from "../src";

const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const GAMES = option("games", 200);
const PLAYERS = Math.min(6, Math.max(2, option("players", 4)));
const MAX_STEPS = 20_000;

interface Bucket {
  count: number;
  sum: number;
  max: number;
}
const buckets = new Map<string, Bucket>();
function add(key: string, amount: number): void {
  const bucket = buckets.get(key) ?? { count: 0, sum: 0, max: 0 };
  bucket.count += 1;
  bucket.sum += amount;
  bucket.max = Math.max(bucket.max, amount);
  buckets.set(key, bucket);
}

let finished = 0;
let rents = 0;
let bigRents = 0;
const turns: number[] = [];
const firstHouse: number[] = [];
const bankruptAt: number[] = [];
const average = (values: number[]) => (values.length === 0 ? 0 : Math.round(values.reduce((s, v) => s + v, 0) / values.length));

const started = Date.now();
for (let game = 0; game < GAMES; game++) {
  // Gemischt: abwechselnd clever und einfach, Sitzplätze je Partie verschoben.
  const levels: BotLevel[] = Array.from({ length: PLAYERS }, (_, i) => ((i + game) % 2 === 0 ? "clever" : "easy"));
  const rng = createSeededRng(game * 7919 + 1);
  const botRng = createSeededRng(game * 104729 + 17);
  const players = levels.map((bot, i) => ({ id: `b${i + 1}`, name: BOT_NAMES[i] ?? `Bot ${i + 1}`, token: TOKENS[i] ?? "tram", bot }));
  let state: GameState = createGame({ players }, rng);
  let houseTurn = 0;
  for (let step = 0; step < MAX_STEPS && state.winner === null; step++) {
    const who = getWaitingFor(state);
    if (!who) break;
    const before = state;
    const result = applyAction(state, who, chooseBotAction(state, who, botRng), rng);
    if (!result.ok) throw new Error(`Partie ${game}: ${result.error.message}`);
    state = result.state;
    for (const event of result.events) {
      if (event.type === "moneyTransferred" && event.reason === "rent" && event.space !== undefined && event.space !== null) {
        const space = BOARD[event.space]!;
        const level = space.kind === "street" ? `${before.properties[event.space]?.houses ?? 0}` : space.kind;
        add(level, event.amount);
        rents += 1;
        if (event.amount >= 1000) bigRents += 1;
      } else if (event.type === "houseBuilt" && houseTurn === 0) {
        houseTurn = state.turnNumber;
      } else if (event.type === "bankrupt") {
        bankruptAt.push(state.turnNumber);
      }
    }
  }
  if (state.winner !== null) finished += 1;
  turns.push(state.turnNumber);
  if (houseTurn > 0) firstHouse.push(houseTurn);
}

const pad = (text: string | number, width: number) => String(text).padStart(width);
const LABELS: Record<string, string> = {
  "0": "ohne Haus",
  "1": "1 Haus",
  "2": "2 Häuser",
  "3": "3 Häuser",
  "4": "4 Häuser",
  "5": "Hotel",
  station: "Bahnhof",
  utility: "Versorger",
};
console.log(`Balance: ${GAMES} Partien mit ${PLAYERS} Bots (clever und einfach gemischt), ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
console.log(`Beendet:          ${finished} von ${GAMES}`);
const sorted = [...turns].sort((x, y) => x - y);
console.log(`Ø Züge:           ${average(turns)} (Median ${sorted[Math.floor(sorted.length / 2)]}, 90 % unter ${sorted[Math.floor(sorted.length * 0.9)]}, max. ${sorted[sorted.length - 1]})`);
console.log(`Erstes Haus:      Ø Zug ${average(firstHouse)} (in ${firstHouse.length} Partien)`);
console.log(`Bankrott:         Ø Zug ${average(bankruptAt)}`);
console.log(`Mieten ≥ 1000:    ${bigRents} von ${rents} (${((100 * bigRents) / Math.max(1, rents)).toFixed(1)} %)\n`);
console.log(`${"Miete".padEnd(12)}${pad("Anzahl", 8)}${pad("Ø CHF", 8)}${pad("max.", 8)}`);
for (const key of Object.keys(LABELS)) {
  const bucket = buckets.get(key);
  if (!bucket) continue;
  console.log(`${LABELS[key]!.padEnd(12)}${pad(bucket.count, 8)}${pad(Math.round(bucket.sum / bucket.count), 8)}${pad(bucket.max, 8)}`);
}
