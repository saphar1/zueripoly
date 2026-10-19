// Nachrichten zwischen Server und Browser (Online-Spiel).
// Diese Datei enthält nur Typen, Konstanten und kleine reine Helfer, keine Node-APIs: Der Client importiert sie
// über «@zueripoly/server/protocol», damit beide Seiten dieselbe Sprache sprechen.
//
// Ablauf: Der Browser schickt Anfragen mit Bestätigung (Socket.IO «ack») und bekommt immer
// `{ ok: true, … }` oder `{ ok: false, error }` (Fehlertext auf Deutsch) zurück.
// Zustand und Ereignisse schickt der Server von sich aus an alle im Raum.
import type { Action, BotLevel, GameEvent, GameOptions, GameState, PlayerId, TokenId } from "@zueripoly/engine";

/** Standardport des Spielservers. */
export const SERVER_PORT = 3001;
/** Höchstlänge eines Namens (Zeichen). */
export const NAME_MAX = 16;
/** Raumcodes: 5 Zeichen ohne Verwechslungsgefahr (kein 0/O/Q, 1/I/L, 2/Z, 5/S, 8/B). */
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = "ACDEFGHJKMNPRTUVWXY346789";
/** Link-Parameter, der den Raumcode vorausfüllt: `/?raum=K7MP4`. */
export const ROOM_LINK_PARAM = "raum";
/** Höchstlänge eines verschlüsselten Spielstands (Zeichen), siehe «room:restore». Üblich sind etwa 3 KB. */
export const SAVE_MAX_CHARS = 12 * 1024;

export type RoomPhase = "lobby" | "game";

/** Entscheid des Hosts, wenn jemand länger getrennt ist. */
export type AbsentDecision = "wait" | "bot" | "remove";

export interface SeatInfo {
  /** Spieler-ID im Spiel: «p1» bis «p6». */
  id: PlayerId;
  name: string;
  token: TokenId;
  /** Computergegner von Anfang an (Stufe) oder null für einen Menschen. */
  bot: BotLevel | null;
  /** Bereit in der Lobby (Computergegner sind immer bereit). */
  ready: boolean;
  /** Mensch mit offener Verbindung (Computergegner gelten als verbunden). */
  connected: boolean;
  /** Seit wie vielen Millisekunden getrennt (Stand beim Senden), sonst null. */
  awayMs: number | null;
  /** Hat das laufende Spiel ausdrücklich verlassen. */
  left: boolean;
  /** Ein Computergegner vertritt den Menschen (Stufe), sonst null. */
  standIn: BotLevel | null;
  /** Länger weg: Der Host soll entscheiden (warten, Computer, aus dem Spiel nehmen). */
  needsDecision: boolean;
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  hostId: PlayerId | null;
  seats: SeatInfo[];
  options: GameOptions;
  /** Dein Platz. */
  you: PlayerId;
}

export interface GameUpdate {
  /** Fortlaufende Nummer. Fehlt eine, holt der Client mit «game:sync» den Vollstand. */
  seq: number;
  /** Spielstand vom Server. Die Kartenstapel sind sortiert (die Reihenfolge bleibt geheim). */
  state: GameState;
  /** Neue Ereignisse seit dem letzten Stand (zum Abspielen). Bei `sync` leer. */
  events: GameEvent[];
  /** Vollstand nach Beitritt oder Wiederverbinden: ohne Abspielen übernehmen. */
  sync: boolean;
}

export interface TurnClock {
  /** Zu diesem Spielstand gehört die Uhr. */
  seq: number;
  /** Restzeit in Millisekunden ab Empfang (enthält die Zeit fürs Abspielen der Bewegung). */
  ms: number;
  /** Zeitlimit pro Entscheid in Millisekunden. */
  limitMs: number;
}

/**
 * Verschlüsselter Spielstand des Raums zum Aufbewahren im Browser. Startet der Server neu, schickt der
 * Browser ihn mit «room:restore» zurück. `blob: null` = nichts mehr aufbewahren (Spiel zu Ende).
 */
export interface GameSaveMessage extends SaveVersion {
  code: string;
  blob: string | null;
  /**
   * Gerade nach einem Neustart wiederhergestellt (noch kein Spielzug): aus welchem Stand. Hat der Browser
   * einen neueren (`isNewerSave`), schickt er ihn mit «room:restore» nach. Sonst null.
   */
  restoredFrom: SaveVersion | null;
}

/** Version eines Spielstands: Spielstand-Nummer und laufende Nummer der Speicherung (zählt auch Aussteigen usw.). */
export interface SaveVersion {
  seq: number;
  rev: number;
}

/** Ist `a` neuer als `b`? */
export function isNewerSave(a: SaveVersion, b: SaveVersion): boolean {
  return a.seq > b.seq || (a.seq === b.seq && a.rev > b.rev);
}

export type Reply<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface SeatGrant {
  code: string;
  /** Geheimer Sitzplatz-Schlüssel zum Wiederverbinden. Nie anderen zeigen. */
  seatKey: string;
  seatId: PlayerId;
}

/** Anfragen vom Browser an den Server: Name → Daten und Antwort. */
export interface Requests {
  "room:create": { data: { name: string }; reply: SeatGrant };
  "room:join": { data: { code: string; name: string }; reply: SeatGrant };
  "room:resume": { data: { code: string; seatKey: string }; reply: SeatGrant };
  /** Raum nach einem Neustart aus dem aufbewahrten Stand wiederherstellen; danach «room:resume». */
  "room:restore": { data: { blob: string }; reply: { code: string } };
  "room:leave": { data: Record<string, never>; reply: object };
  /** Eigener Platz in der Lobby: Name, Figur, bereit. */
  "lobby:seat": { data: { name?: string; token?: TokenId; ready?: boolean }; reply: object };
  /** Nur Host. */
  "lobby:options": { data: Partial<GameOptions>; reply: object };
  "lobby:addBot": { data: { level: BotLevel }; reply: object };
  "lobby:botLevel": { data: { seatId: PlayerId; level: BotLevel }; reply: object };
  "lobby:removeSeat": { data: { seatId: PlayerId }; reply: object };
  "lobby:start": { data: Record<string, never>; reply: object };
  /** Spielzug des eigenen Platzes. «timeout» schickt nur der Server. */
  "game:action": { data: { action: Action }; reply: object };
  "game:sync": { data: Record<string, never>; reply: object };
  /** Nur Host: Entscheid für einen getrennten Platz. */
  "game:absent": { data: { seatId: PlayerId; decision: AbsentDecision }; reply: object };
  /** Nur Host, nach Spielende: alle zurück in die Lobby. */
  "game:toLobby": { data: Record<string, never>; reply: object };
}

export type RequestName = keyof Requests;

export const REQUEST_NAMES: readonly RequestName[] = [
  "room:create",
  "room:join",
  "room:resume",
  "room:restore",
  "room:leave",
  "lobby:seat",
  "lobby:options",
  "lobby:addBot",
  "lobby:botLevel",
  "lobby:removeSeat",
  "lobby:start",
  "game:action",
  "game:sync",
  "game:absent",
  "game:toLobby",
];

/** Nachrichten vom Server an den Browser. */
export interface ServerEvents {
  "room:state": (room: RoomSnapshot) => void;
  "game:update": (update: GameUpdate) => void;
  /** Uhr für den Entscheid, der gerade ansteht (null: keine Uhr). */
  "game:clock": (clock: TurnClock | null) => void;
  /** Neuer verschlüsselter Spielstand zum Aufbewahren (nach jeder Änderung im Spiel). */
  "game:save": (save: GameSaveMessage) => void;
  /** Du bist nicht mehr in diesem Raum (entfernt, Platz in anderem Fenster geöffnet, Raum aufgelöst). */
  "room:closed": (info: { reason: string }) => void;
}
