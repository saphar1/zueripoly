// Eingänge vom Browser prüfen. Alles, was übers Netz kommt, ist unbekannt (`unknown`):
// Wir bauen daraus neue, saubere Objekte und nehmen nur bekannte Felder mit passenden Werten.
// So kommen keine fremden Felder (z. B. «__proto__») und keine falschen Typen in die Engine.
import type { Action, BotLevel, GameOptions, PlayerId, SpaceIndex, TokenId, TradeSide, TurnTimeLimit } from "@zueripoly/engine";
import {
  BOARD_SIZE,
  START_MONEY_MAX,
  START_MONEY_MIN,
  START_MONEY_STEP,
  TOKENS,
  TURN_TIME_LIMITS,
} from "@zueripoly/engine";
import type { AbsentDecision } from "./protocol";
import { NAME_MAX } from "./protocol";

const MAX_MONEY = 1_000_000;
const MAX_LIST = 40;

export type Plain = Record<string, unknown>;

/** Gewöhnliches Objekt (kein Array, kein null)? */
export function asObject(value: unknown): Plain | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Plain) : null;
}

function int(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function spaceList(value: unknown): SpaceIndex[] | null {
  if (!Array.isArray(value) || value.length > MAX_LIST) return null;
  const list: SpaceIndex[] = [];
  for (const item of value) {
    const space = int(item, 0, BOARD_SIZE - 1);
    if (space === null || list.includes(space)) return null;
    list.push(space);
  }
  return list;
}

function tradeSide(value: unknown): TradeSide | null {
  const side = asObject(value);
  if (!side) return null;
  const spaces = spaceList(side.spaces);
  const money = int(side.money, 0, MAX_MONEY);
  const cards = side.jailCards;
  if (spaces === null || money === null || !Array.isArray(cards) || cards.length > 4) return null;
  if (!cards.every((c): c is string => typeof c === "string" && /^[EG]\d{2}$/.test(c))) return null;
  return { spaces, money, jailCards: [...cards] };
}

const SIMPLE = [
  "rollDice",
  "payJailFine",
  "useJailCard",
  "buyProperty",
  "declineProperty",
  "rejectTrade",
  "cancelTrade",
  "declareBankruptcy",
  "endTurn",
] as const;
const ON_SPACE = ["buildHouse", "sellBuilding", "mortgage", "unmortgage"] as const;

/**
 * Spielzug prüfen und neu bauen. `null` = unbekannt oder falsch aufgebaut.
 * «timeout» ist für Browser nicht erlaubt: Das Zeitlimit läuft nur auf dem Server.
 */
export function parseAction(value: unknown): Action | null {
  const raw = asObject(value);
  if (!raw || typeof raw.type !== "string") return null;
  const type = raw.type;
  if ((SIMPLE as readonly string[]).includes(type)) return { type } as Action;
  if ((ON_SPACE as readonly string[]).includes(type)) {
    const space = int(raw.space, 0, BOARD_SIZE - 1);
    return space === null ? null : ({ type, space } as Action);
  }
  switch (type) {
    case "proposeTrade": {
      const offer = asObject(raw.offer);
      if (!offer || typeof offer.to !== "string" || offer.to.length > 16) return null;
      const give = tradeSide(offer.give);
      const take = tradeSide(offer.take);
      const lift = offer.lift === undefined ? [] : spaceList(offer.lift);
      if (!give || !take || lift === null) return null;
      return { type, offer: { to: offer.to, give, take, lift } };
    }
    case "acceptTrade": {
      const lift = raw.lift === undefined ? [] : spaceList(raw.lift);
      return lift === null ? null : { type, lift };
    }
    case "resolveMortgages": {
      const lift = spaceList(raw.lift);
      return lift === null ? null : { type, lift };
    }
    default:
      return null;
  }
}

/**
 * Namen säubern: Steuer- und Formatzeichen (z. B. Richtungswechsel) entfernen, Leerraum zusammenfassen,
 * auf NAME_MAX Zeichen kürzen. Leer oder kein Text → null. Angezeigt wird der Name im Browser immer
 * als Text (React), nie als HTML.
 */
export function cleanName(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 200) return null;
  const cleaned = value
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const short = Array.from(cleaned).slice(0, NAME_MAX).join("").trim();
  return short.length > 0 ? short : null;
}

export function parseToken(value: unknown): TokenId | null {
  return typeof value === "string" && (TOKENS as readonly string[]).includes(value) ? (value as TokenId) : null;
}

export function parseBotLevel(value: unknown): BotLevel | null {
  return value === "easy" || value === "clever" ? value : null;
}

export function parseSeatId(value: unknown): PlayerId | null {
  return typeof value === "string" && /^p[1-6]$/.test(value) ? value : null;
}

export function parseDecision(value: unknown): AbsentDecision | null {
  return value === "wait" || value === "bot" || value === "remove" ? value : null;
}

/** Optionen des Hosts: nur bekannte Felder, Werte wie in der Lokal-Lobby. */
export function parseOptions(value: unknown): Partial<GameOptions> | null {
  const raw = asObject(value);
  if (!raw) return null;
  const options: Partial<GameOptions> = {};
  if ("startMoney" in raw) {
    const money = int(raw.startMoney, START_MONEY_MIN, START_MONEY_MAX);
    if (money === null || money % START_MONEY_STEP !== 0) return null;
    options.startMoney = money;
  }
  if ("jackpot" in raw) {
    if (typeof raw.jackpot !== "boolean") return null;
    options.jackpot = raw.jackpot;
  }
  if ("turnTimeLimit" in raw) {
    const limit = raw.turnTimeLimit;
    if (limit !== null && !(TURN_TIME_LIMITS as readonly unknown[]).includes(limit)) return null;
    options.turnTimeLimit = limit as TurnTimeLimit | null;
  }
  return options;
}
