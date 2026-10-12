// Bot-gegen-Bot-Partien: nur Computergegner, jede Aktion über applyAction wie bei Menschen.
// Ohne Vitest, damit auch das Skript scripts/bot-league.ts die Schleife nutzen kann.
import {
  applyAction,
  BOT_NAMES,
  checkInvariants,
  checkMoneyLog,
  chooseBotAction,
  createGame,
  createSeededRng,
  getWaitingFor,
  TOKENS,
  validateAction,
  type BotLevel,
  type GameEvent,
  type GameOptions,
  type PlayerId,
} from "../src";

export interface BotGameSetup {
  seed: number;
  /** Stufe je Sitzplatz (2 bis 6 Bots). */
  levels: BotLevel[];
  options?: Partial<GameOptions>;
  /** Invarianten nach jeder Aktion prüfen (langsamer). */
  check?: boolean;
  /** Abbruch nach so vielen Aktionen (dann gilt die Partie als nicht beendet). */
  maxSteps?: number;
}

export interface BotGameResult {
  seed: number;
  finished: boolean;
  winner: PlayerId | null;
  winnerLevel: BotLevel | null;
  steps: number;
  turns: number;
  trades: number;
  proposals: number;
  bankruptcies: number;
  hotels: number;
}

export const DEFAULT_MAX_STEPS = 20_000;

/** Spielt eine ganze Partie. Wirft einen Fehler bei ungültiger Bot-Aktion, verletzter Invariante oder falschem Geld-Protokoll. */
export function playBotGame(setup: BotGameSetup): BotGameResult {
  const { seed, levels } = setup;
  const gameRng = createSeededRng(seed * 7919 + 1);
  const botRng = createSeededRng(seed * 104729 + 17);
  const players = levels.map((level, i) => ({
    id: `b${i + 1}`,
    name: BOT_NAMES[i] ?? `Bot ${i + 1}`,
    token: TOKENS[i] ?? "tram",
    bot: level,
  }));
  let state = createGame({ players, options: setup.options }, gameRng);
  const events: GameEvent[] = [...state.log];
  const maxSteps = setup.maxSteps ?? DEFAULT_MAX_STEPS;
  let steps = 0;

  while (state.winner === null && steps < maxSteps) {
    const waiting = getWaitingFor(state);
    if (waiting === null) throw new Error(`Seed ${seed}: niemand an der Reihe, aber kein Gewinner.`);
    const action = chooseBotAction(state, waiting, botRng);
    const error = validateAction(state, waiting, action);
    if (error) {
      throw new Error(`Seed ${seed}, Schritt ${steps}: ${waiting} wählt ungültig ${JSON.stringify(action)} (${error.code}).`);
    }
    if (action.type === "timeout") throw new Error(`Seed ${seed}, Schritt ${steps}: ${waiting} braucht das Sicherheitsnetz (timeout).`);
    const result = applyAction(state, waiting, action, gameRng);
    if (!result.ok) throw new Error(`Seed ${seed}, Schritt ${steps}: ${JSON.stringify(action)} abgelehnt (${result.error.code}).`);
    state = result.state;
    events.push(...result.events);
    steps++;
    if (setup.check) {
      const problems = checkInvariants(state);
      if (problems.length > 0) throw new Error(`Seed ${seed}, Schritt ${steps}: ${problems.join(" | ")}`);
    }
  }

  const moneyProblems = checkMoneyLog(state, events);
  if (moneyProblems.length > 0) throw new Error(`Seed ${seed}: ${moneyProblems.join(" | ")}`);
  const winner = state.winner;
  return {
    seed,
    finished: winner !== null,
    winner,
    winnerLevel: winner ? (state.players.find((p) => p.id === winner)?.bot ?? null) : null,
    steps,
    turns: state.turnNumber,
    trades: events.filter((e) => e.type === "tradeAccepted").length,
    proposals: events.filter((e) => e.type === "tradeProposed").length,
    bankruptcies: events.filter((e) => e.type === "bankrupt").length,
    hotels: events.filter((e) => e.type === "houseBuilt" && e.level === 5).length,
  };
}

/** Gemischte Partie aus einem Seed: 2–6 Bots, Stufen, Startkapital und Topf wechseln. */
export function mixedSetup(seed: number): BotGameSetup {
  const rng = createSeededRng(seed * 31 + 5);
  const count = 2 + (seed % 5);
  const levels = Array.from({ length: count }, (): BotLevel => (rng.nextInt(2) === 0 ? "easy" : "clever"));
  const startMoney = [1500, 1000, 1500, 2000, 800][seed % 5] ?? 1500;
  return { seed, levels, options: { startMoney, jackpot: seed % 3 === 0 }, check: true };
}

/** Zweikampf clever gegen einfach; der Sitzplatz wechselt mit dem Seed. */
export function duelSetup(seed: number): BotGameSetup {
  const levels: BotLevel[] = seed % 2 === 0 ? ["clever", "easy"] : ["easy", "clever"];
  return { seed, levels, check: true };
}
