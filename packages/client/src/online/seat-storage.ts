// Sitzplatz-Schlüssel im Browser, damit man nach einem Abbruch oder Neuladen auf den eigenen Platz zurückkommt.
// - sessionStorage: gilt pro Fenster und überlebt das Neuladen. So können mehrere Fenster im selben
//   Browser verschiedene Spieler sein (zum Testen).
// - localStorage: merkt sich den letzten Platz auch nach dem Schliessen des Fensters; das Online-Menü
//   bietet dann «Zurück in Raum …» an.
// Dazu der verschlüsselte Spielstand des Raums (`game:save`): Startet der Server neu, stellt der Browser
// den Raum damit wieder her («room:restore»). Lesen kann ihn nur der Server.
// Speicher kann fehlen oder gesperrt sein (privates Fenster): Jeder Zugriff steht in try/catch.
import type { GameSaveMessage, SeatGrant } from "@zueripoly/server/protocol";

const SESSION_KEY = "zueripoly.seat";
const LAST_KEY = "zueripoly.lastSeat";
const NAME_KEY = "zueripoly.name";
const SESSION_SAVE_KEY = "zueripoly.roomSave";
const LAST_SAVE_KEY = "zueripoly.lastRoomSave";
/** Ältere Plätze bietet das Menü nicht mehr an (der Raum ist dann ohnehin aufgeräumt). */
const LAST_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface LastSeat extends SeatGrant {
  name: string;
  savedAt: number;
}

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    // Kein Speicher: Wiederverbinden klappt dann nur, solange das Fenster offen bleibt.
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

function isGrant(value: unknown): value is SeatGrant {
  const v = value as Partial<SeatGrant> | null;
  return Boolean(v && typeof v.code === "string" && typeof v.seatKey === "string" && typeof v.seatId === "string");
}

/** Platz dieses Fensters (nach dem Neuladen). */
export function loadWindowSeat(): SeatGrant | null {
  const seat = read<SeatGrant>(session, SESSION_KEY);
  return isGrant(seat) ? seat : null;
}

/** Letzter Platz in diesem Browser (für «Zurück in Raum …»). */
export function loadLastSeat(): LastSeat | null {
  const seat = read<LastSeat>(local, LAST_KEY);
  if (!isGrant(seat) || typeof seat.savedAt !== "number" || Date.now() - seat.savedAt > LAST_MAX_AGE_MS) return null;
  return seat;
}

export function saveSeat(grant: SeatGrant, name: string): void {
  const seat = { code: grant.code, seatKey: grant.seatKey, seatId: grant.seatId };
  write(session, SESSION_KEY, seat);
  write(local, LAST_KEY, { ...seat, name, savedAt: Date.now() });
}

/** Platz vergessen (Raum verlassen, entfernt, Raum aufgelöst), samt aufbewahrtem Spielstand. */
export function forgetSeat(code: string): void {
  if (loadWindowSeat()?.code === code) write(session, SESSION_KEY, null);
  if (read<LastSeat>(local, LAST_KEY)?.code === code) write(local, LAST_KEY, null);
  forgetRoomSave(code);
}

function isSave(value: unknown): value is GameSaveMessage & { blob: string } {
  const v = value as Partial<GameSaveMessage> | null;
  return Boolean(v && typeof v.code === "string" && typeof v.seq === "number" && typeof v.blob === "string");
}

/** Neuen Spielstand aufbewahren (`blob: null` = Spiel zu Ende, nichts mehr aufbewahren). */
export function saveRoomSave(save: GameSaveMessage): void {
  if (save.blob === null) {
    forgetRoomSave(save.code);
    return;
  }
  write(session, SESSION_SAVE_KEY, save);
  write(local, LAST_SAVE_KEY, save);
}

/** Aufbewahrter Spielstand für diesen Raum: der neuere aus Fenster und Browser. */
export function loadRoomSave(code: string): { seq: number; blob: string } | null {
  const saves = [read<unknown>(session, SESSION_SAVE_KEY), read<unknown>(local, LAST_SAVE_KEY)].filter(isSave).filter((s) => s.code === code);
  saves.sort((a, b) => b.seq - a.seq);
  return saves[0] ? { seq: saves[0].seq, blob: saves[0].blob } : null;
}

function forgetRoomSave(code: string): void {
  if (read<GameSaveMessage>(session, SESSION_SAVE_KEY)?.code === code) write(session, SESSION_SAVE_KEY, null);
  if (read<GameSaveMessage>(local, LAST_SAVE_KEY)?.code === code) write(local, LAST_SAVE_KEY, null);
}

export function loadName(): string {
  const name = read<string>(local, NAME_KEY);
  return typeof name === "string" ? name : "";
}

export function saveName(name: string): void {
  write(local, NAME_KEY, name);
}
