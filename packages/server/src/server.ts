// HTTP-Server mit Socket.IO. Verdrahtet die Anfragen der Browser mit den Räumen.
// Jede Anfrage wird geprüft (parse.ts), begrenzt (rate-limit.ts) und in try/catch ausgeführt:
// Ungültige oder unerwartete Nachrichten bekommen eine Fehlermeldung, der Server läuft weiter.
// Daneben liefert er auf Wunsch die gebaute Oberfläche aus (static-files.ts), damit im WLAN und
// auf Render eine Adresse für alles reicht.
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { networkInterfaces } from "node:os";
import { Server, type Socket } from "socket.io";
import { ENGINE_VERSION, type TokenId } from "@zueripoly/engine";
import { isLoopback, lanAddresses, routeAddress } from "./lan";
import { normalizeOrigin, originAllowed } from "./origin";
import { asObject, cleanName, parseAction, parseBotLevel, parseDecision, parseOptions, parseSeatId, parseToken } from "./parse";
import { REQUEST_NAMES, type Reply, type RequestName, type Requests, SERVER_PORT } from "./protocol";
import { TokenBucket } from "./rate-limit";
import { DEFAULT_TIMING, type Timing } from "./room";
import { normalizeRoomCode } from "./room-code";
import { RoomRegistry } from "./room-registry";
import { createStaticHandler } from "./static-files";

/** Grösste Nachricht, die ein Browser schicken darf (Bytes). */
const MAX_MESSAGE_BYTES = 16 * 1024;
/** Nach so vielen abgelehnten Nachrichten wegen Flut wird die Verbindung getrennt. */
const MAX_STRIKES = 40;

export interface ZueriServerOptions {
  /** Port (0 = frei wählen, z. B. in Tests). */
  port?: number;
  /** Adresse, an die der Server bindet (Standard: alle). */
  host?: string;
  timing?: Partial<Timing>;
  /** Meldungen in der Konsole (Standard: an). */
  log?: boolean;
  /** Begrenzung pro Verbindung: Vorrat und Nachschub pro Sekunde. */
  rateLimit?: { capacity: number; perSecond: number };
  /** Ordner mit der gebauten Oberfläche (packages/client/dist). Ohne: nur Spielserver. */
  clientDir?: string;
  /** Fremde Seiten, die verbinden dürfen (z. B. https://name.github.io). Die eigene Adresse darf immer. */
  allowedOrigins?: string[];
}

export interface ZueriServer {
  port: number;
  http: HttpServer;
  io: Server;
  registry: RoomRegistry;
  close(): Promise<void>;
}

const fail = (error: string): Reply<never> => ({ ok: false, error });
const INVALID = "Ungültige Anfrage.";

type Handler = (socket: Socket, data: unknown) => Reply<object>;

function handlers(registry: RoomRegistry): { [K in RequestName]: Handler } {
  const room = (socket: Socket) => registry.roomOf(socket.id);
  const inRoom = (socket: Socket, run: (r: NonNullable<ReturnType<typeof room>>) => Reply<object>): Reply<object> => {
    const r = room(socket);
    return r ? run(r) : fail("Du bist in keinem Raum.");
  };
  const nameOf = (data: unknown) => cleanName(asObject(data)?.name);
  const NAME_HINT = "Bitte einen Namen eingeben (höchstens 16 Zeichen).";

  return {
    "room:create": (socket, data) => {
      const name = nameOf(data);
      return name ? registry.create(socket.id, name) : fail(NAME_HINT);
    },
    "room:join": (socket, data) => {
      const name = nameOf(data);
      const code = normalizeRoomCode(asObject(data)?.code);
      if (!code) return fail("Der Raumcode hat 5 Zeichen, zum Beispiel K7MP4.");
      return name ? registry.join(socket.id, code, name) : fail(NAME_HINT);
    },
    "room:resume": (socket, data) => {
      const raw = asObject(data);
      const code = normalizeRoomCode(raw?.code);
      const key = raw?.seatKey;
      if (!code || typeof key !== "string" || key.length > 64) return fail(INVALID);
      return registry.resume(socket.id, code, key);
    },
    "room:leave": (socket) => registry.leave(socket.id),
    "lobby:seat": (socket, data) => {
      const raw = asObject(data);
      if (!raw) return fail(INVALID);
      const change: { name?: string; token?: TokenId; ready?: boolean } = {};
      if ("name" in raw) {
        const name = cleanName(raw.name);
        if (!name) return fail(NAME_HINT);
        change.name = name;
      }
      if ("token" in raw) {
        const token = parseToken(raw.token);
        if (!token) return fail("Unbekannte Figur.");
        change.token = token;
      }
      if ("ready" in raw) {
        if (typeof raw.ready !== "boolean") return fail(INVALID);
        change.ready = raw.ready;
      }
      return inRoom(socket, (r) => r.updateSeat(socket.id, change));
    },
    "lobby:options": (socket, data) => {
      const options = parseOptions(data);
      return options ? inRoom(socket, (r) => r.setOptions(socket.id, options)) : fail("Ungültige Optionen.");
    },
    "lobby:addBot": (socket, data) => {
      const level = parseBotLevel(asObject(data)?.level);
      return level ? inRoom(socket, (r) => r.addBot(socket.id, level)) : fail(INVALID);
    },
    "lobby:botLevel": (socket, data) => {
      const raw = asObject(data);
      const seatId = parseSeatId(raw?.seatId);
      const level = parseBotLevel(raw?.level);
      return seatId && level ? inRoom(socket, (r) => r.setBotLevel(socket.id, seatId, level)) : fail(INVALID);
    },
    "lobby:removeSeat": (socket, data) => {
      const seatId = parseSeatId(asObject(data)?.seatId);
      return seatId ? inRoom(socket, (r) => r.removeSeat(socket.id, seatId)) : fail(INVALID);
    },
    "lobby:start": (socket) => inRoom(socket, (r) => r.start(socket.id)),
    "game:action": (socket, data) => {
      const action = parseAction(asObject(data)?.action);
      return action ? inRoom(socket, (r) => r.act(socket.id, action)) : fail("Unbekannte oder ungültige Aktion.");
    },
    "game:sync": (socket) => inRoom(socket, (r) => r.sync(socket.id)),
    "game:absent": (socket, data) => {
      const raw = asObject(data);
      const seatId = parseSeatId(raw?.seatId);
      const decision = parseDecision(raw?.decision);
      return seatId && decision ? inRoom(socket, (r) => r.decideAbsent(socket.id, seatId, decision)) : fail(INVALID);
    },
    "game:toLobby": (socket) => inRoom(socket, (r) => r.backToLobby(socket.id)),
  };
}

export async function startZueriServer(options: ZueriServerOptions = {}): Promise<ZueriServer> {
  const timing: Timing = { ...DEFAULT_TIMING, ...options.timing };
  const logging = options.log ?? true;
  const log = (message: string) => {
    if (logging) console.log(`[${new Date().toLocaleTimeString("de-CH")}] ${message}`);
  };
  const limits = options.rateLimit ?? { capacity: 20, perSecond: 10 };

  const allowedOrigins = (options.allowedOrigins ?? []).map(normalizeOrigin);
  const staticFiles = options.clientDir ? createStaticHandler(options.clientDir) : null;
  /** Tatsächlicher Port (steht erst nach listen fest, z. B. bei Port 0 in Tests). */
  let port = 0;

  // Alles ausser /socket.io (das beantwortet Socket.IO selbst, bevor dieser Rückruf drankommt).
  const http = createServer((req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname === "/healthz") {
      // Für das Hosting (Render prüft damit, ob der Dienst läuft).
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end("ok\n");
      return;
    }
    if (pathname === "/api/lan-addresses" && isLoopback(req.socket.remoteAddress)) {
      // Nur für den eigenen PC: Die Lobby zeigt damit den Link fürs gleiche WLAN.
      void routeAddress().then((preferred) => {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(JSON.stringify({ urls: lanAddresses(networkInterfaces(), port, preferred) }));
      });
      return;
    }
    if (staticFiles) {
      staticFiles(req, res);
      return;
    }
    // Ohne gebaute Oberfläche: einfache Antwort für «Läuft der Server?».
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`ZüriPoly-Server läuft (Engine ${ENGINE_VERSION}).\n`);
  });
  const io = new Server(http, {
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    serveClient: false,
    // Erlaubte fremde Seiten (GitHub Pages) dürfen per Polling anfragen …
    cors: { origin: allowedOrigins },
    // … und kommt die Anfrage von einer Webseite, muss es die eigene oder eine erlaubte sein.
    allowRequest: (req, callback) => {
      const ok = originAllowed(req.headers.origin, req.headers.host, allowedOrigins);
      if (!ok) log(`Verbindung von fremder Seite abgelehnt: ${String(req.headers.origin).slice(0, 100)}`);
      callback(ok ? null : "Diese Seite darf nicht mit dem Spielserver verbinden.", ok);
    },
  });

  const registry = new RoomRegistry(timing, {
    emit: (socketId, event, payload) => io.to(socketId).emit(event, payload),
    log,
  });
  const table = handlers(registry);
  const known = new Set<string>(REQUEST_NAMES);

  io.on("connection", (socket) => {
    const bucket = new TokenBucket(limits.capacity, limits.perSecond);
    let strikes = 0;

    /** Gemeinsamer Ablauf jeder Anfrage: Begrenzung, Ausführung in try/catch, Antwort (falls gewünscht). */
    const respond = (args: unknown[], run: () => Reply<object>) => {
      const last = args[args.length - 1];
      const ack = typeof last === "function" ? (args.pop() as (reply: unknown) => void) : null;
      let reply: Reply<object>;
      if (!bucket.take()) {
        strikes += 1;
        reply = fail("Zu viele Nachrichten. Bitte kurz warten.");
        if (strikes >= MAX_STRIKES) {
          log(`Verbindung ${socket.id} getrennt: Nachrichtenflut.`);
          socket.disconnect(true);
        }
      } else {
        try {
          reply = run();
        } catch (error) {
          log(`Fehler bei einer Anfrage: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
          reply = fail("Interner Fehler. Bitte nochmals versuchen.");
        }
      }
      if (ack) {
        try {
          ack(reply);
        } catch {
          // Antwort nicht zustellbar: nichts weiter tun.
        }
      }
    };

    for (const name of REQUEST_NAMES) {
      socket.on(name, (...args: unknown[]) => respond(args, () => table[name](socket, args[0])));
    }
    // Unbekannte Nachrichten: ablehnen (zählen trotzdem zur Begrenzung).
    socket.onAny((event: unknown, ...args: unknown[]) => {
      if (typeof event === "string" && known.has(event)) return;
      respond(args, () => fail("Unbekannte Nachricht."));
    });
    socket.on("disconnect", () => {
      try {
        registry.disconnect(socket.id);
      } catch (error) {
        log(`Fehler beim Trennen: ${String(error)}`);
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port ?? SERVER_PORT, options.host, () => {
      http.off("error", reject);
      resolve();
    });
  });
  port = (http.address() as AddressInfo).port;

  return {
    port,
    http,
    io,
    registry,
    close: async () => {
      registry.dispose();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

export type { Requests };
