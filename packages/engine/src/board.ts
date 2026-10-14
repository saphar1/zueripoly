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
export const STATION_RENTS = [25, 50, 100, 200] as const;
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
  street(1, "Albisrieden", "brown", 60, [5, 25, 45, 140, 240, 380], 50),
  { kind: "community", index: 2, name: "Gemeindekarte" },
  street(3, "Altstetten", "brown", 60, [10, 45, 90, 270, 480, 700], 50),
  { kind: "tax", index: 4, name: "Staats- und Gemeindesteuer", amount: 100 },
  station(5, "Hauptbahnhof"),
  street(6, "Seebach", "lightblue", 100, [10, 45, 130, 380, 550, 750], 50),
  { kind: "event", index: 7, name: "Ereigniskarte" },
  street(8, "Schwamendingen", "lightblue", 100, [10, 45, 130, 380, 550, 750], 50),
  street(9, "Affoltern", "lightblue", 120, [15, 60, 140, 420, 650, 850], 50),
  { kind: "jail", index: 10, name: "Gefängnis" },
  street(11, "Wiedikon", "pink", 140, [15, 65, 200, 600, 800, 1000], 100),
  utility(12, "Stromnetz"),
  street(13, "Wipkingen", "pink", 140, [15, 65, 200, 600, 800, 1000], 100),
  street(14, "Höngg", "pink", 160, [20, 80, 230, 650, 900, 1150], 100),
  station(15, "Stadelhofen"),
  street(16, "Letzigrund", "orange", 180, [20, 90, 250, 700, 950, 1200], 100),
  { kind: "community", index: 17, name: "Gemeindekarte" },
  street(18, "Langstrasse", "orange", 180, [20, 90, 250, 700, 950, 1200], 100),
  street(19, "Zürich West", "orange", 200, [25, 100, 280, 750, 1000, 1250], 100),
  { kind: "vacation", index: 20, name: "Ferien am Zürichsee" },
  street(21, "Niederdorf", "red", 220, [25, 110, 300, 850, 1050, 1300], 150),
  { kind: "event", index: 22, name: "Ereigniskarte" },
  street(23, "Limmatquai", "red", 220, [25, 110, 300, 850, 1050, 1300], 150),
  street(24, "Rennweg", "red", 240, [30, 120, 360, 900, 1100, 1350], 150),
  station(25, "Oerlikon"),
  street(26, "Fluntern", "yellow", 260, [35, 130, 380, 950, 1150, 1400], 150),
  street(27, "Hottingen", "yellow", 260, [35, 130, 380, 950, 1150, 1400], 150),
  utility(28, "Seewasserwerk"),
  street(29, "Hirslanden", "yellow", 280, [40, 140, 410, 1000, 1200, 1450], 150),
  { kind: "goToJail", index: 30, name: "Gehe ins Gefängnis" },
  street(31, "Enge", "green", 300, [45, 150, 430, 1050, 1250, 1500], 200),
  street(32, "Seefeld", "green", 300, [45, 150, 430, 1050, 1250, 1500], 200),
  { kind: "community", index: 33, name: "Gemeindekarte" },
  street(34, "Utoquai", "green", 320, [50, 170, 500, 1100, 1300, 1550], 200),
  station(35, "Hardbrücke"),
  { kind: "event", index: 36, name: "Ereigniskarte" },
  street(37, "Paradeplatz", "navy", 350, [55, 180, 550, 1200, 1400, 1650], 200),
  { kind: "tax", index: 38, name: "Serafe-Rechnung", amount: 50 },
  street(39, "Bahnhofstrasse", "navy", 400, [75, 225, 600, 1400, 1700, 2000], 200),
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
