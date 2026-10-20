// Die 40 Felder gemäss docs/brett.md.
import type {
  ColorGroup,
  PropertySpace,
  Space,
  SpaceIndex,
  StationSpace,
  StreetRents,
  StreetSpace,
  TokenId,
  UtilitySpace,
} from "./types";

export const BOARD_SIZE = 40;
export const START_INDEX = 0;
export const JAIL_INDEX = 10;
export const VACATION_INDEX = 20;
export const GO_TO_JAIL_INDEX = 30;

export const STATION_PRICE = 200;
export const UTILITY_PRICE = 150;
/** Miete bei 1, 2, 3 oder 4 Bahnhöfen im Besitz. */
export const STATION_RENTS = [30, 60, 110, 170] as const;
/** Faktor auf die Augensumme bei 1 oder 2 Versorgern im Besitz. */
export const UTILITY_MULTIPLIERS = [5, 10] as const;

export const COLOR_GROUPS: readonly ColorGroup[] = [
  "brown",
  "lightblue",
  "pink",
  "orange",
  "red",
  "yellow",
  "green",
  "navy",
];

export const GROUP_NAMES: Record<ColorGroup, string> = {
  brown: "Braun",
  lightblue: "Hellblau",
  pink: "Pink",
  orange: "Orange",
  red: "Rot",
  yellow: "Gelb",
  green: "Grün",
  navy: "Dunkelblau",
};

export const TOKENS: readonly TokenId[] = ["tram", "swan", "boeoegg", "fondue", "bike", "coffee"];

export const TOKEN_NAMES: Record<TokenId, string> = {
  tram: "Tram",
  swan: "Schwan",
  boeoegg: "Böögg",
  fondue: "Fondue-Caquelon",
  bike: "Velo",
  coffee: "Kaffeebecher",
};

function street(
  index: SpaceIndex,
  name: string,
  group: ColorGroup,
  price: number,
  rents: StreetRents,
  housePrice: number,
): StreetSpace {
  return { kind: "street", index, name, group, price, rents, housePrice, mortgage: price / 2 };
}

function station(index: SpaceIndex, name: string): StationSpace {
  return { kind: "station", index, name, price: STATION_PRICE, mortgage: STATION_PRICE / 2 };
}

function utility(index: SpaceIndex, name: string): UtilitySpace {
  return { kind: "utility", index, name, price: UTILITY_PRICE, mortgage: UTILITY_PRICE / 2 };
}

export const BOARD: readonly Space[] = [
  { kind: "start", index: 0, name: "Start" },
  street(1, "Albisrieden", "brown", 70, [15, 90, 200, 345, 430, 500], 60),
  { kind: "community", index: 2, name: "Gemeindekarte" },
  street(3, "Altstetten", "brown", 80, [15, 100, 215, 370, 460, 535], 60),
  { kind: "tax", index: 4, name: "Staats- und Gemeindesteuer", amount: 100 },
  station(5, "Hauptbahnhof"),
  street(6, "Seebach", "lightblue", 110, [20, 120, 255, 440, 550, 640], 60),
  { kind: "event", index: 7, name: "Ereigniskarte" },
  street(8, "Schwamendingen", "lightblue", 110, [20, 120, 255, 440, 550, 640], 60),
  street(9, "Affoltern", "lightblue", 130, [25, 130, 280, 485, 605, 700], 60),
  { kind: "jail", index: 10, name: "Gefängnis" },
  street(11, "Wiedikon", "pink", 150, [25, 140, 305, 525, 655, 760], 110),
  utility(12, "Stromnetz"),
  street(13, "Wipkingen", "pink", 150, [25, 140, 305, 525, 655, 760], 110),
  street(14, "Höngg", "pink", 170, [30, 150, 325, 560, 700, 810], 110),
  station(15, "Stadelhofen"),
  street(16, "Letzigrund", "orange", 190, [35, 160, 345, 600, 745, 865], 110),
  { kind: "community", index: 17, name: "Gemeindekarte" },
  street(18, "Langstrasse", "orange", 190, [35, 160, 345, 600, 745, 865], 110),
  street(19, "Zürich West", "orange", 210, [40, 170, 365, 630, 785, 910], 110),
  { kind: "vacation", index: 20, name: "Ferien am Zürichsee" },
  street(21, "Niederdorf", "red", 230, [40, 175, 385, 665, 825, 960], 160),
  { kind: "event", index: 22, name: "Ereigniskarte" },
  street(23, "Limmatquai", "red", 230, [40, 175, 385, 665, 825, 960], 160),
  street(24, "Rennweg", "red", 250, [45, 185, 400, 695, 865, 1005], 160),
  station(25, "Oerlikon"),
  street(26, "Fluntern", "yellow", 270, [50, 195, 420, 725, 900, 1045], 160),
  street(27, "Hottingen", "yellow", 270, [50, 195, 420, 725, 900, 1045], 160),
  utility(28, "Seewasserwerk"),
  street(29, "Hirslanden", "yellow", 290, [50, 200, 435, 755, 940, 1090], 160),
  { kind: "goToJail", index: 30, name: "Gehe ins Gefängnis" },
  street(31, "Enge", "green", 310, [55, 210, 450, 780, 975, 1130], 220),
  street(32, "Seefeld", "green", 310, [55, 210, 450, 780, 975, 1130], 220),
  { kind: "community", index: 33, name: "Gemeindekarte" },
  street(34, "Utoquai", "green", 330, [60, 215, 470, 810, 1010, 1170], 220),
  station(35, "Hardbrücke"),
  { kind: "event", index: 36, name: "Ereigniskarte" },
  street(37, "Paradeplatz", "navy", 360, [65, 225, 490, 850, 1055, 1225], 220),
  { kind: "tax", index: 38, name: "Serafe-Rechnung", amount: 50 },
  street(39, "Bahnhofstrasse", "navy", 400, [75, 240, 520, 900, 1120, 1300], 220),
];

export function isPropertySpace(space: Space): space is PropertySpace {
  return space.kind === "street" || space.kind === "station" || space.kind === "utility";
}

export function isSpaceIndex(value: unknown): value is SpaceIndex {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < BOARD_SIZE;
}

export function getSpace(index: SpaceIndex): Space {
  const space = BOARD[index];
  if (!space) throw new Error(`Feld ${index} gibt es nicht.`);
  return space;
}

/** Kaufbares Feld oder `null`, wenn das Feld nicht kaufbar ist (oder es die Nummer nicht gibt). */
export function findPropertySpace(index: unknown): PropertySpace | null {
  if (!isSpaceIndex(index)) return null;
  const space = getSpace(index);
  return isPropertySpace(space) ? space : null;
}

export function getPropertySpace(index: SpaceIndex): PropertySpace {
  const space = findPropertySpace(index);
  if (!space) throw new Error(`Feld ${index} ist nicht kaufbar.`);
  return space;
}

export function getStreet(index: SpaceIndex): StreetSpace {
  const space = getSpace(index);
  if (space.kind !== "street") throw new Error(`Feld ${index} ist keine Strasse.`);
  return space;
}

export const PROPERTY_INDICES: readonly SpaceIndex[] = BOARD.filter(isPropertySpace).map((s) => s.index);
export const STREET_INDICES: readonly SpaceIndex[] = BOARD.filter((s) => s.kind === "street").map((s) => s.index);
export const STATION_INDICES: readonly SpaceIndex[] = BOARD.filter((s) => s.kind === "station").map((s) => s.index);
export const UTILITY_INDICES: readonly SpaceIndex[] = BOARD.filter((s) => s.kind === "utility").map((s) => s.index);

/** Strassen je Farbgruppe, in Brettreihenfolge. */
export const GROUP_STREETS: Record<ColorGroup, readonly SpaceIndex[]> = {
  brown: streetsOf("brown"),
  lightblue: streetsOf("lightblue"),
  pink: streetsOf("pink"),
  orange: streetsOf("orange"),
  red: streetsOf("red"),
  yellow: streetsOf("yellow"),
  green: streetsOf("green"),
  navy: streetsOf("navy"),
};

function streetsOf(group: ColorGroup): SpaceIndex[] {
  return BOARD.filter((s) => s.kind === "street" && s.group === group).map((s) => s.index);
}
