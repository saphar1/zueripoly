// Ereignis- und Gemeindekarten gemäss docs/brett.md (Abschnitte 6 und 7).
import type { Card, CardId, DeckId } from "./types";

export const EVENT_CARDS: readonly Card[] = [
  {
    id: "E01",
    deck: "event",
    text: "Sechseläuten! Der Böögg brennt, du eilst zur Feier: Rücke vor auf Start und ziehe 200 CHF ein.",
    effect: { kind: "moveTo", space: 0 },
  },
  {
    id: "E02",
    deck: "event",
    text: "Street Parade: Du tanzt dich bis zum Utoquai. Kommst du an Start vorbei, ziehst du 200 CHF ein.",
    effect: { kind: "moveTo", space: 34 },
  },
  {
    id: "E03",
    deck: "event",
    text: "Züri Fäscht: Du ergatterst den besten Platz an der Bahnhofstrasse. Rücke vor. Kommst du an Start vorbei, ziehst du 200 CHF ein.",
    effect: { kind: "moveTo", space: 39 },
  },
  {
    id: "E04",
    deck: "event",
    text: "Der Strom fällt aus: Rücke vor zum nächsten Versorger. Gehört er niemandem, darfst du ihn kaufen. Sonst würfle und zahle dem Besitzer das 10-Fache der Augensumme.",
    effect: { kind: "moveToNearest", target: "utility" },
  },
  {
    id: "E05",
    deck: "event",
    text: "Tram verpasst: Fahre zum nächsten Bahnhof. Gehört er jemandem, zahle die doppelte Miete. Sonst darfst du ihn kaufen.",
    effect: { kind: "moveToNearest", target: "station" },
  },
  {
    id: "E06",
    deck: "event",
    text: "Das Amt für Baubewilligungen ist ausnahmsweise schnell: Baue gratis ein Haus oder ein Hotel auf einer deiner Strassen. Behalte die Karte, bis du sie brauchst.",
    effect: { kind: "buildPermit" },
  },
  {
    id: "E07",
    deck: "event",
    text: "Die Bank zahlt dir eine Dividende: Ziehe 50 CHF ein.",
    effect: { kind: "gain", amount: 50 },
  },
  {
    id: "E08",
    deck: "event",
    text: "Dein Götti kennt den Stadtrat: Du darfst die Karte «Aus dem Gefängnis frei» behalten, bis du sie brauchst.",
    effect: { kind: "getOutOfJailFree" },
  },
  {
    id: "E09",
    deck: "event",
    text: "Uetliberg-Wanderung: Du hast dich verlaufen. Gehe 3 Felder zurück.",
    effect: { kind: "moveBy", steps: -3 },
  },
  {
    id: "E10",
    deck: "event",
    text: "Falschparkiert und frech geworden: Gehe direkt ins Gefängnis, nicht über Start, ziehe keine 200 CHF ein.",
    effect: { kind: "goToJail" },
  },
  {
    id: "E11",
    deck: "event",
    text: "Der Hauswart schickt die Rechnung: 30 CHF pro Haus, 120 CHF pro Hotel.",
    effect: { kind: "repairs", perHouse: 30, perHotel: 120 },
  },
  {
    id: "E12",
    deck: "event",
    text: "Mit dem 4er ohne Billett erwischt: Zahle 15 CHF Busse.",
    effect: { kind: "pay", amount: 15 },
  },
  {
    id: "E13",
    deck: "event",
    text: "Böögg-Wette verloren: Der Sommer wird nass. Zahle jedem Mitspieler 50 CHF.",
    effect: { kind: "payEach", amount: 50 },
  },
  {
    id: "E14",
    deck: "event",
    text: "Deine Genossenschaft zahlt dir den Baukredit aus: Ziehe 150 CHF ein.",
    effect: { kind: "gain", amount: 150 },
  },
  {
    id: "E15",
    deck: "event",
    text: "Du gewinnst die Quartier-Tombola: Ziehe 100 CHF ein.",
    effect: { kind: "gain", amount: 100 },
  },
  {
    id: "E16",
    deck: "event",
    text: "Ausflug an den Hauptbahnhof: Rücke vor zum Hauptbahnhof. Kommst du an Start vorbei, ziehst du 200 CHF ein.",
    effect: { kind: "moveTo", space: 5 },
  },
];

export const COMMUNITY_CARDS: readonly Card[] = [
  {
    id: "G01",
    deck: "community",
    text: "Neujahrsapéro im Quartier: Rücke vor auf Start und ziehe 200 CHF ein.",
    effect: { kind: "moveTo", space: 0 },
  },
  {
    id: "G02",
    deck: "community",
    text: "Die Bank hat sich verrechnet, zu deinen Gunsten: Ziehe 200 CHF ein.",
    effect: { kind: "gain", amount: 200 },
  },
  {
    id: "G03",
    deck: "community",
    text: "Zahnarztrechnung: Zahle 50 CHF.",
    effect: { kind: "pay", amount: 50 },
  },
  {
    id: "G04",
    deck: "community",
    text: "Du verkaufst dein altes Velo auf dem Flohmarkt: Ziehe 50 CHF ein.",
    effect: { kind: "gain", amount: 50 },
  },
  {
    id: "G05",
    deck: "community",
    text: "Die Nachbarin kennt die Polizei: Du darfst die Karte «Aus dem Gefängnis frei» behalten, bis du sie brauchst.",
    effect: { kind: "getOutOfJailFree" },
  },
  {
    id: "G06",
    deck: "community",
    text: "Nachtruhe verletzt, Fondue-Party bis 3 Uhr: Gehe direkt ins Gefängnis, nicht über Start, ziehe keine 200 CHF ein.",
    effect: { kind: "goToJail" },
  },
  {
    id: "G07",
    deck: "community",
    text: "Die Quartierfeier war ein Hit: Jeder Mitspieler zahlt dir 50 CHF.",
    effect: { kind: "collectEach", amount: 50 },
  },
  {
    id: "G08",
    deck: "community",
    text: "13. Monatslohn: Ziehe 100 CHF ein.",
    effect: { kind: "gain", amount: 100 },
  },
  {
    id: "G09",
    deck: "community",
    text: "Steuerrückerstattung: Ziehe 20 CHF ein.",
    effect: { kind: "gain", amount: 20 },
  },
  {
    id: "G10",
    deck: "community",
    text: "Du hast Geburtstag: Jeder Mitspieler zahlt dir 10 CHF.",
    effect: { kind: "collectEach", amount: 10 },
  },
  {
    id: "G11",
    deck: "community",
    text: "Deine Lebensversicherung wird fällig: Ziehe 100 CHF ein.",
    effect: { kind: "gain", amount: 100 },
  },
  {
    id: "G12",
    deck: "community",
    text: "Spitalrechnung: Zahle 100 CHF.",
    effect: { kind: "pay", amount: 100 },
  },
  {
    id: "G13",
    deck: "community",
    text: "Klassenlager deiner Kinder: Zahle 50 CHF.",
    effect: { kind: "pay", amount: 50 },
  },
  {
    id: "G14",
    deck: "community",
    text: "Beratungshonorar für einen Auftrag: Ziehe 25 CHF ein.",
    effect: { kind: "gain", amount: 25 },
  },
  {
    id: "G15",
    deck: "community",
    text: "Das Strassenbauamt saniert: 40 CHF pro Haus, 160 CHF pro Hotel.",
    effect: { kind: "repairs", perHouse: 40, perHotel: 160 },
  },
  {
    id: "G16",
    deck: "community",
    text: "Zweiter Platz beim Fondue-Wettessen: Ziehe 10 CHF ein.",
    effect: { kind: "gain", amount: 10 },
  },
];

export const DECK_NAMES: Record<DeckId, string> = {
  event: "Ereigniskarte",
  community: "Gemeindekarte",
};

export const DECK_CARDS: Record<DeckId, readonly Card[]> = {
  event: EVENT_CARDS,
  community: COMMUNITY_CARDS,
};

const CARDS_BY_ID: ReadonlyMap<CardId, Card> = new Map(
  [...EVENT_CARDS, ...COMMUNITY_CARDS].map((card) => [card.id, card]),
);

export function findCard(id: CardId): Card | undefined {
  return CARDS_BY_ID.get(id);
}

export function getCard(id: CardId): Card {
  const card = findCard(id);
  if (!card) throw new Error(`Karte ${id} gibt es nicht.`);
  return card;
}
