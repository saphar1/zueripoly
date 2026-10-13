// Verbindung zum Spielserver (Socket.IO). Ein Objekt pro Online-Sitzung, unabhängig von React:
// Bildschirme lesen den Zustand über `subscribe`/`getSnapshot` (useSyncExternalStore) und hören
// mit `onUpdate` auf neue Spielstände. Bricht die Verbindung ab, verbindet Socket.IO von selbst neu,
// danach meldet sich der Client mit dem Sitzplatz-Schlüssel wieder auf seinem Platz an.
import { io, type Socket } from "socket.io-client";
import type { GameUpdate, Reply, RequestName, Requests, RoomSnapshot, SeatGrant, TurnClock } from "@zueripoly/server/protocol";
import { forgetSeat, saveSeat } from "./seat-storage";

export type ConnectionStatus = "connecting" | "online" | "offline";

export interface ReceivedClock extends TurnClock {
  /** Zeitpunkt des Empfangs (performance.now), damit die Restzeit lokal weiterläuft. */
  receivedAt: number;
}

export interface OnlineSnapshot {
  status: ConnectionStatus;
  room: RoomSnapshot | null;
  /** Zeitpunkt, zu dem `room` ankam (für «getrennt seit …»). */
  roomAt: number;
  clock: ReceivedClock | null;
  grant: SeatGrant | null;
  /** Warum man nicht mehr im Raum ist (entfernt, Raum aufgelöst …), sonst null. */
  closed: string | null;
  /** Neuester Spielstand vom Server (null: Spiel läuft nicht). */
  latest: GameUpdate | null;
}

/** So lange wartet eine Anfrage höchstens auf die Antwort des Servers. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Adresse des Spielservers, wenn er woanders läuft als die Seite (Seite auf GitHub Pages, Server
 * auf Render; beim Bauen gesetzt mit VITE_ZUERIPOLY_SERVER). Sonst undefined: dieselbe Adresse wie die Seite.
 */
export const SERVER_URL: string | undefined = import.meta.env.VITE_ZUERIPOLY_SERVER || undefined;

/**
 * So lange wartet «Raum eröffnen» usw. auf die Verbindung. Der Gratis-Server auf Render schläft nach
 * 15 Minuten ohne Spiel und braucht zum Aufwachen bis zu einer Minute.
 */
const CONNECT_WAIT_MS = SERVER_URL ? 75_000 : 4000;

export class OnlineClient {
  private readonly socket: Socket;
  private snapshot: OnlineSnapshot = {
    status: "connecting",
    room: null,
    roomAt: 0,
    clock: null,
    grant: null,
    closed: null,
    latest: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly updateListeners = new Set<(update: GameUpdate) => void>();
  private name = "";
  private resuming: Promise<Reply<SeatGrant>> | null = null;

  constructor() {
    // Ohne SERVER_URL gleiche Adresse wie die Seite (im Entwickeln leitet Vite /socket.io an den Server weiter).
    this.socket = io(SERVER_URL, { reconnectionDelay: 500, reconnectionDelayMax: 4000 });
    this.socket.on("connect", () => {
      this.set({ status: "online" });
      // Nach einem Abbruch: zurück auf den eigenen Platz.
      const grant = this.snapshot.grant;
      if (grant) void this.resume(grant, this.name);
    });
    this.socket.on("disconnect", () => this.set({ status: "offline" }));
    this.socket.on("connect_error", () => this.set({ status: "offline" }));
    this.socket.on("room:state", (room: RoomSnapshot) => {
      const latest = room.phase === "lobby" ? null : this.snapshot.latest;
      this.set({ room, roomAt: performance.now(), latest });
    });
    this.socket.on("game:update", (update: GameUpdate) => {
      const latest = this.snapshot.latest;
      if (!update.sync && latest && update.seq <= latest.seq) return;
      this.set({ latest: update });
      for (const listener of this.updateListeners) listener(update);
    });
    this.socket.on("game:clock", (clock: TurnClock | null) => {
      this.set({ clock: clock ? { ...clock, receivedAt: performance.now() } : null });
    });
    this.socket.on("room:closed", ({ reason }: { reason: string }) => this.close(reason));
  }

  // --- Für React (useSyncExternalStore) ------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): OnlineSnapshot => this.snapshot;

  /** Neue Spielstände (zum Abspielen). Gibt die Abmeldung zurück. */
  onUpdate(listener: (update: GameUpdate) => void): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  private set(change: Partial<OnlineSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.listeners) listener();
  }

  private close(reason: string): void {
    const code = this.snapshot.grant?.code;
    if (code) forgetSeat(code);
    this.set({ closed: reason, grant: null, room: null, latest: null, clock: null });
  }

  // --- Anfragen -------------------------------------------------------------------------

  /** Anfrage an den Server. Antwortet er nicht, kommt eine verständliche Fehlermeldung zurück. */
  async request<K extends RequestName>(name: K, data: Requests[K]["data"]): Promise<Reply<Requests[K]["reply"]>> {
    if (!this.socket.connected) return { ok: false, error: "Keine Verbindung zum Server. Läuft er?" };
    try {
      return (await this.socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck(name, data)) as Reply<Requests[K]["reply"]>;
    } catch {
      return { ok: false, error: "Der Server antwortet nicht. Bitte nochmals versuchen." };
    }
  }

  /** Wartet auf die Verbindung (höchstens CONNECT_WAIT_MS). */
  private async connected(): Promise<boolean> {
    if (this.socket.connected) return true;
    return new Promise((resolve) => {
      const done = (value: boolean) => {
        clearTimeout(timer);
        this.socket.off("connect", onConnect);
        resolve(value);
      };
      const onConnect = () => done(true);
      const timer = setTimeout(() => done(false), CONNECT_WAIT_MS);
      this.socket.on("connect", onConnect);
    });
  }

  private seated(reply: Reply<SeatGrant>, name: string): Reply<SeatGrant> {
    if (reply.ok) {
      this.name = name;
      const grant = { code: reply.code, seatKey: reply.seatKey, seatId: reply.seatId };
      saveSeat(grant, name);
      this.set({ grant, closed: null });
    }
    return reply;
  }

  async create(name: string): Promise<Reply<SeatGrant>> {
    if (!(await this.connected())) return { ok: false, error: "Keine Verbindung zum Server. Läuft er?" };
    return this.seated(await this.request("room:create", { name }), name);
  }

  async join(code: string, name: string): Promise<Reply<SeatGrant>> {
    if (!(await this.connected())) return { ok: false, error: "Keine Verbindung zum Server. Läuft er?" };
    return this.seated(await this.request("room:join", { code, name }), name);
  }

  /** Zurück auf den eigenen Platz. Gleichzeitige Aufrufe teilen sich eine Anfrage. */
  resume(grant: SeatGrant, name = ""): Promise<Reply<SeatGrant>> {
    this.resuming ??= this.doResume(grant, name).finally(() => {
      this.resuming = null;
    });
    return this.resuming;
  }

  private async doResume(grant: SeatGrant, name: string): Promise<Reply<SeatGrant>> {
    if (!(await this.connected())) {
      // Kein Server: Socket.IO versucht es weiter; der Platz bleibt gemerkt.
      this.set({ grant });
      return { ok: false, error: "Keine Verbindung zum Server. Läuft er?" };
    }
    const reply = await this.request("room:resume", { code: grant.code, seatKey: grant.seatKey });
    if (!reply.ok) {
      // Raum oder Platz gibt es nicht mehr.
      this.close(reply.error);
      forgetSeat(grant.code);
      return reply;
    }
    return this.seated(reply, name || this.name);
  }

  async leave(): Promise<void> {
    const code = this.snapshot.grant?.code;
    if (this.snapshot.grant) await this.request("room:leave", {});
    if (code) forgetSeat(code);
    this.set({ grant: null, room: null, latest: null, clock: null, closed: null });
  }

  /** Verbindung schliessen (zurück ins Hauptmenü). Der Platz bleibt reserviert, bis der Raum aufgeräumt wird. */
  dispose(): void {
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.listeners.clear();
    this.updateListeners.clear();
  }
}

// Eine Online-Sitzung pro Fenster. Ausserhalb von React gehalten, damit doppelte Aufrufe im
// Entwicklungsmodus (React StrictMode) keine zweite Verbindung öffnen.
let current: OnlineClient | null = null;

export function openOnlineClient(): OnlineClient {
  current ??= new OnlineClient();
  return current;
}

export function closeOnlineClient(): void {
  current?.dispose();
  current = null;
}
