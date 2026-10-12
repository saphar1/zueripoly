// Hilfen für die Server-Tests: Server auf freiem Port mit kurzen Zeiten, simulierte Browser (Socket.IO-Clients).
import { afterEach } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import type { BotLevel, GameState, PlayerId } from "@zueripoly/engine";
import { chooseBotAction, createSeededRng, getWaitingFor } from "@zueripoly/engine";
import type { GameUpdate, Reply, RequestName, Requests, RoomSnapshot, SeatGrant, TurnClock } from "../src/protocol";
import type { Timing } from "../src/room";
import { startZueriServer, type ZueriServer, type ZueriServerOptions } from "../src/server";

/** Kurze Zeiten: Abwesenheit 300 ms, Bots ohne Pause, leere Räume nach 400 ms weg. */
export const FAST: Partial<Timing> = {
  absentMs: 300,
  emptyLobbyMs: 400,
  emptyGameMs: 400,
  botScale: 0,
  playbackScale: 0,
  latencyMs: 0,
  sweepMs: 50,
};

const servers: ZueriServer[] = [];
const clients: TestClient[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  for (const server of servers.splice(0)) await server.close();
});

/**
 * Server für einen Test. Die simulierten Clients spielen ohne Pausen, darum ist die Flutbremse hier
 * standardmässig weit offen; robustness.test.ts prüft sie mit den echten Werten.
 */
export async function startServer(options: Partial<ZueriServerOptions> = {}): Promise<ZueriServer> {
  const server = await startZueriServer({
    port: 0,
    log: false,
    rateLimit: { capacity: 100_000, perSecond: 100_000 },
    ...options,
    timing: { ...FAST, ...options.timing },
  });
  servers.push(server);
  return server;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wartet, bis `check` wahr ist (prüft alle 10 ms). */
export async function waitUntil(check: () => boolean, what: string, timeoutMs = 4000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error(`Zeit abgelaufen beim Warten auf: ${what}`);
    await sleep(10);
  }
}

/** Ein simulierter Browser. */
export class TestClient {
  readonly socket: Socket;
  room: RoomSnapshot | null = null;
  state: GameState | null = null;
  seq = 0;
  updates: GameUpdate[] = [];
  clock: TurnClock | null = null;
  closedReason: string | null = null;
  grant: SeatGrant | null = null;
  /** Fehlermeldungen auf eigene Spielzüge (z. B. weil sich der Stand inzwischen geändert hat). */
  rejected: string[] = [];
  private auto: { level: BotLevel; until: (state: GameState) => boolean } | null = null;
  private actedSeq = -1;
  private readonly rng = createSeededRng(Math.floor(Math.random() * 1e9));

  constructor(port: number) {
    this.socket = connect(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true, reconnection: false });
    this.socket.on("room:state", (room: RoomSnapshot) => {
      this.room = room;
    });
    this.socket.on("game:update", (update: GameUpdate) => {
      this.updates.push(update);
      this.state = update.state;
      this.seq = update.seq;
      this.maybePlay();
    });
    this.socket.on("game:clock", (clock: TurnClock | null) => {
      this.clock = clock;
    });
    this.socket.on("room:closed", (info: { reason: string }) => {
      this.closedReason = info.reason;
    });
    clients.push(this);
  }

  static async connect(port: number): Promise<TestClient> {
    const client = new TestClient(port);
    await waitUntil(() => client.socket.connected, "Verbindung");
    return client;
  }

  get me(): PlayerId {
    if (!this.grant) throw new Error("Kein Platz.");
    return this.grant.seatId;
  }

  /** Anfrage mit Antwort (wie der echte Client). `data` darf absichtlich falsch sein. */
  request<K extends RequestName>(name: K, data: Requests[K]["data"] | unknown = {}): Promise<Reply<Requests[K]["reply"]>> {
    return this.socket.timeout(3000).emitWithAck(name, data) as Promise<Reply<Requests[K]["reply"]>>;
  }

  async create(name: string): Promise<SeatGrant> {
    const reply = await this.request("room:create", { name });
    if (!reply.ok) throw new Error(reply.error);
    this.grant = reply;
    await waitUntil(() => this.room !== null, "Raumzustand");
    return reply;
  }

  async join(code: string, name: string): Promise<SeatGrant> {
    const reply = await this.request("room:join", { code, name });
    if (!reply.ok) throw new Error(reply.error);
    this.grant = reply;
    await waitUntil(() => this.room?.seats.some((s) => s.id === reply.seatId) ?? false, "Raumzustand");
    return reply;
  }

  async resume(grant: SeatGrant): Promise<Reply<SeatGrant>> {
    const reply = await this.request("room:resume", { code: grant.code, seatKey: grant.seatKey });
    if (reply.ok) this.grant = reply;
    return reply;
  }

  /** Spielt selbst mit (Entscheide wie ein Computergegner), bis `until` wahr ist. */
  autoplay(level: BotLevel = "easy", until: (state: GameState) => boolean = () => false): void {
    this.auto = { level, until };
    this.maybePlay();
  }

  stopAutoplay(): void {
    this.auto = null;
  }

  private maybePlay(): void {
    const state = this.state;
    if (!this.auto || !state || !this.grant || this.actedSeq === this.seq) return;
    if (state.winner !== null || this.auto.until(state) || getWaitingFor(state) !== this.grant.seatId) return;
    this.actedSeq = this.seq;
    const action = chooseBotAction(state, this.grant.seatId, this.rng, this.auto.level);
    void this.request("game:action", { action }).then(
      (reply) => {
        if (!reply.ok) this.rejected.push(reply.error);
      },
      () => this.rejected.push("keine Antwort"),
    );
  }

  close(): void {
    this.socket.disconnect();
  }
}

/** Host eröffnet einen Raum, die anderen treten bei; alle bereit. */
export async function setupRoom(port: number, names: string[]): Promise<TestClient[]> {
  const [hostName, ...others] = names;
  const host = await TestClient.connect(port);
  const grant = await host.create(hostName!);
  const players = [host];
  for (const name of others) {
    const client = await TestClient.connect(port);
    await client.join(grant.code, name);
    const ready = await client.request("lobby:seat", { ready: true });
    if (!ready.ok) throw new Error(ready.error);
    players.push(client);
  }
  await waitUntil(() => players.every((p) => p.room?.seats.length === names.length && p.room.seats.every((s) => s.ready || s.id === p.room!.hostId)), "alle bereit");
  return players;
}

/** Spiel starten und warten, bis alle den Spielstand haben. */
export async function startGame(players: TestClient[]): Promise<void> {
  const reply = await players[0]!.request("lobby:start", {});
  if (!reply.ok) throw new Error(reply.error);
  await waitUntil(() => players.every((p) => p.state !== null), "Spielstand bei allen");
}

/** Wer gerade entscheiden muss. */
export function waitingClient(players: TestClient[]): TestClient {
  const state = players[0]!.state!;
  const waiting = getWaitingFor(state);
  const client = players.find((p) => p.grant?.seatId === waiting);
  if (!client) throw new Error(`Niemand wartet (${waiting}).`);
  return client;
}

export function expectError<T extends object>(reply: Reply<T>): string {
  if (reply.ok) throw new Error("Erwartet: Fehler, erhalten: ok.");
  return reply.error;
}
