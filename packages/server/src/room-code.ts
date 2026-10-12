// Raumcodes: kurz, gut vorlesbar, ohne Zeichen, die man verwechselt (0/O, 1/I/L usw.).
import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./protocol";

/** Neuer zufälliger Code (kryptografischer Zufall, damit niemand Codes erraten kann). */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

/** Eingabe vereinheitlichen: Grossbuchstaben, ohne Leerzeichen und Bindestriche. Ungültig → null. */
export function normalizeRoomCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const code = value.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null;
}
