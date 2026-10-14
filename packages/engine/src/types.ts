// Datentypen der Engine.
// Alles ist reines JSON (keine Klassen, keine Funktionen, keine Datumsobjekte),
// damit ein Spielstand gespeichert und übers Netz geschickt werden kann.

export type PlayerId = string;
/** Feldnummer 0 bis 39, im Uhrzeigersinn ab Start. */
export type SpaceIndex = number;
export type Dice = [number, number];

export type ColorGroup = "brown" | "lightblue" | "pink" | "orange" | "red" | "yellow" | "green" | "navy";
export type TokenId = "tram" | "swan" | "boeoegg" | "fondue" | "bike" | "coffee";
export type BotLevel = "easy" | "clever";
export type DeckId = "event" | "community";
/** Karten-ID wie in docs/brett.md, z. B. "E08" oder "G05". */
export type CardId = string;

// ---------------------------------------------------------------------------
// Brett
// ---------------------------------------------------------------------------

/** Mieten einer Strasse: [ohne Haus, 1 Haus, 2, 3, 4 Häuser, Hotel]. */
export type StreetRents = readonly [number, number, number, number, number, number];

export interface StreetSpace {
  kind: "street";
  index: SpaceIndex;
  name: string;
  group: ColorGroup;
  price: number;
  rents: StreetRents;
  housePrice: number;
  mortgage: number;
}

export interface StationSpace {
  kind: "station";
  index: SpaceIndex;
  name: string;
  price: number;
  mortgage: number;
}

export interface UtilitySpace {
  kind: "utility";
  index: SpaceIndex;
  name: string;
  price: number;
  mortgage: number;
}

export interface TaxSpace {
  kind: "tax";
  index: SpaceIndex;
  name: string;
  amount: number;
}

export interface SimpleSpace {
  kind: "start" | "jail" | "vacation" | "goToJail" | "event" | "community";
  index: SpaceIndex;
  name: string;
}

/** Felder, die man kaufen kann. */
export type PropertySpace = StreetSpace | StationSpace | UtilitySpace;
export type Space = PropertySpace | TaxSpace | SimpleSpace;
export type SpaceKind = Space["kind"];

// ---------------------------------------------------------------------------
// Karten
// ---------------------------------------------------------------------------

export type CardEffect =
  | { kind: "moveTo"; space: SpaceIndex }
  | { kind: "moveToNearest"; target: "station" | "utility" }
  | { kind: "moveBy"; steps: number }
  | { kind: "gain"; amount: number }
  | { kind: "pay"; amount: number }
  | { kind: "payEach"; amount: number }
  | { kind: "collectEach"; amount: number }
  | { kind: "repairs"; perHouse: number; perHotel: number }
  | { kind: "goToJail" }
  | { kind: "getOutOfJailFree" }
  /** Baubewilligung: behalten, später gratis ein Haus oder Hotel bauen. */
  | { kind: "buildPermit" };

export interface Card {
  id: CardId;
  deck: DeckId;
  text: string;
  effect: CardEffect;
}

// ---------------------------------------------------------------------------
// Spiel erstellen
// ---------------------------------------------------------------------------

export type TurnTimeLimit = 30 | 60 | 90;

export interface GameOptions {
  /** Startkapital in CHF (500 bis 5000, in 100er-Schritten). */
  startMoney: number;
  /** Jackpot bei «Ferien am Zürichsee». */
  jackpot: boolean;
  /** Sekunden pro Zug oder null (kein Zeitlimit). Die Uhr selbst läuft ausserhalb der Engine. */
  turnTimeLimit: TurnTimeLimit | null;
}

export interface PlayerConfig {
  id: PlayerId;
  name: string;
  token: TokenId;
  bot?: BotLevel | null;
}

export interface GameConfig {
  /** Sitzordnung im Uhrzeigersinn. Wer beginnt, wird ausgewürfelt. */
  players: PlayerConfig[];
  options?: Partial<GameOptions>;
}

// ---------------------------------------------------------------------------
// Spielzustand
// ---------------------------------------------------------------------------

export interface PlayerState {
  id: PlayerId;
  name: string;
  token: TokenId;
  bot: BotLevel | null;
  money: number;
  position: SpaceIndex;
  inJail: boolean;
  /** Ausgesessene Züge im Gefängnis (0 oder 1). Nach einem ausgesessenen Zug ist man im nächsten frei. */
  jailTurns: number;
  /** Gehaltene Freikarten («Aus dem Gefängnis frei»). */
  jailCards: CardId[];
  /** Gehaltene Baubewilligungen (gratis ein Haus oder Hotel bauen, nicht handelbar). */
  buildPermits: CardId[];
  bankrupt: boolean;
}

export interface PropertyState {
  owner: PlayerId | null;
  /** 0 = unbebaut, 1–4 = Häuser, 5 = Hotel. Bei Bahnhöfen und Versorgern immer 0. */
  houses: number;
  mortgaged: boolean;
}

/**
 * Phase des Spielers am Zug.
 * - preRoll: vor dem Würfeln (auch nach einem Pasch, dann muss nochmals gewürfelt werden)
 * - buy: Kaufentscheid für ein freies Grundstück
 * - postRoll: nach dem Würfeln, der Zug kann beendet werden
 */
export type TurnPhase = "preRoll" | "buy" | "postRoll";

export interface TurnState {
  phase: TurnPhase;
  /** Pasch in Folge in diesem Zug. Nach einem Pasch bleibt die Phase `preRoll` (nochmals würfeln). */
  doublesCount: number;
  /** Letzter Bewegungswurf in diesem Zug. */
  dice: Dice | null;
  /** Freies Grundstück, über dessen Kauf entschieden wird (Phase buy). */
  pendingBuy: SpaceIndex | null;
}

export const BANK = "bank";
export const JACKPOT = "jackpot";

/** Gläubiger einer Schuld: ein Spieler oder die Bank. */
export type Creditor = PlayerId | typeof BANK;
/** Wer Geld gibt oder bekommt: Spieler, Bank oder Jackpot-Topf. Spieler-IDs dürfen nicht «bank» oder «jackpot» heissen. */
export type MoneyParty = PlayerId | typeof BANK | typeof JACKPOT;

export type DebtReason = "rent" | "tax" | "card" | "jailFine" | "mortgageInterest";

export type MoneyReason =
  | DebtReason
  | "start"
  | "purchase"
  | "build"
  | "sellBuilding"
  | "mortgage"
  | "unmortgage"
  | "trade"
  | "bankruptcy"
  | "jackpot";

/** Offene Zahlung, die der Schuldner nicht sofort bar begleichen konnte. */
export interface Debt {
  debtor: PlayerId;
  creditor: Creditor;
  amount: number;
  reason: DebtReason;
  space: SpaceIndex | null;
}

export interface TradeSide {
  spaces: SpaceIndex[];
  money: number;
  jailCards: CardId[];
}

/** Handelsangebot, wie es ein Spieler abschickt. */
export interface TradeProposal {
  to: PlayerId;
  /** Was der Anbieter hergibt. */
  give: TradeSide;
  /** Was der Anbieter dafür bekommt. */
  take: TradeSide;
  /** Belastete Felder aus `take`, deren Hypothek der Anbieter sofort ablöst. */
  lift?: SpaceIndex[];
}

/** Offenes Handelsangebot im Spielzustand. */
export interface TradeOffer {
  from: PlayerId;
  to: PlayerId;
  give: TradeSide;
  take: TradeSide;
  lift: SpaceIndex[];
}

/** Nach einem Bankrott erhält der Gläubiger belastete Felder und entscheidet: sofort ablösen oder belastet lassen. */
export interface MortgageDecision {
  player: PlayerId;
  spaces: SpaceIndex[];
}

export interface BankState {
  houses: number;
  hotels: number;
}

export interface GameState {
  formatVersion: 1;
  options: GameOptions;
  /** Spieler in Zugreihenfolge. Ausgeschiedene bleiben (mit `bankrupt: true`) in der Liste. */
  players: PlayerState[];
  /** Index in `players`: wer am Zug ist. */
  current: number;
  turnNumber: number;
  turn: TurnState;
  /** Zustand aller kaufbaren Felder, Schlüssel = Feldnummer. */
  properties: Record<SpaceIndex, PropertyState>;
  bank: BankState;
  jackpot: number;
  /** Kartenstapel, oberste Karte = Index 0. */
  decks: Record<DeckId, CardId[]>;
  /** Offene Schulden, werden der Reihe nach beglichen. */
  debts: Debt[];
  mortgageDecision: MortgageDecision | null;
  trade: TradeOffer | null;
  winner: PlayerId | null;
  /** Die letzten Protokolleinträge (höchstens LOG_LIMIT). */
  log: GameEvent[];
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export type Action =
  | { type: "rollDice" }
  | { type: "payJailFine" }
  | { type: "useJailCard" }
  | { type: "buyProperty" }
  | { type: "declineProperty" }
  | { type: "buildHouse"; space: SpaceIndex }
  | { type: "useBuildPermit"; space: SpaceIndex }
  | { type: "sellBuilding"; space: SpaceIndex }
  | { type: "mortgage"; space: SpaceIndex }
  | { type: "unmortgage"; space: SpaceIndex }
  | { type: "proposeTrade"; offer: TradeProposal }
  | { type: "acceptTrade"; lift?: SpaceIndex[] }
  | { type: "rejectTrade" }
  | { type: "cancelTrade" }
  | { type: "resolveMortgages"; lift: SpaceIndex[] }
  | { type: "declareBankruptcy" }
  | { type: "endTurn" }
  | { type: "timeout" };

export type ActionType = Action["type"];

export type ErrorCode =
  | "gameOver"
  | "unknownPlayer"
  | "playerOut"
  | "notYourTurn"
  | "wrongPhase"
  | "notInJail"
  | "inJail"
  | "noJailCard"
  | "noBuildPermit"
  | "notEnoughMoney"
  | "invalidSpace"
  | "notOwner"
  | "invalidAmount"
  | "groupIncomplete"
  | "groupMortgaged"
  | "unevenBuilding"
  | "maxBuildings"
  | "noHousesLeft"
  | "noHotelsLeft"
  | "noBuildings"
  | "alreadyMortgaged"
  | "notMortgaged"
  | "groupHasBuildings"
  | "tradeOpen"
  | "noTrade"
  | "invalidTrade"
  | "emptyTrade"
  | "partnerCannotPay"
  | "canStillPay"
  | "unknownAction";

export interface ActionError {
  code: ErrorCode;
  /** Erklärung für Spieler (de-CH). */
  message: string;
}

// ---------------------------------------------------------------------------
// Protokoll (Ereignisse als Daten, die Oberfläche macht daraus Text)
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: "startOrderRolled"; round: number; rolls: { player: PlayerId; dice: Dice }[] }
  | { type: "gameStarted"; order: PlayerId[] }
  | { type: "turnStarted"; player: PlayerId; turnNumber: number }
  | { type: "diceRolled"; player: PlayerId; dice: Dice; purpose: "move" | "utilityRent" }
  | { type: "moved"; player: PlayerId; from: SpaceIndex; to: SpaceIndex; direction: "forward" | "backward"; passedStart: boolean }
  /** Nach einem Pasch nur durchgefahren: Das Feld zählt nicht, es wird nochmals gewürfelt. */
  | { type: "passedThrough"; player: PlayerId; space: SpaceIndex }
  | { type: "moneyTransferred"; from: MoneyParty; to: MoneyParty; amount: number; reason: MoneyReason; space: SpaceIndex | null }
  | { type: "propertyBought"; player: PlayerId; space: SpaceIndex; price: number }
  | { type: "propertyDeclined"; player: PlayerId; space: SpaceIndex }
  | { type: "cardDrawn"; player: PlayerId; deck: DeckId; card: CardId }
  | { type: "sentToJail"; player: PlayerId; from: SpaceIndex; reason: "space" | "card" | "doubles" }
  /** Im Gefängnis einen Zug ausgesessen (statt Kaution oder Freikarte); im nächsten Zug frei. */
  | { type: "jailTurnServed"; player: PlayerId }
  | { type: "leftJail"; player: PlayerId; method: "fine" | "card" | "served" }
  | { type: "houseBuilt"; player: PlayerId; space: SpaceIndex; level: number }
  | { type: "buildingSold"; player: PlayerId; space: SpaceIndex; fromLevel: number; toLevel: number }
  | { type: "mortgaged"; player: PlayerId; space: SpaceIndex }
  | { type: "unmortgaged"; player: PlayerId; space: SpaceIndex }
  | { type: "debtOpened"; debtor: PlayerId; creditor: Creditor; amount: number; reason: DebtReason }
  | { type: "tradeProposed"; offer: TradeOffer }
  | { type: "tradeAccepted"; offer: TradeOffer; lift: SpaceIndex[] }
  | { type: "tradeRejected"; offer: TradeOffer }
  | { type: "tradeCancelled"; offer: TradeOffer }
  | { type: "propertyTransferred"; space: SpaceIndex; from: PlayerId; to: PlayerId }
  | { type: "propertyReturned"; space: SpaceIndex; from: PlayerId }
  | { type: "jailCardTransferred"; card: CardId; from: PlayerId; to: PlayerId }
  | { type: "jailCardReturned"; card: CardId; from: PlayerId }
  /** Baubewilligung eingesetzt (danach folgt `houseBuilt`); die Karte kommt unter den Stapel. */
  | { type: "buildPermitUsed"; player: PlayerId; card: CardId; space: SpaceIndex }
  /** Baubewilligung eines Ausgeschiedenen geht unter den Stapel. */
  | { type: "buildPermitReturned"; card: CardId; from: PlayerId }
  | { type: "mortgageDecisionRequired"; player: PlayerId; spaces: SpaceIndex[] }
  | { type: "mortgagesResolved"; player: PlayerId; lifted: SpaceIndex[]; kept: SpaceIndex[] }
  | { type: "bankrupt"; player: PlayerId; creditor: Creditor }
  /** Von aussen aus dem Spiel genommen (online: Host entscheidet bei Abwesenheit). Danach folgt `bankrupt` an die Bank. */
  | { type: "playerRemoved"; player: PlayerId }
  | { type: "turnEnded"; player: PlayerId }
  | { type: "timeout"; player: PlayerId }
  | { type: "gameWon"; player: PlayerId };

export type GameEventType = GameEvent["type"];
