// Protokoll-Ereignisse der Engine als deutsche Sätze (de-CH). Kurz, trocken, mit etwas Zürcher Witz.
import type { CardId, GameEvent, GameState, MoneyParty, PlayerId, SpaceIndex, TradeSide } from "@zueripoly/engine";
import { BANK, DECK_NAMES, HOTEL_LEVEL, JACKPOT, getCard, getSpace } from "@zueripoly/engine";
import { formatChf } from "./format";

// --- Feldnamen mit Artikel -------------------------------------------------------------

/** Geschlecht der Feldnamen mit Artikel (Zürcher Gebrauch: «die Enge», «das Seefeld»). Ohne Eintrag: kein Artikel. */
const GENDER: Record<string, "f" | "m" | "n"> = {
  Langstrasse: "f",
  Bahnhofstrasse: "f",
  Hardbrücke: "f",
  Enge: "f",
  Letzigrund: "m",
  Limmatquai: "m",
  Rennweg: "m",
  Utoquai: "m",
  Paradeplatz: "m",
  Hauptbahnhof: "m",
  Niederdorf: "n",
  Seefeld: "n",
  Stromnetz: "n",
  Seewasserwerk: "n",
};

const ARTICLES = {
  nom: { f: "die", m: "der", n: "das" },
  acc: { f: "die", m: "den", n: "das" },
} as const;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Feldname mit Artikel im Nominativ («die Langstrasse», «Höngg»). */
export function spaceNom(index: SpaceIndex): string {
  const name = getSpace(index).name;
  const gender = GENDER[name];
  return gender ? `${ARTICLES.nom[gender]} ${name}` : name;
}

/** Feldname mit Artikel im Akkusativ («den Letzigrund», «Höngg»). */
export function spaceAcc(index: SpaceIndex): string {
  const name = getSpace(index).name;
  const gender = GENDER[name];
  return gender ? `${ARTICLES.acc[gender]} ${name}` : name;
}

// --- Personen ----------------------------------------------------------------------------

function nameOf(state: GameState, id: PlayerId | MoneyParty): string {
  if (id === BANK) return "die Bank";
  if (id === JACKPOT) return "der Topf";
  return state.players.find((p) => p.id === id)?.name ?? id;
}

function buildingsText(level: number): string {
  if (level === HOTEL_LEVEL) return "ein Hotel";
  if (level === 0) return "keine Gebäude mehr";
  return `${level} ${level === 1 ? "Haus" : "Häuser"}`;
}

function cardText(card: CardId): string {
  return getCard(card).text;
}

/** Eine Seite eines Handelsangebots: «den Letzigrund, Höngg und 120 CHF». */
function tradeSide(side: TradeSide): string {
  const parts = side.spaces.map((i) => spaceAcc(i));
  if (side.money > 0) parts.push(formatChf(side.money));
  if (side.jailCards.length > 0) parts.push(side.jailCards.length === 1 ? "eine Freikarte" : `${side.jailCards.length} Freikarten`);
  if (parts.length === 0) return "nichts";
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

// --- Einzelne Ereignisse -----------------------------------------------------------------

/**
 * Ein Ereignis als Satz, oder `null`, wenn es nicht ins Protokoll gehört
 * (z. B. Zahlungen, die ein anderes Ereignis schon beschreibt).
 */
export function formatEvent(state: GameState, event: GameEvent): string | null {
  const who = (id: PlayerId | MoneyParty) => nameOf(state, id);
  switch (event.type) {
    case "startOrderRolled": {
      const rolls = event.rolls.map((r) => `${who(r.player)} ${r.dice[0] + r.dice[1]}`).join(", ");
      return event.round === 1 ? `Auswürfeln um den Anfang: ${rolls}.` : `Stechen: ${rolls}.`;
    }
    case "gameStarted":
      return `Los geht’s. Reihenfolge: ${event.order.map(who).join(", ")}.`;
    case "turnStarted":
      return `${who(event.player)} ist am Zug.`;
    case "diceRolled": {
      const [a, b] = event.dice;
      if (event.purpose === "utilityRent") return `${who(event.player)} würfelt ${a} + ${b} für die Miete.`;
      return `${who(event.player)} würfelt ${a} + ${b}${a === b ? ", Pasch" : ""}.`;
    }
    case "moved": {
      const steps = (event.direction === "forward" ? event.to - event.from + 40 : event.from - event.to + 40) % 40;
      const halt = `Nächster Halt: ${getSpace(event.to).name}.`;
      if (event.direction === "backward") return `${who(event.player)} geht ${steps} Felder zurück. ${halt}`;
      return `${who(event.player)} fährt ${steps} ${steps === 1 ? "Feld" : "Felder"}. ${halt}`;
    }
    case "moneyTransferred":
      return formatMoney(state, event);
    case "propertyBought":
      return `${who(event.player)} kauft ${spaceAcc(event.space)} für ${formatChf(event.price)}.`;
    case "propertyDeclined":
      return `${who(event.player)} kauft ${spaceAcc(event.space)} nicht. Das Feld bleibt frei.`;
    case "cardDrawn":
      return `${who(event.player)} zieht eine ${DECK_NAMES[event.deck]}: «${cardText(event.card)}»`;
    case "sentToJail":
      if (event.reason === "doubles") return `Dritter Pasch in Folge: ${who(event.player)} muss ins Gefängnis.`;
      if (event.reason === "card") return `${who(event.player)} muss ins Gefängnis.`;
      return `${who(event.player)} geht ins Gefängnis. Direkt dorthin, ohne über Start.`;
    case "jailTurnServed":
      return `${who(event.player)} setzt einen Zug aus und ist im nächsten Zug frei.`;
    case "leftJail":
      switch (event.method) {
        case "fine":
          return `${who(event.player)} zahlt die Kaution und ist frei.`;
        case "card":
          return `${who(event.player)} zeigt die Freikarte und ist frei.`;
        case "served":
          return `${who(event.player)} hat einen Zug ausgesessen und ist frei.`;
      }
      return null;
    case "houseBuilt":
      return event.level === HOTEL_LEVEL
        ? `${who(event.player)} baut ein Hotel. ${capitalize(spaceNom(event.space))} hat jetzt ein Hotel.`
        : `${who(event.player)} baut ein Haus. ${capitalize(spaceNom(event.space))} hat jetzt ${buildingsText(event.level)}.`;
    case "buildingSold":
      return `${who(event.player)} verkauft ${event.fromLevel === HOTEL_LEVEL ? "das Hotel" : "ein Haus"}. ${capitalize(spaceNom(event.space))} hat ${event.toLevel === 0 ? "" : "jetzt "}${buildingsText(event.toLevel)}.`;
    case "mortgaged":
      return `${who(event.player)} belastet ${spaceAcc(event.space)} mit einer Hypothek.`;
    case "unmortgaged":
      return `${who(event.player)} löst ${spaceAcc(event.space)} aus.`;
    case "debtOpened":
      return `${who(event.debtor)} schuldet ${event.creditor === BANK ? "der Bank" : who(event.creditor)} ${formatChf(event.amount)} und muss Geld auftreiben.`;
    case "tradeProposed": {
      const { from, to, give, take } = event.offer;
      return `${who(from)} bietet ${who(to)} ${tradeSide(give)} für ${tradeSide(take)}.`;
    }
    case "tradeAccepted":
      return `${who(event.offer.to)} nimmt das Angebot von ${who(event.offer.from)} an.`;
    case "tradeRejected":
      return `${who(event.offer.to)} lehnt das Angebot von ${who(event.offer.from)} ab.`;
    case "tradeCancelled":
      return `${who(event.offer.from)} zieht das Angebot zurück.`;
    case "propertyTransferred":
      return `${capitalize(spaceNom(event.space))} geht von ${who(event.from)} an ${who(event.to)}.`;
    case "propertyReturned":
      return `${capitalize(spaceNom(event.space))} geht zurück an die Bank und ist wieder frei.`;
    case "jailCardTransferred":
      return `Die Freikarte geht von ${who(event.from)} an ${who(event.to)}.`;
    case "jailCardReturned":
      return "Die Freikarte kommt zurück unter den Stapel.";
    case "buildPermitUsed":
      return `${who(event.player)} setzt die Baubewilligung ein und baut gratis.`;
    case "buildPermitReturned":
      return "Die Baubewilligung kommt zurück unter den Stapel.";
    case "passedThrough":
      return `Pasch: ${capitalize(spaceNom(event.space))} zählt nicht, ${who(event.player)} fährt durch und würfelt nochmals.`;
    case "mortgageDecisionRequired":
      return `${who(event.player)} übernimmt belastete Felder: sofort auslösen oder vorerst nur Zins zahlen.`;
    case "mortgagesResolved": {
      const lifted = event.lifted.length;
      const kept = event.kept.length;
      return `${who(event.player)} löst ${lifted} ${lifted === 1 ? "Feld" : "Felder"} aus, ${kept} ${kept === 1 ? "bleibt" : "bleiben"} belastet.`;
    }
    case "bankrupt":
      return event.creditor === BANK
        ? `${who(event.player)} ist bankrott. Der Besitz geht an die Bank.`
        : `${who(event.player)} ist bankrott. Der Besitz geht an ${who(event.creditor)}.`;
    case "playerRemoved":
      return `${who(event.player)} wird aus dem Spiel genommen. Der Besitz geht an die Bank.`;
    case "turnEnded":
      return null;
    case "timeout":
      return `Die Zeit für ${who(event.player)} ist um.`;
    case "gameWon":
      return `${who(event.player)} gewinnt ZüriPoly!`;
  }
}

function formatMoney(state: GameState, event: Extract<GameEvent, { type: "moneyTransferred" }>): string | null {
  const from = nameOf(state, event.from);
  const to = nameOf(state, event.to);
  const amount = formatChf(event.amount);
  switch (event.reason) {
    case "rent": {
      const where = event.space !== null ? ` für ${spaceAcc(event.space)}` : "";
      const comment = event.amount >= 400 ? " Das tut weh." : "";
      return `${from} zahlt ${to} ${amount} Miete${where}.${comment}`;
    }
    case "tax": {
      const what = event.space !== null ? getSpace(event.space).name : "Steuern";
      return event.to === JACKPOT
        ? `${from} zahlt ${amount} für die ${what}. Das Geld kommt in den Topf.`
        : `${from} zahlt ${amount} für die ${what}.`;
    }
    case "start":
      return `${to} zieht über Start und bekommt ${amount} Lohn.`;
    case "jackpot":
      return `${to} kassiert den Topf am Zürichsee: ${amount}.`;
    case "mortgageInterest":
      return `${from} zahlt ${amount} Hypothekenzins.`;
    case "card":
      if (event.from === BANK || event.from === JACKPOT) return `${to} bekommt ${amount}.`;
      if (event.to === BANK) return `${from} zahlt ${amount}.`;
      if (event.to === JACKPOT) return `${from} zahlt ${amount} in den Topf.`;
      return `${from} zahlt ${to} ${amount}.`;
    default:
      // Kauf, Bauen, Hypothek, Handel, Kaution, Bankrott: beschreibt schon ein anderes Ereignis.
      return null;
  }
}

// --- Mehrere Ereignisse ------------------------------------------------------------------

/** Würfelwurf und Zug in einer Zeile zusammenfassen, Unwichtiges weglassen. */
export function formatEvents(state: GameState, events: readonly GameEvent[]): string[] {
  const lines: string[] = [];
  const removed = new Set<PlayerId>();
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const next = events[i + 1];
    if (event.type === "playerRemoved") removed.add(event.player);
    // Nach «aus dem Spiel genommen» sagt der Bankrott nichts Neues.
    if (event.type === "bankrupt" && removed.has(event.player)) continue;
    if (event.type === "diceRolled" && event.purpose === "move" && next?.type === "moved" && next.player === event.player) {
      const [a, b] = event.dice;
      lines.push(`${nameOf(state, event.player)} würfelt ${a} + ${b}${a === b ? " (Pasch)" : ""}. Nächster Halt: ${getSpace(next.to).name}.`);
      i++;
      continue;
    }
    const line = formatEvent(state, event);
    if (line) lines.push(line);
  }
  return lines;
}
