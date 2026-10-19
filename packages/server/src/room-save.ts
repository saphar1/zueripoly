// Verschlüsselter Spielstand eines Online-Raums. Damit überlebt ein Spiel den Neustart des Servers
// (auf Render bei jedem Push und nach dem Einschlafen), ohne Datenbank: Die Browser der Spieler
// bewahren den Stand auf und schicken ihn nach dem Neustart zurück («room:restore»).
//
// Warum verschlüsselt? Im Stand stecken Geheimnisse: die Reihenfolge der Kartenstapel, die Zufallsquellen
// und die Sitzplatz-Schlüssel aller Spieler. AES-256-GCM verschlüsselt und prüft die Echtheit
// zugleich: Wer ein einziges Byte ändert, bekommt den Stand nicht mehr geöffnet. Den Schlüssel kennt
// nur der Server.
//
// Format: «z1.» + base64url( IV (12 Byte) | Prüfwert (16 Byte) | verschlüsselt( deflate( JSON ) ) )
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { BotLevel, GameOptions, GameState, PlayerId, TokenId } from "@zueripoly/engine";
import { deserializeGame, serializeGame } from "@zueripoly/engine";

const PREFIX = "z1.";
const IV_BYTES = 12;
const TAG_BYTES = 16;
export const SAVE_KEY_BYTES = 32;
/** Ältere Stände werden nicht mehr angenommen. */
export const SAVE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Obergrenze für das Auspacken (Schutz vor «Zip-Bomben»). */
const MAX_JSON_BYTES = 2 * 1024 * 1024;

export interface SavedSeat {
  id: PlayerId;
  name: string;
  token: TokenId;
  bot: BotLevel | null;
  /** Sitzplatz-Schlüssel (null: ausgestiegen oder Bot). */
  key: string | null;
  left: boolean;
  standIn: BotLevel | null;
}

export interface RoomSave {
  code: string;
  hostId: PlayerId | null;
  options: GameOptions;
  seats: SavedSeat[];
  state: GameState;
  rngState: number;
  botRngState: number;
  seq: number;
  /** Laufende Nummer der Speicherung (siehe `Room.saveRev`). */
  rev: number;
  savedAt: number;
}

/** Gespeichertes Format: der Spielstand als `serializeGame` der Engine (geprüft beim Laden). */
interface Stored extends Omit<RoomSave, "state" | "rngState"> {
  game: string;
}

/** Schlüssel aus base64 (32 Byte) oder null, wenn er nicht passt. */
export function parseSaveKey(text: string | undefined): Buffer | null {
  if (!text) return null;
  const key = Buffer.from(text.trim(), "base64");
  return key.length === SAVE_KEY_BYTES ? key : null;
}

/**
 * Schlüssel für den Server: aus `ZUERIPOLY_SAVE_KEY` (32 Byte base64; jeder andere Text wird mit SHA-256
 * zu einem Schlüssel, z. B. der von Render erzeugte Wert), sonst aus der Datei `saves/save-key` (wird beim
 * ersten Start angelegt). So überlebt auch ein Spiel im WLAN (`npm start`) einen Neustart.
 */
export function loadSaveKey(envValue: string | undefined, keyFile: string): { key: Buffer; source: string } {
  if (envValue) {
    const key = parseSaveKey(envValue) ?? createHash("sha256").update(envValue).digest();
    return { key, source: "ZUERIPOLY_SAVE_KEY" };
  }
  if (existsSync(keyFile)) {
    const key = parseSaveKey(readFileSync(keyFile, "utf8"));
    if (key) return { key, source: keyFile };
  }
  const key = randomBytes(SAVE_KEY_BYTES);
  mkdirSync(path.dirname(keyFile), { recursive: true });
  writeFileSync(keyFile, `${key.toString("base64")}\n`, { mode: 0o600 });
  return { key, source: `${keyFile} (neu angelegt)` };
}

export function sealRoom(save: RoomSave, key: Buffer): string {
  const { state, rngState, ...rest } = save;
  const stored: Stored = { ...rest, game: serializeGame(state, rngState) };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(deflateRawSync(JSON.stringify(stored))), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Öffnet einen Stand. Wirft einen Fehler mit deutschem Text, wenn er nicht passt. */
export function openRoom(blob: string, key: Buffer, now = Date.now()): RoomSave {
  const UNREADABLE = "Der gespeicherte Spielstand passt nicht zu diesem Server.";
  if (!blob.startsWith(PREFIX)) throw new Error(UNREADABLE);
  const raw = Buffer.from(blob.slice(PREFIX.length), "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error(UNREADABLE);
  let stored: Stored;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const packed = Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
    stored = JSON.parse(inflateRawSync(packed, { maxOutputLength: MAX_JSON_BYTES }).toString("utf8")) as Stored;
  } catch {
    throw new Error(UNREADABLE);
  }
  if (typeof stored.savedAt !== "number" || now - stored.savedAt > SAVE_MAX_AGE_MS) {
    throw new Error("Der gespeicherte Spielstand ist zu alt (mehr als 24 Stunden).");
  }
  // Echt (vom eigenen Server versiegelt), aber trotzdem die Invarianten prüfen.
  const { state, rngState } = deserializeGame(stored.game);
  if (rngState === null) throw new Error(UNREADABLE);
  const { game: _game, ...rest } = stored;
  return { ...rest, state, rngState };
}
