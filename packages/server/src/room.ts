// Ein Raum: Lobby und laufendes Spiel. Der Raum ist die einzige Wahrheit über den Spielstand.
// - Lobby: Plätze p1–p6 mit Name, Figur (jede nur einmal), bereit; der Host stellt Optionen ein und füllt mit Bots.
// - Spiel: Jede Aktion läuft über `applyAction` der Engine, immer für den Platz der Verbindung, nie für eine
//   ID aus der Nachricht. Würfel und Mischen kommen aus der Zufallsquelle des Raums.
// - Bots, Vertretung abwesender Spieler und das Zeitlimit laufen hier, mit Pausen wie im Browser.
// - Anwesenheit: getrennt, wieder da, ausgestiegen; nach `absentMs` entscheidet der Host. Host-Wechsel.
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type {
  Action,
  ActionResult,
  BotLevel,
  GameConfig,
  GameEvent,
  GameOptions,
  GameState,
  PlayerId,
  Rng,
  SeededRng,
  TokenId,
} from "@zueripoly/engine";
import {
  BOT_NAMES,
  DEFAULT_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TOKENS,
  applyAction,
  chooseBotAction,
  createGame,
  createSeededRng,
  getWaitingFor,
  removePlayer,
  validateGameConfig,
} from "@zueripoly/engine";
import { botPauseMs, playbackMs } from "./pace";
import type { AbsentDecision, GameUpdate, Reply, RoomPhase, RoomSnapshot, SeatGrant, SeatInfo, TurnClock } from "./protocol";

/** Zeiten des Raums. Die Tests setzen kurze Werte ein. */
export interface Timing {
  /** So lange darf jemand getrennt sein, bevor der Host entscheidet (und ein abwesender Host abgelöst wird). */
  absentMs: number;
  /** Leere Lobby (niemand verbunden) wird nach dieser Zeit gelöscht. */
  emptyLobbyMs: number;
  /** Leeres Spiel wird nach dieser Zeit gelöscht. */
  emptyGameMs: number;
  /** Faktor für Denkpausen der Bots (0 = sofort). */
  botScale: number;
  /** Faktor für die Abspielzeit im Browser (0 = nicht abwarten). */
  playbackScale: number;
  /** Zuschlag aufs Zeitlimit für die Übertragung (ms). */
  latencyMs: number;
  /** So oft wird nach leeren Räumen gesucht. */
  sweepMs: number;
}

export const DEFAULT_TIMING: Timing = {
  absentMs: 60_000,
  emptyLobbyMs: 5 * 60_000,
  emptyGameMs: 10 * 60_000,
  botScale: 1,
  playbackScale: 1,
  latencyMs: 500,
  sweepMs: 30_000,
};

/** Wohin der Raum Nachrichten schickt (vom Server verdrahtet, in Tests austauschbar). */
export interface RoomOutput {
  emit(socketId: string, event: "room:state" | "game:update" | "game:clock", payload: unknown): void;
  /** Verbindung vom Raum lösen und ihr den Grund mitteilen («room:closed»). */
  release(socketId: string, reason: string): void;
  log(message: string): void;
}

/** Stufe, mit der ein Computer für einen abwesenden Menschen spielt. */
const STAND_IN_LEVEL: BotLevel = "clever";
const SEAT_IDS: readonly PlayerId[] = ["p1", "p2", "p3", "p4", "p5", "p6"];

interface Seat {
  id: PlayerId;
  name: string;
  token: TokenId;
  bot: BotLevel | null;
  /** Geheimer Schlüssel zum Wiederverbinden (nur Menschen). */
  key: string | null;
  socketId: string | null;
  ready: boolean;
  /** Zeitpunkt der Trennung (ms), null = verbunden oder Bot. */
  awaySince: number | null;
  left: boolean;
  standIn: BotLevel | null;
  /** Ab wann der Host entscheiden soll (ms), null = nicht nötig. */
  askAt: number | null;
}

interface Game {
  state: GameState;
  rng: SeededRng;
  botRng: Rng;
  seq: number;
  lastEvents: GameEvent[];
}

type Result<T extends object = object> = Reply<T>;
const ok = <T extends object>(data: T = {} as T): Result<T> => ({ ok: true, ...data });
const fail = (error: string): Result<never> => ({ ok: false, error });

function randomSeed(): number {
  return randomInt(0, 2 ** 32);
}

function sameKey(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Spielstand für die Browser: Die Reihenfolge der Kartenstapel bleibt geheim (sortiert, Anzahl stimmt). */
export function publicState(state: GameState): GameState {
  return { ...state, decks: { event: [...state.decks.event].sort(), community: [...state.decks.community].sort() } };
}

export class Room {
  private phase: RoomPhase = "lobby";
  private seats: Seat[] = [];
  private hostId: PlayerId | null = null;
  private options: GameOptions = { ...DEFAULT_OPTIONS };
  private game: Game | null = null;
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private clock: TurnClock | null = null;
  /** Seit wann niemand mehr verbunden ist (für das Aufräumen). */
  emptySince: number | null = null;

  constructor(
    readonly code: string,
    private readonly timing: Timing,
    private readonly out: RoomOutput,
  ) {}

  // ---------------------------------------------------------------------------
  // Abfragen
  // ---------------------------------------------------------------------------

  get currentPhase(): RoomPhase {
    return this.phase;
  }

  /** Ist mindestens ein Mensch verbunden? */
  hasConnectedHuman(): boolean {
    return this.seats.some((s) => s.bot === null && s.socketId !== null);
  }

  /** Gibt es keinen Menschen mehr (alle haben die Lobby verlassen)? */
  hasNoHumans(): boolean {
    return !this.seats.some((s) => s.bot === null && !s.left);
  }

  /** Nach dieser Zeit ohne verbundene Menschen wird der Raum gelöscht. */
  emptyLimitMs(): number {
    return this.phase === "lobby" ? this.timing.emptyLobbyMs : this.timing.emptyGameMs;
  }

  private seatBySocket(socketId: string): Seat | undefined {
    return this.seats.find((s) => s.socketId === socketId);
  }

  private seatById(id: PlayerId): Seat | undefined {
    return this.seats.find((s) => s.id === id);
  }

  private isHost(seat: Seat): boolean {
    return seat.id === this.hostId;
  }

  private needsDecision(seat: Seat, now: number): boolean {
    if (this.phase !== "game" || !this.game || this.game.state.winner !== null) return false;
    if (seat.bot !== null || seat.socketId !== null || seat.standIn !== null) return false;
    if (this.game.state.players.find((p) => p.id === seat.id)?.bankrupt) return false;
    return seat.askAt !== null && seat.askAt <= now;
  }

  private snapshotFor(you: PlayerId, now: number): RoomSnapshot {
    const seats: SeatInfo[] = this.seats.map((s) => ({
      id: s.id,
      name: s.name,
      token: s.token,
      bot: s.bot,
      ready: s.bot !== null || s.ready,
      connected: s.bot !== null || s.socketId !== null,
      awayMs: s.awaySince === null ? null : now - s.awaySince,
      left: s.left,
      standIn: s.standIn,
      needsDecision: this.needsDecision(s, now),
    }));
    return { code: this.code, phase: this.phase, hostId: this.hostId, seats, options: { ...this.options }, you };
  }

  // ---------------------------------------------------------------------------
  // Senden
  // ---------------------------------------------------------------------------

  private connectedSeats(): Seat[] {
    return this.seats.filter((s) => s.socketId !== null);
  }

  private broadcastRoom(): void {
    const now = Date.now();
    for (const seat of this.connectedSeats()) this.out.emit(seat.socketId!, "room:state", this.snapshotFor(seat.id, now));
  }

  private sendSync(seat: Seat): void {
    if (!this.game || seat.socketId === null) return;
    const update: GameUpdate = { seq: this.game.seq, state: publicState(this.game.state), events: [], sync: true };
    this.out.emit(seat.socketId, "game:update", update);
    this.out.emit(seat.socketId, "game:clock", this.clockNow());
  }

  private broadcastUpdate(events: GameEvent[]): void {
    if (!this.game) return;
    const update: GameUpdate = { seq: this.game.seq, state: publicState(this.game.state), events, sync: false };
    for (const seat of this.connectedSeats()) this.out.emit(seat.socketId!, "game:update", update);
  }

  private clockNow(): TurnClock | null {
    if (!this.clock) return null;
    return { ...this.clock, ms: Math.max(0, this.clockDeadline - Date.now()) };
  }

  private clockDeadline = 0;

  private broadcastClock(): void {
    const clock = this.clockNow();
    for (const seat of this.connectedSeats()) this.out.emit(seat.socketId!, "game:clock", clock);
  }

  // ---------------------------------------------------------------------------
  // Sitzplätze
  // ---------------------------------------------------------------------------

  private nameTaken(name: string, except?: Seat): boolean {
    const wanted = name.toLocaleLowerCase("de-CH");
    return this.seats.some((s) => s !== except && !s.left && s.name.toLocaleLowerCase("de-CH") === wanted);
  }

  private freeToken(): TokenId | undefined {
    return TOKENS.find((t) => !this.seats.some((s) => s.token === t));
  }

  private freeSeatId(): PlayerId | undefined {
    return SEAT_IDS.find((id) => !this.seats.some((s) => s.id === id));
  }

  private grant(seat: Seat): SeatGrant {
    return { code: this.code, seatKey: seat.key!, seatId: seat.id };
  }

  /** Neuer Mensch in der Lobby. Der erste wird Host. */
  addHuman(socketId: string, name: string): Result<SeatGrant> {
    if (this.phase !== "lobby") return fail("Das Spiel in diesem Raum läuft schon. Beitreten geht nur in der Lobby.");
    if (this.seats.length >= MAX_PLAYERS) return fail(`Der Raum ist voll (${MAX_PLAYERS} Plätze).`);
    if (this.nameTaken(name)) return fail(`Den Namen «${name}» gibt es in diesem Raum schon.`);
    const id = this.freeSeatId();
    const token = this.freeToken();
    if (!id || !token) return fail("Der Raum ist voll.");
    const seat: Seat = {
      id,
      name,
      token,
      bot: null,
      key: randomBytes(18).toString("base64url"),
      socketId,
      ready: false,
      awaySince: null,
      left: false,
      standIn: null,
      askAt: null,
    };
    this.seats.push(seat);
    if (this.hostId === null) this.hostId = seat.id;
    this.emptySince = null;
    this.broadcastRoom();
    return ok(this.grant(seat));
  }

  /** Mit dem Sitzplatz-Schlüssel zurück auf den eigenen Platz (Lobby oder Spiel). */
  resume(socketId: string, key: string): Result<SeatGrant> {
    const seat = this.seats.find((s) => s.key !== null && sameKey(s.key, key));
    if (!seat) return fail("Diesen Platz gibt es nicht mehr. Tritt mit dem Raumcode neu bei.");
    // Sitzt diese Verbindung schon auf einem anderen Platz im Raum, gilt dieser als getrennt.
    const other = this.seatBySocket(socketId);
    if (other && other !== seat) {
      other.socketId = null;
      other.awaySince = Date.now();
      other.askAt = this.phase === "game" ? other.awaySince + this.timing.absentMs : null;
    }
    const previous = seat.socketId;
    if (previous !== null && previous !== socketId) {
      seat.socketId = null;
      this.out.release(previous, "Dein Platz ist jetzt in einem anderen Fenster offen.");
    }
    seat.socketId = socketId;
    seat.awaySince = null;
    seat.askAt = null;
    if (seat.standIn !== null) {
      seat.standIn = null;
      this.out.log(`Raum ${this.code}: ${seat.name} ist zurück und spielt wieder selbst.`);
    }
    this.emptySince = null;
    this.broadcastRoom();
    this.sendSync(seat);
    if (this.phase === "game") this.scheduleStep();
    this.schedulePresence();
    return ok(this.grant(seat));
  }

  /** Verbindung weg (Netz, Fenster zu). Der Platz bleibt reserviert. */
  disconnect(socketId: string): void {
    const seat = this.seatBySocket(socketId);
    if (!seat) return;
    seat.socketId = null;
    seat.awaySince = Date.now();
    seat.askAt = this.phase === "game" ? seat.awaySince + this.timing.absentMs : null;
    this.afterPresenceChange();
  }

  /** Ausdrücklich verlassen. In der Lobby verschwindet der Platz, im Spiel entscheidet der Host. */
  leave(socketId: string): Result {
    const seat = this.seatBySocket(socketId);
    if (!seat) return fail("Du bist in keinem Raum.");
    const wasHost = this.isHost(seat);
    this.out.release(socketId, "Du hast den Raum verlassen.");
    if (this.phase === "lobby") {
      this.seats = this.seats.filter((s) => s !== seat);
    } else {
      seat.socketId = null;
      seat.key = null;
      seat.left = true;
      seat.awaySince = Date.now();
      seat.askAt = seat.awaySince;
    }
    if (wasHost) this.hostId = this.nextHost(seat);
    this.afterPresenceChange();
    return ok();
  }

  private afterPresenceChange(): void {
    this.passHostIfAway();
    this.emptySince = this.hasConnectedHuman() ? null : (this.emptySince ?? Date.now());
    this.broadcastRoom();
    if (this.phase === "game") this.scheduleStep();
    this.schedulePresence();
  }

  /** Nächster Host: der nächste Mensch nach `current` in Sitzordnung, wenn möglich ein verbundener. */
  private nextHost(current?: Seat): PlayerId | null {
    const index = current ? this.seats.indexOf(current) : -1;
    const ordered = index < 0 ? this.seats : [...this.seats.slice(index + 1), ...this.seats.slice(0, index + 1)];
    const humans = ordered.filter((s) => s.bot === null && !s.left && s !== current);
    return (humans.find((s) => s.socketId !== null) ?? humans[0])?.id ?? null;
  }

  /** Ist der Host länger weg, übernimmt jemand, der verbunden ist. */
  private passHostIfAway(): void {
    const host = this.hostId ? this.seatById(this.hostId) : undefined;
    if (!host) {
      this.hostId = this.nextHost(undefined);
      return;
    }
    if (host.socketId !== null || host.awaySince === null) return;
    if (Date.now() - host.awaySince < this.timing.absentMs) return;
    const next = this.nextHost(host);
    const nextSeat = next ? this.seatById(next) : undefined;
    if (nextSeat && nextSeat.socketId !== null) {
      this.hostId = nextSeat.id;
      this.out.log(`Raum ${this.code}: ${host.name} ist weg, neuer Host ist ${nextSeat.name}.`);
    }
  }

  /** Zeitgesteuerte Anwesenheit: Host-Ablösung und «Host soll entscheiden» rechtzeitig melden. */
  private schedulePresence(): void {
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    this.presenceTimer = null;
    const now = Date.now();
    const times: number[] = [];
    for (const seat of this.seats) {
      if (seat.askAt !== null && seat.askAt > now && seat.standIn === null) times.push(seat.askAt);
      if (seat.id === this.hostId && seat.awaySince !== null) {
        const due = seat.awaySince + this.timing.absentMs;
        if (due > now) times.push(due);
      }
    }
    if (times.length === 0) return;
    this.presenceTimer = setTimeout(() => this.guard(() => this.afterPresenceChange()), Math.min(...times) - now + 5);
  }

  // ---------------------------------------------------------------------------
  // Lobby
  // ---------------------------------------------------------------------------

  private hostSeat(socketId: string): Seat | Result<never> {
    const seat = this.seatBySocket(socketId);
    if (!seat) return fail("Du bist in keinem Raum.");
    if (!this.isHost(seat)) return fail("Das darf nur der Host.");
    return seat;
  }

  private inLobby(): Result<never> | null {
    return this.phase === "lobby" ? null : fail("Das geht nur in der Lobby.");
  }

  updateSeat(socketId: string, change: { name?: string; token?: TokenId; ready?: boolean }): Result {
    const seat = this.seatBySocket(socketId);
    if (!seat) return fail("Du bist in keinem Raum.");
    const notLobby = this.inLobby();
    if (notLobby) return notLobby;
    if (change.name !== undefined) {
      if (this.nameTaken(change.name, seat)) return fail(`Den Namen «${change.name}» gibt es in diesem Raum schon.`);
      seat.name = change.name;
    }
    if (change.token !== undefined && change.token !== seat.token) {
      if (this.seats.some((s) => s !== seat && s.token === change.token)) return fail("Diese Figur hat schon jemand.");
      seat.token = change.token;
    }
    if (change.ready !== undefined) seat.ready = change.ready;
    this.broadcastRoom();
    return ok();
  }

  setOptions(socketId: string, options: Partial<GameOptions>): Result {
    const host = this.hostSeat(socketId);
    if ("ok" in host) return host;
    const notLobby = this.inLobby();
    if (notLobby) return notLobby;
    this.options = { ...this.options, ...options };
    this.broadcastRoom();
    return ok();
  }

  addBot(socketId: string, level: BotLevel): Result {
    const host = this.hostSeat(socketId);
    if ("ok" in host) return host;
    const notLobby = this.inLobby();
    if (notLobby) return notLobby;
    const id = this.freeSeatId();
    const token = this.freeToken();
    if (!id || !token || this.seats.length >= MAX_PLAYERS) return fail(`Der Raum ist voll (${MAX_PLAYERS} Plätze).`);
    const free = BOT_NAMES.filter((n) => !this.nameTaken(n));
    const name = free[randomInt(Math.max(1, free.length))] ?? `Computer ${id.slice(1)}`;
    this.seats.push({ id, name, token, bot: level, key: null, socketId: null, ready: true, awaySince: null, left: false, standIn: null, askAt: null });
    this.broadcastRoom();
    return ok();
  }

  setBotLevel(socketId: string, seatId: PlayerId, level: BotLevel): Result {
    const host = this.hostSeat(socketId);
    if ("ok" in host) return host;
    const notLobby = this.inLobby();
    if (notLobby) return notLobby;
    const seat = this.seatById(seatId);
    if (!seat || seat.bot === null) return fail("Diesen Computergegner gibt es nicht.");
    seat.bot = level;
    this.broadcastRoom();
    return ok();
  }

  removeSeat(socketId: string, seatId: PlayerId): Result {
    const host = this.hostSeat(socketId);
    if ("ok" in host) return host;
    const notLobby = this.inLobby();
    if (notLobby) return notLobby;
    const seat = this.seatById(seatId);
    if (!seat) return fail("Diesen Platz gibt es nicht.");
    if (seat === host) return fail("Den eigenen Platz kannst du nicht entfernen. Verlasse den Raum stattdessen.");
    if (seat.socketId !== null) this.out.release(seat.socketId, "Der Host hat dich aus dem Raum genommen.");
    this.seats = this.seats.filter((s) => s !== seat);
    this.broadcastRoom();
    return ok();
  }

  /** Warum das Spiel noch nicht starten kann (oder null). */
  private startProblem(): string | null {
    if (this.seats.length < MIN_PLAYERS) return `Es braucht mindestens ${MIN_PLAYERS} Plätze. Lade jemanden ein oder nimm einen Computergegner dazu.`;
    const away = this.seats.find((s) => s.bot === null && s.socketId === null);
    if (away) return `${away.name} ist nicht verbunden. Warten oder Platz entfernen.`;
    const waiting = this.seats.filter((s) => s.bot === null && !s.ready && s.id !== this.hostId);
    if (waiting.length > 0) return `Noch nicht bereit: ${waiting.map((s) => s.name).join(", ")}.`;
    return null;
  }

  start(socketId: string): Result {
    const host = this.hostSeat(socketId);
    if ("ok" in host) return host;
    const notLobby = this.inLobby();
    if (notLobby) return notLobby;
    const problem = this.startProblem();
    if (problem) return fail(problem);
    const config: GameConfig = {
      players: this.seats.map((s) => ({ id: s.id, name: s.name, token: s.token, bot: s.bot })),
      options: this.options,
    };
    const invalid = validateGameConfig(config);
    if (invalid) return fail(invalid);
    const rng = createSeededRng(randomSeed());
    const state = createGame(config, rng);
    this.game = { state, rng, botRng: createSeededRng(randomSeed()), seq: 1, lastEvents: state.log };
    this.phase = "game";
    for (const seat of this.seats) {
      seat.standIn = null;
      seat.askAt = null;
    }
    this.out.log(`Raum ${this.code}: Spiel gestartet (${this.seats.map((s) => s.name).join(", ")}).`);
    this.broadcastRoom();
    for (const seat of this.connectedSeats()) this.sendSync(seat);
    this.scheduleStep();
    return ok();
  }

  /** Nach Spielende: alle zurück in die Lobby (gleiche Plätze, Ausgestiegene fallen weg). */
  backToLobby(socketId: string): Result {
    const host = this.hostSeat(socketId);
    if ("ok" in host) return host;
    if (this.phase !== "game" || !this.game || this.game.state.winner === null) return fail("Das geht erst, wenn das Spiel zu Ende ist.");
    this.stopTimers();
    this.game = null;
    this.phase = "lobby";
    this.seats = this.seats.filter((s) => !s.left);
    for (const seat of this.seats) {
      seat.ready = seat.bot !== null;
      seat.standIn = null;
      seat.askAt = null;
    }
    this.broadcastRoom();
    return ok();
  }

  // ---------------------------------------------------------------------------
  // Spiel
  // ---------------------------------------------------------------------------

  /** Spielzug eines Menschen: immer für den eigenen Platz, geprüft von der Engine. */
  act(socketId: string, action: Action): Result {
    const seat = this.seatBySocket(socketId);
    if (!seat) return fail("Du bist in keinem Raum.");
    if (this.phase !== "game" || !this.game) return fail("Das Spiel hat noch nicht begonnen.");
    const result = applyAction(this.game.state, seat.id, action, this.game.rng);
    if (!result.ok) return fail(result.error.message);
    this.commit(result);
    return ok();
  }

  sync(socketId: string): Result {
    const seat = this.seatBySocket(socketId);
    if (!seat) return fail("Du bist in keinem Raum.");
    if (!this.game) return fail("Das Spiel hat noch nicht begonnen.");
    this.sendSync(seat);
    return ok();
  }

  /** Entscheid des Hosts für einen getrennten oder ausgestiegenen Platz. */
  decideAbsent(socketId: string, seatId: PlayerId, decision: AbsentDecision): Result {
    const host = this.hostSeat(socketId);
    if ("ok" in host) return host;
    if (this.phase !== "game" || !this.game || this.game.state.winner !== null) return fail("Das Spiel läuft nicht.");
    const seat = this.seatById(seatId);
    if (!seat || seat.bot !== null) return fail("Diesen Platz gibt es nicht.");
    if (seat.socketId !== null) return fail(`${seat.name} ist wieder verbunden.`);
    if (this.game.state.players.find((p) => p.id === seat.id)?.bankrupt) return fail(`${seat.name} ist schon ausgeschieden.`);
    switch (decision) {
      case "wait":
        if (seat.left) return fail(`${seat.name} hat das Spiel verlassen und kommt nicht zurück.`);
        seat.askAt = Date.now() + this.timing.absentMs;
        this.out.log(`Raum ${this.code}: Host wartet auf ${seat.name}.`);
        break;
      case "bot":
        seat.standIn = STAND_IN_LEVEL;
        seat.askAt = null;
        this.out.log(`Raum ${this.code}: Computer übernimmt für ${seat.name}.`);
        break;
      case "remove": {
        const result = removePlayer(this.game.state, seat.id);
        if (!result.ok) return fail(result.error.message);
        seat.standIn = null;
        seat.askAt = null;
        this.out.log(`Raum ${this.code}: ${seat.name} aus dem Spiel genommen.`);
        this.commit(result);
        break;
      }
    }
    this.broadcastRoom();
    this.scheduleStep();
    this.schedulePresence();
    return ok();
  }

  private commit(result: Extract<ActionResult, { ok: true }>): void {
    const game = this.game!;
    game.state = result.state;
    game.seq += 1;
    game.lastEvents = result.events;
    this.broadcastUpdate(result.events);
    if (result.state.winner !== null) {
      const winner = result.state.players.find((p) => p.id === result.state.winner);
      this.out.log(`Raum ${this.code}: ${winner?.name ?? "?"} gewinnt.`);
      this.broadcastRoom();
    }
    this.scheduleStep();
  }

  /** Spielen noch Menschen selbst mit (nicht ausgeschieden, nicht vertreten)? Sonst Zeitraffer. */
  private humansPlaying(state: GameState): boolean {
    return this.seats.some((s) => s.bot === null && s.standIn === null && s.socketId !== null && !state.players.find((p) => p.id === s.id)?.bankrupt);
  }

  /**
   * Nächsten Schritt planen: Bot oder Vertretung ziehen lassen, oder die Uhr für einen Menschen starten.
   * Sind alle Menschen getrennt, ruht das Spiel.
   */
  private scheduleStep(): void {
    if (this.stepTimer) clearTimeout(this.stepTimer);
    this.stepTimer = null;
    const hadClock = this.clock !== null;
    this.clock = null;
    const game = this.game;
    const finish = () => {
      if (hadClock || this.clock) this.broadcastClock();
    };
    if (this.phase !== "game" || !game || game.state.winner !== null || !this.hasConnectedHuman()) return finish();
    const waiting = getWaitingFor(game.state);
    const seat = waiting ? this.seatById(waiting) : undefined;
    if (!seat) return finish();
    const playback = playbackMs(game.lastEvents) * this.timing.playbackScale;

    const level = seat.standIn ?? seat.bot;
    if (level !== null) {
      let action: Action;
      try {
        action = chooseBotAction(game.state, seat.id, game.botRng, level);
      } catch (error) {
        this.out.log(`Raum ${this.code}: Bot ${seat.id} ohne Entscheid (${String(error)}), Standardschritt.`);
        action = { type: "timeout" };
      }
      const delay = playback + botPauseMs(action, game.lastEvents, this.humansPlaying(game.state)) * this.timing.botScale;
      this.stepTimer = setTimeout(() => this.guard(() => this.runBot(seat, action)), delay);
      return finish();
    }

    const limit = game.state.options.turnTimeLimit;
    if (limit !== null) {
      const limitMs = limit * 1000;
      const ms = limitMs + playback + this.timing.latencyMs;
      this.clock = { seq: game.seq, ms, limitMs };
      this.clockDeadline = Date.now() + ms;
      this.stepTimer = setTimeout(() => this.guard(() => this.runTimeout(seat.id)), ms);
    }
    finish();
  }

  private runBot(seat: Seat, action: Action): void {
    const game = this.game;
    if (!game || getWaitingFor(game.state) !== seat.id) return;
    let result = applyAction(game.state, seat.id, action, game.rng);
    if (!result.ok) {
      // Darf nicht vorkommen (die Engine-Tests prüfen jede Bot-Aktion). Dann den Standardschritt nehmen.
      this.out.log(`Raum ${this.code}: Bot-Aktion ${action.type} von ${seat.id} abgelehnt (${result.error.code}), Standardschritt.`);
      result = applyAction(game.state, seat.id, { type: "timeout" }, game.rng);
    }
    if (result.ok) this.commit(result);
  }

  private runTimeout(playerId: PlayerId): void {
    const game = this.game;
    if (!game || getWaitingFor(game.state) !== playerId) return;
    const result = applyAction(game.state, playerId, { type: "timeout" }, game.rng);
    if (result.ok) this.commit(result);
  }

  /** Fehler in Zeitgebern dürfen den Server nie zum Absturz bringen. */
  private guard(task: () => void): void {
    try {
      task();
    } catch (error) {
      this.out.log(`Raum ${this.code}: Fehler im Ablauf: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
  }

  private stopTimers(): void {
    if (this.stepTimer) clearTimeout(this.stepTimer);
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    this.stepTimer = null;
    this.presenceTimer = null;
    this.clock = null;
  }

  /** Raum auflösen: Zeitgeber stoppen, verbundene Browser informieren. */
  dispose(reason: string): void {
    this.stopTimers();
    for (const seat of this.connectedSeats()) this.out.release(seat.socketId!, reason);
    for (const seat of this.seats) seat.socketId = null;
  }
}
