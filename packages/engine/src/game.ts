// Spielzustand und Aktionen: neuer Zustand = applyAction(alter Zustand, Aktion).
// Der alte Zustand wird nie verändert. Intern wird eine Kopie bearbeitet.
import {
  BOARD_SIZE,
  getPropertySpace,
  getSpace,
  getStreet,
  JAIL_INDEX,
  PROPERTY_INDICES,
  STATION_INDICES,
  TOKENS,
  UTILITY_INDICES,
} from "./board";
import { DECK_CARDS, getCard } from "./cards";
import { rollDice, shuffle, type Rng } from "./random";
import {
  bankSink,
  calculateRent,
  checkMortgage,
  checkSellBuilding,
  countBuildings,
  DEFAULT_OPTIONS,
  findPlayer,
  getActivePlayers,
  getCurrentPlayer,
  getOwnedSpaces,
  getPlayer,
  getProperty,
  HOTEL_LEVEL,
  JAIL_FINE,
  liquidationValue,
  MAX_DOUBLES,
  MAX_JAIL_ROLLS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  mortgageInterest,
  mortgageTransferCost,
  START_MONEY_MAX,
  START_MONEY_MIN,
  START_MONEY_STEP,
  START_SALARY,
  TOTAL_HOTELS,
  TOTAL_HOUSES,
  TURN_TIME_LIMITS,
  unmortgageCost,
} from "./rules";
import {
  BANK,
  JACKPOT,
  type Action,
  type ActionError,
  type AuctionOrigin,
  type Card,
  type Creditor,
  type Debt,
  type DebtReason,
  type DeckId,
  type GameConfig,
  type GameEvent,
  type GameOptions,
  type GameState,
  type MoneyParty,
  type MoneyReason,
  type PlayerId,
  type PlayerState,
  type PropertyState,
  type SpaceIndex,
  type TradeOffer,
  type TradeSide,
  type TurnState,
} from "./types";
import { makeError, validateAction } from "./validate";

/** So viele Protokolleinträge bleiben im Spielzustand. Alle neuen Einträge liefert `applyAction` zusätzlich zurück. */
export const LOG_LIMIT = 200;

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: ActionError };

// ---------------------------------------------------------------------------
// Spiel erstellen
// ---------------------------------------------------------------------------

/** Prüft die Lobby-Einstellungen. Gibt `null` zurück oder eine Fehlermeldung (de-CH). */
export function validateGameConfig(config: GameConfig): string | null {
  const players = config.players;
  if (!Array.isArray(players) || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    return `Es braucht ${MIN_PLAYERS} bis ${MAX_PLAYERS} Spieler.`;
  }
  const ids = new Set<string>();
  const tokens = new Set<string>();
  for (const p of players) {
    if (typeof p.id !== "string" || p.id.trim() === "") return "Jeder Spieler braucht eine ID.";
    if (p.id === BANK || p.id === JACKPOT) return `Die Spieler-ID «${p.id}» ist reserviert.`;
    if (ids.has(p.id)) return "Spieler-IDs müssen eindeutig sein.";
    ids.add(p.id);
    if (typeof p.name !== "string" || p.name.trim() === "") return "Jeder Spieler braucht einen Namen.";
    if (!TOKENS.includes(p.token)) return "Unbekannte Figur.";
    if (tokens.has(p.token)) return "Jede Figur darf nur einmal gewählt werden.";
    tokens.add(p.token);
    if (p.bot != null && p.bot !== "easy" && p.bot !== "clever") return "Unbekannte Stufe für Computergegner.";
  }
  const options = { ...DEFAULT_OPTIONS, ...config.options };
  if (
    !Number.isInteger(options.startMoney) ||
    options.startMoney < START_MONEY_MIN ||
    options.startMoney > START_MONEY_MAX ||
    options.startMoney % START_MONEY_STEP !== 0
  ) {
    return `Das Startkapital muss zwischen ${START_MONEY_MIN} und ${START_MONEY_MAX} CHF liegen (in ${START_MONEY_STEP}er-Schritten).`;
  }
  if (typeof options.jackpot !== "boolean") return "Die Jackpot-Option ist ungültig.";
  if (options.turnTimeLimit !== null && !TURN_TIME_LIMITS.includes(options.turnTimeLimit)) {
    return "Das Zeitlimit muss 30, 60 oder 90 Sekunden betragen.";
  }
  return null;
}

/**
 * Erstellt ein neues Spiel: Startreihenfolge auswürfeln, Kartenstapel mischen.
 * Wirft einen Fehler, wenn die Einstellungen ungültig sind (vorher `validateGameConfig` nutzen).
 */
export function createGame(config: GameConfig, rng: Rng): GameState {
  const problem = validateGameConfig(config);
  if (problem !== null) throw new Error(problem);
  const options: GameOptions = { ...DEFAULT_OPTIONS, ...config.options };
  const events: GameEvent[] = [];

  // Startreihenfolge: höchste Augensumme beginnt, bei Gleichstand würfeln nur die Gleichen neu.
  let contenders = config.players.map((p) => p.id);
  for (let round = 1; contenders.length > 1; round++) {
    const rolls = contenders.map((player) => ({ player, dice: rollDice(rng) }));
    events.push({ type: "startOrderRolled", round, rolls });
    const best = Math.max(...rolls.map((r) => r.dice[0] + r.dice[1]));
    contenders = rolls.filter((r) => r.dice[0] + r.dice[1] === best).map((r) => r.player);
  }
  // Danach im Uhrzeigersinn, also in Sitzordnung ab dem Startspieler.
  const starter = config.players.findIndex((p) => p.id === contenders[0]);
  const seating = [...config.players.slice(starter), ...config.players.slice(0, starter)];

  const players: PlayerState[] = seating.map((p) => ({
    id: p.id,
    name: p.name.trim(),
    token: p.token,
    bot: p.bot ?? null,
    money: options.startMoney,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailCards: [],
    bankrupt: false,
  }));

  const properties: Record<SpaceIndex, PropertyState> = {};
  for (const index of PROPERTY_INDICES) properties[index] = { owner: null, houses: 0, mortgaged: false };

  const state: GameState = {
    formatVersion: 1,
    options,
    players,
    current: 0,
    turnNumber: 1,
    turn: freshTurn(),
    properties,
    bank: { houses: TOTAL_HOUSES, hotels: TOTAL_HOTELS },
    jackpot: 0,
    decks: {
      event: shuffle(DECK_CARDS.event.map((c) => c.id), rng),
      community: shuffle(DECK_CARDS.community.map((c) => c.id), rng),
    },
    auction: null,
    auctionQueue: [],
    debts: [],
    mortgageDecision: null,
    trade: null,
    winner: null,
    log: [],
  };
  events.push({ type: "gameStarted", order: players.map((p) => p.id) });
  events.push({ type: "turnStarted", player: getCurrentPlayer(state).id, turnNumber: 1 });
  state.log = events.slice(-LOG_LIMIT);
  return state;
}

function freshTurn(): TurnState {
  return { phase: "preRoll", doublesCount: 0, extraRoll: false, dice: null, pendingBuy: null };
}

// ---------------------------------------------------------------------------
// Aktionen anwenden
// ---------------------------------------------------------------------------

/** Arbeitskopie während einer Aktion. */
interface Ctx {
  s: GameState;
  rng: Rng;
  events: GameEvent[];
}

/**
 * Führt eine Aktion aus. Ist sie ungültig, kommt `{ ok: false, error }` zurück und nichts ändert sich.
 * `rng` liefert die Würfel (nur nötig, wenn gewürfelt wird).
 */
export function applyAction(state: GameState, playerId: PlayerId, action: Action, rng: Rng): ActionResult {
  const error = validateAction(state, playerId, action);
  if (error) return { ok: false, error };
  const ctx: Ctx = { s: cloneState(state), rng, events: [] };
  perform(ctx, playerId, action);
  settle(ctx);
  ctx.s.log = [...state.log, ...ctx.events].slice(-LOG_LIMIT);
  return { ok: true, state: ctx.s, events: ctx.events };
}

function cloneState(state: GameState): GameState {
  const { log, ...rest } = state;
  const copy = JSON.parse(JSON.stringify(rest)) as Omit<GameState, "log">;
  return { ...copy, log };
}

function emit(ctx: Ctx, event: GameEvent): void {
  ctx.events.push(event);
}

function perform(ctx: Ctx, playerId: PlayerId, action: Action): void {
  const player = getPlayer(ctx.s, playerId);
  switch (action.type) {
    case "rollDice":
      return roll(ctx);
    case "payJailFine":
      transfer(ctx, player.id, bankSink(ctx.s, "jailFine"), JAIL_FINE, "jailFine");
      return leaveJail(ctx, player, "fine");
    case "useJailCard":
      return useJailCard(ctx, player);
    case "buyProperty":
      return buyProperty(ctx, player);
    case "declineProperty":
      return declineProperty(ctx, player);
    case "bid":
      return placeBid(ctx, player, action.amount);
    case "passBid":
      return passBid(ctx, player);
    case "buildHouse":
      return buildHouse(ctx, player, action.space);
    case "sellBuilding":
      return sellBuilding(ctx, player, action.space);
    case "mortgage":
      return mortgage(ctx, player, action.space);
    case "unmortgage":
      return unmortgage(ctx, player, action.space);
    case "proposeTrade": {
      // Nur die bekannten Felder kopieren: Das Angebot kommt evtl. übers Netz und darf den Zustand nicht mitbenutzen.
      const { to, give, take, lift } = action.offer;
      const copySide = (side: TradeSide): TradeSide => ({
        spaces: [...side.spaces],
        money: side.money,
        jailCards: [...side.jailCards],
      });
      const offer: TradeOffer = { from: player.id, to, give: copySide(give), take: copySide(take), lift: [...(lift ?? [])] };
      ctx.s.trade = offer;
      return emit(ctx, { type: "tradeProposed", offer });
    }
    case "acceptTrade":
      return acceptTrade(ctx, [...(action.lift ?? [])]);
    case "rejectTrade":
      return closeTrade(ctx, "tradeRejected");
    case "cancelTrade":
      return closeTrade(ctx, "tradeCancelled");
    case "resolveMortgages":
      return resolveMortgages(ctx, player, action.lift);
    case "declareBankruptcy": {
      const debt = ctx.s.debts[0];
      if (!debt) throw new Error("Bankrott ohne Schuld.");
      return goBankrupt(ctx, player, debt.creditor, debt.reason);
    }
    case "endTurn":
      emit(ctx, { type: "turnEnded", player: player.id });
      return advanceTurn(ctx);
    case "timeout":
      emit(ctx, { type: "timeout", player: player.id });
      return performTimeout(ctx, player);
  }
}

// ---------------------------------------------------------------------------
// Geld und Schulden
// ---------------------------------------------------------------------------

function transfer(
  ctx: Ctx,
  from: MoneyParty,
  to: MoneyParty,
  amount: number,
  reason: MoneyReason,
  space: SpaceIndex | null = null,
): void {
  if (amount <= 0) return;
  adjustMoney(ctx.s, from, -amount);
  adjustMoney(ctx.s, to, amount);
  emit(ctx, { type: "moneyTransferred", from, to, amount, reason, space });
}

function adjustMoney(s: GameState, party: MoneyParty, delta: number): void {
  if (party === BANK) return; // Die Bank hat unbegrenzt Geld.
  if (party === JACKPOT) {
    s.jackpot += delta;
    if (s.jackpot < 0) throw new Error("Interner Fehler: Jackpot negativ.");
    return;
  }
  const player = getPlayer(s, party);
  player.money += delta;
  if (player.money < 0) throw new Error(`Interner Fehler: negatives Guthaben bei ${player.id}.`);
}

/** Verbucht eine Zahlungspflicht. Ist genug Bargeld da (und keine ältere Schuld offen), wird sofort bezahlt. */
function addDebt(
  ctx: Ctx,
  debtor: PlayerState,
  creditor: Creditor,
  amount: number,
  reason: DebtReason,
  space: SpaceIndex | null = null,
): void {
  if (amount <= 0) return;
  const debt: Debt = { debtor: debtor.id, creditor, amount, reason, space };
  if (ctx.s.debts.length === 0 && debtor.money >= amount) {
    payDebt(ctx, debt);
  } else {
    ctx.s.debts.push(debt);
    emit(ctx, { type: "debtOpened", debtor: debtor.id, creditor, amount, reason });
  }
}

function payDebt(ctx: Ctx, debt: Debt): void {
  const to = debt.creditor === BANK ? bankSink(ctx.s, debt.reason) : debt.creditor;
  transfer(ctx, debt.debtor, to, debt.amount, debt.reason, debt.space);
}

// ---------------------------------------------------------------------------
// Würfeln und Ziehen
// ---------------------------------------------------------------------------

function roll(ctx: Ctx): void {
  const s = ctx.s;
  const player = getCurrentPlayer(s);
  const turn = s.turn;
  const dice = rollDice(ctx.rng);
  const doubles = dice[0] === dice[1];
  turn.dice = dice;
  emit(ctx, { type: "diceRolled", player: player.id, dice, purpose: player.inJail ? "jail" : "move" });

  if (player.inJail) {
    if (doubles) {
      // Pasch im Gefängnis: frei und ziehen, aber kein weiterer Wurf.
      leaveJail(ctx, player, "doubles");
    } else {
      player.jailTurns += 1;
      emit(ctx, { type: "jailRollFailed", player: player.id, attempt: player.jailTurns });
      if (player.jailTurns < MAX_JAIL_ROLLS) {
        turn.phase = "postRoll";
        return;
      }
      // Dritter Fehlversuch: 50 CHF zahlen und mit diesem Wurf ziehen.
      addDebt(ctx, player, BANK, JAIL_FINE, "jailFine");
      leaveJail(ctx, player, "forcedFine");
    }
    turn.extraRoll = false;
  } else if (doubles) {
    turn.doublesCount += 1;
    if (turn.doublesCount >= MAX_DOUBLES) {
      sendToJail(ctx, player, "doubles");
      finishMove(ctx);
      return;
    }
    turn.extraRoll = true;
  } else {
    turn.extraRoll = false;
  }

  moveForward(ctx, player, dice[0] + dice[1]);
  landOn(ctx, player, "normal");
  finishMove(ctx);
}

/** Nach dem Auswerten eines Feldes: Kaufentscheid, nochmals würfeln oder Zug beenden. */
function finishMove(ctx: Ctx): void {
  const turn = ctx.s.turn;
  const player = getCurrentPlayer(ctx.s);
  if (player.inJail) {
    turn.phase = "postRoll";
    turn.extraRoll = false;
    turn.pendingBuy = null;
    return;
  }
  if (turn.pendingBuy !== null) {
    turn.phase = "buy";
    return;
  }
  continueTurn(turn);
}

function continueTurn(turn: TurnState): void {
  turn.phase = turn.extraRoll ? "preRoll" : "postRoll";
  turn.extraRoll = false;
}

function moveForward(ctx: Ctx, player: PlayerState, steps: number): void {
  const from = player.position;
  const to = (from + steps) % BOARD_SIZE;
  const passedStart = from + steps >= BOARD_SIZE;
  player.position = to;
  emit(ctx, { type: "moved", player: player.id, from, to, direction: "forward", passedStart });
  if (passedStart) transfer(ctx, BANK, player.id, START_SALARY, "start");
}

/** Vorrücken bis zum Zielfeld (Karte). Wer dabei Start überquert oder darauf landet, erhält 200 CHF. */
function advanceTo(ctx: Ctx, player: PlayerState, target: SpaceIndex): void {
  const steps = (target - player.position + BOARD_SIZE) % BOARD_SIZE || BOARD_SIZE;
  moveForward(ctx, player, steps);
}

function moveBackward(ctx: Ctx, player: PlayerState, steps: number): void {
  const from = player.position;
  const to = (((from - steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  player.position = to;
  emit(ctx, { type: "moved", player: player.id, from, to, direction: "backward", passedStart: false });
}

function sendToJail(ctx: Ctx, player: PlayerState, reason: "space" | "card" | "doubles"): void {
  const from = player.position;
  player.position = JAIL_INDEX;
  player.inJail = true;
  player.jailTurns = 0;
  ctx.s.turn.extraRoll = false;
  ctx.s.turn.pendingBuy = null;
  emit(ctx, { type: "sentToJail", player: player.id, from, reason });
}

function leaveJail(ctx: Ctx, player: PlayerState, method: "fine" | "card" | "doubles" | "forcedFine"): void {
  player.inJail = false;
  player.jailTurns = 0;
  emit(ctx, { type: "leftJail", player: player.id, method });
}

function useJailCard(ctx: Ctx, player: PlayerState): void {
  const card = player.jailCards.shift();
  if (!card) throw new Error("Keine Freikarte vorhanden.");
  ctx.s.decks[getCard(card).deck].push(card);
  emit(ctx, { type: "jailCardReturned", card, from: player.id });
  leaveJail(ctx, player, "card");
}

/** Wie ein Feld nach einer Bewegung ausgewertet wird. Karten verändern die Miete. */
type Landing = "normal" | "cardStation" | "cardUtility";

function landOn(ctx: Ctx, player: PlayerState, landing: Landing): void {
  const s = ctx.s;
  const space = getSpace(player.position);
  switch (space.kind) {
    case "street":
    case "station":
    case "utility": {
      const property = getProperty(s, space.index);
      if (property.owner === null) {
        s.turn.pendingBuy = space.index;
        return;
      }
      if (property.owner === player.id || property.mortgaged) return;
      let rent: number;
      if (space.kind === "utility" && landing === "cardUtility") {
        // Karte «Strom fällt aus»: neu würfeln und das 10-Fache zahlen.
        const dice = rollDice(ctx.rng);
        emit(ctx, { type: "diceRolled", player: player.id, dice, purpose: "utilityRent" });
        rent = 10 * (dice[0] + dice[1]);
      } else {
        const dice = s.turn.dice ?? [0, 0];
        rent = calculateRent(s, space.index, dice[0] + dice[1]);
        if (space.kind === "station" && landing === "cardStation") rent *= 2;
      }
      return addDebt(ctx, player, property.owner, rent, "rent", space.index);
    }
    case "tax":
      return addDebt(ctx, player, BANK, space.amount, "tax", space.index);
    case "event":
      return drawCard(ctx, player, "event");
    case "community":
      return drawCard(ctx, player, "community");
    case "goToJail":
      return sendToJail(ctx, player, "space");
    case "vacation":
      if (s.options.jackpot) transfer(ctx, JACKPOT, player.id, s.jackpot, "jackpot");
      return;
    case "start":
    case "jail":
      return;
  }
}

// ---------------------------------------------------------------------------
// Karten
// ---------------------------------------------------------------------------

function drawCard(ctx: Ctx, player: PlayerState, deck: DeckId): void {
  const id = ctx.s.decks[deck].shift();
  if (!id) throw new Error(`Der Stapel ${deck} ist leer.`);
  const card = getCard(id);
  emit(ctx, { type: "cardDrawn", player: player.id, deck, card: id });
  // Die Karte kommt gleich unter den Stapel, ausser der Spieler behält sie (Freikarte).
  if (card.effect.kind === "getOutOfJailFree") player.jailCards.push(id);
  else ctx.s.decks[deck].push(id);
  applyCard(ctx, player, card);
}

function applyCard(ctx: Ctx, player: PlayerState, card: Card): void {
  const effect = card.effect;
  switch (effect.kind) {
    case "moveTo":
      advanceTo(ctx, player, effect.space);
      return landOn(ctx, player, "normal");
    case "moveToNearest": {
      const targets = effect.target === "station" ? STATION_INDICES : UTILITY_INDICES;
      const target = nearestAhead(player.position, targets);
      advanceTo(ctx, player, target);
      return landOn(ctx, player, effect.target === "station" ? "cardStation" : "cardUtility");
    }
    case "moveBy":
      if (effect.steps < 0) moveBackward(ctx, player, -effect.steps);
      else moveForward(ctx, player, effect.steps);
      return landOn(ctx, player, "normal");
    case "gain":
      return transfer(ctx, BANK, player.id, effect.amount, "card");
    case "pay":
      return addDebt(ctx, player, BANK, effect.amount, "card");
    case "payEach":
      for (const other of othersInTurnOrder(ctx.s, player.id)) addDebt(ctx, player, other.id, effect.amount, "card");
      return;
    case "collectEach":
      for (const other of othersInTurnOrder(ctx.s, player.id)) addDebt(ctx, other, player.id, effect.amount, "card");
      return;
    case "repairs": {
      const { houses, hotels } = countBuildings(ctx.s, player.id);
      return addDebt(ctx, player, BANK, houses * effect.perHouse + hotels * effect.perHotel, "card");
    }
    case "goToJail":
      return sendToJail(ctx, player, "card");
    case "getOutOfJailFree":
      return;
  }
}

function nearestAhead(position: SpaceIndex, targets: readonly SpaceIndex[]): SpaceIndex {
  for (let step = 1; step <= BOARD_SIZE; step++) {
    const index = (position + step) % BOARD_SIZE;
    if (targets.includes(index)) return index;
  }
  throw new Error("Kein Zielfeld gefunden.");
}

/** Alle anderen Spieler im Spiel, beginnend beim nächsten in Zugreihenfolge. */
function othersInTurnOrder(s: GameState, playerId: PlayerId): PlayerState[] {
  const start = s.players.findIndex((p) => p.id === playerId);
  const result: PlayerState[] = [];
  for (let i = 1; i < s.players.length; i++) {
    const other = s.players[(start + i) % s.players.length];
    if (other && !other.bankrupt) result.push(other);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Kaufen und Versteigern
// ---------------------------------------------------------------------------

function buyProperty(ctx: Ctx, player: PlayerState): void {
  const turn = ctx.s.turn;
  const space = getPropertySpace(turn.pendingBuy as SpaceIndex);
  transfer(ctx, player.id, BANK, space.price, "purchase", space.index);
  getProperty(ctx.s, space.index).owner = player.id;
  emit(ctx, { type: "propertyBought", player: player.id, space: space.index, price: space.price });
  turn.pendingBuy = null;
  continueTurn(turn);
}

function declineProperty(ctx: Ctx, player: PlayerState): void {
  const turn = ctx.s.turn;
  const space = turn.pendingBuy as SpaceIndex;
  emit(ctx, { type: "propertyDeclined", player: player.id, space });
  turn.pendingBuy = null;
  continueTurn(turn);
  startAuction(ctx, space, "declined");
}

/** Alle Spieler im Spiel bieten, beginnend links vom Spieler am Zug. Der Spieler am Zug bietet zuletzt. */
function startAuction(ctx: Ctx, space: SpaceIndex, origin: AuctionOrigin): void {
  const s = ctx.s;
  const bidders: PlayerId[] = [];
  for (let i = 1; i <= s.players.length; i++) {
    const p = s.players[(s.current + i) % s.players.length];
    if (p && !p.bankrupt) bidders.push(p.id);
  }
  s.auction = { space, origin, bidders, next: 0, highestBid: 0, highestBidder: null };
  emit(ctx, { type: "auctionStarted", space, origin, bidders: [...bidders] });
}

function placeBid(ctx: Ctx, player: PlayerState, amount: number): void {
  const auction = ctx.s.auction;
  if (!auction) throw new Error("Keine Versteigerung.");
  auction.highestBid = amount;
  auction.highestBidder = player.id;
  emit(ctx, { type: "bidPlaced", player: player.id, space: auction.space, amount });
  auction.next = (auction.next + 1) % auction.bidders.length;
  checkAuctionEnd(ctx);
}

function passBid(ctx: Ctx, player: PlayerState): void {
  const auction = ctx.s.auction;
  if (!auction) throw new Error("Keine Versteigerung.");
  auction.bidders.splice(auction.next, 1);
  if (auction.next >= auction.bidders.length) auction.next = 0;
  emit(ctx, { type: "bidPassed", player: player.id, space: auction.space });
  checkAuctionEnd(ctx);
}

function checkAuctionEnd(ctx: Ctx): void {
  const s = ctx.s;
  const auction = s.auction;
  if (!auction) return;
  if (auction.bidders.length === 0) {
    emit(ctx, { type: "auctionUnsold", space: auction.space });
    s.auction = null;
    return;
  }
  const winner = auction.highestBidder;
  if (winner !== null && auction.bidders.length === 1 && auction.bidders[0] === winner) {
    transfer(ctx, winner, BANK, auction.highestBid, "auction", auction.space);
    getProperty(s, auction.space).owner = winner;
    emit(ctx, { type: "auctionWon", player: winner, space: auction.space, amount: auction.highestBid });
    s.auction = null;
  }
}

// ---------------------------------------------------------------------------
// Bauen, Verkaufen, Hypotheken
// ---------------------------------------------------------------------------

function buildHouse(ctx: Ctx, player: PlayerState, index: SpaceIndex): void {
  const s = ctx.s;
  const space = getStreet(index);
  const property = getProperty(s, index);
  if (property.houses === HOTEL_LEVEL - 1) {
    // Hotel: die 4 Häuser gehen zurück an die Bank.
    s.bank.hotels -= 1;
    s.bank.houses += HOTEL_LEVEL - 1;
  } else {
    s.bank.houses -= 1;
  }
  property.houses += 1;
  transfer(ctx, player.id, BANK, space.housePrice, "build", index);
  emit(ctx, { type: "houseBuilt", player: player.id, space: index, level: property.houses });
}

function sellBuilding(ctx: Ctx, player: PlayerState, index: SpaceIndex): void {
  const s = ctx.s;
  const space = getStreet(index);
  const property = getProperty(s, index);
  const half = space.housePrice / 2;
  const fromLevel = property.houses;
  let refund = half;
  if (fromLevel === HOTEL_LEVEL) {
    s.bank.hotels += 1;
    if (s.bank.houses >= HOTEL_LEVEL - 1) {
      // Hotel wird zu 4 Häusern zurückgebaut.
      s.bank.houses -= HOTEL_LEVEL - 1;
      property.houses = HOTEL_LEVEL - 1;
    } else {
      // Zu wenig Häuser in der Bank: Hotel wird ganz abgerissen (Wert von 5 Bauten).
      property.houses = 0;
      refund = half * HOTEL_LEVEL;
    }
  } else {
    s.bank.houses += 1;
    property.houses -= 1;
  }
  emit(ctx, { type: "buildingSold", player: player.id, space: index, fromLevel, toLevel: property.houses });
  transfer(ctx, BANK, player.id, refund, "sellBuilding", index);
}

function mortgage(ctx: Ctx, player: PlayerState, index: SpaceIndex): void {
  getProperty(ctx.s, index).mortgaged = true;
  emit(ctx, { type: "mortgaged", player: player.id, space: index });
  transfer(ctx, BANK, player.id, getPropertySpace(index).mortgage, "mortgage", index);
}

function unmortgage(ctx: Ctx, player: PlayerState, index: SpaceIndex): void {
  transfer(ctx, player.id, BANK, unmortgageCost(getPropertySpace(index)), "unmortgage", index);
  getProperty(ctx.s, index).mortgaged = false;
  emit(ctx, { type: "unmortgaged", player: player.id, space: index });
}

/**
 * Belastete Felder, die ein Spieler erhalten hat: sofort ablösen (Hypothek + 10 %)
 * oder belastet lassen (nur 10 % Zins).
 */
function payForMortgagedSpaces(ctx: Ctx, player: PlayerState, spaces: SpaceIndex[], lift: SpaceIndex[]): void {
  for (const index of spaces) {
    const property = getProperty(ctx.s, index);
    if (!property.mortgaged) continue;
    const space = getPropertySpace(index);
    if (lift.includes(index)) {
      transfer(ctx, player.id, BANK, mortgageTransferCost(space, true), "unmortgage", index);
      property.mortgaged = false;
      emit(ctx, { type: "unmortgaged", player: player.id, space: index });
    } else {
      transfer(ctx, player.id, BANK, mortgageTransferCost(space, false), "mortgageInterest", index);
    }
  }
}

function resolveMortgages(ctx: Ctx, player: PlayerState, lift: SpaceIndex[]): void {
  const decision = ctx.s.mortgageDecision;
  if (!decision) throw new Error("Kein Hypothekenentscheid offen.");
  ctx.s.mortgageDecision = null;
  const lifted = decision.spaces.filter((i) => lift.includes(i));
  const kept = decision.spaces.filter((i) => !lift.includes(i));
  for (const index of lifted) {
    transfer(ctx, player.id, BANK, unmortgageCost(getPropertySpace(index)), "unmortgage", index);
    getProperty(ctx.s, index).mortgaged = false;
    emit(ctx, { type: "unmortgaged", player: player.id, space: index });
  }
  emit(ctx, { type: "mortgagesResolved", player: player.id, lifted, kept });
  const interest = kept.reduce((sum, i) => sum + mortgageInterest(getPropertySpace(i)), 0);
  addDebt(ctx, player, BANK, interest, "mortgageInterest");
}

// ---------------------------------------------------------------------------
// Handel
// ---------------------------------------------------------------------------

function acceptTrade(ctx: Ctx, lift: SpaceIndex[]): void {
  const s = ctx.s;
  const offer = s.trade;
  if (!offer) throw new Error("Kein Handelsangebot offen.");
  const from = getPlayer(s, offer.from);
  const to = getPlayer(s, offer.to);
  s.trade = null;
  emit(ctx, { type: "tradeAccepted", offer, lift });

  transfer(ctx, from.id, to.id, offer.give.money, "trade");
  transfer(ctx, to.id, from.id, offer.take.money, "trade");
  for (const index of offer.give.spaces) moveProperty(ctx, index, from, to);
  for (const index of offer.take.spaces) moveProperty(ctx, index, to, from);
  for (const card of offer.give.jailCards) moveJailCard(ctx, card, from, to);
  for (const card of offer.take.jailCards) moveJailCard(ctx, card, to, from);
  payForMortgagedSpaces(ctx, to, offer.give.spaces, lift);
  payForMortgagedSpaces(ctx, from, offer.take.spaces, offer.lift);
}

function closeTrade(ctx: Ctx, type: "tradeRejected" | "tradeCancelled"): void {
  const offer = ctx.s.trade;
  if (!offer) throw new Error("Kein Handelsangebot offen.");
  ctx.s.trade = null;
  emit(ctx, { type, offer });
}

function moveProperty(ctx: Ctx, index: SpaceIndex, from: PlayerState, to: PlayerState): void {
  getProperty(ctx.s, index).owner = to.id;
  emit(ctx, { type: "propertyTransferred", space: index, from: from.id, to: to.id });
}

function moveJailCard(ctx: Ctx, card: string, from: PlayerState, to: PlayerState): void {
  from.jailCards = from.jailCards.filter((c) => c !== card);
  to.jailCards.push(card);
  emit(ctx, { type: "jailCardTransferred", card, from: from.id, to: to.id });
}

// ---------------------------------------------------------------------------
// Bankrott
// ---------------------------------------------------------------------------

function goBankrupt(ctx: Ctx, player: PlayerState, creditor: Creditor, reason: DebtReason): void {
  const s = ctx.s;
  emit(ctx, { type: "bankrupt", player: player.id, creditor });
  const owned = getOwnedSpaces(s, player.id);

  // Gebäude gehen an die Bank zurück. Bei einem Gläubiger-Spieler wird dafür der halbe Hauspreis bezahlt.
  for (const index of owned) {
    const property = getProperty(s, index);
    if (property.houses === 0) continue;
    const fromLevel = property.houses;
    const value = fromLevel * (getStreet(index).housePrice / 2);
    if (fromLevel === HOTEL_LEVEL) s.bank.hotels += 1;
    else s.bank.houses += fromLevel;
    property.houses = 0;
    emit(ctx, { type: "buildingSold", player: player.id, space: index, fromLevel, toLevel: 0 });
    if (creditor !== BANK) transfer(ctx, BANK, player.id, value, "sellBuilding", index);
  }

  if (creditor !== BANK) {
    const receiver = getPlayer(s, creditor);
    transfer(ctx, player.id, receiver.id, player.money, "bankruptcy");
    const mortgaged: SpaceIndex[] = [];
    for (const index of owned) {
      moveProperty(ctx, index, player, receiver);
      if (getProperty(s, index).mortgaged) mortgaged.push(index);
    }
    for (const card of [...player.jailCards]) moveJailCard(ctx, card, player, receiver);
    if (mortgaged.length > 0) {
      s.mortgageDecision = { player: receiver.id, spaces: mortgaged };
      emit(ctx, { type: "mortgageDecisionRequired", player: receiver.id, spaces: mortgaged });
    }
  } else {
    transfer(ctx, player.id, bankSink(s, reason), player.money, "bankruptcy");
    for (const index of owned) {
      const property = getProperty(s, index);
      property.owner = null;
      property.mortgaged = false;
      emit(ctx, { type: "propertyReturned", space: index, from: player.id });
      s.auctionQueue.push(index);
    }
    for (const card of player.jailCards) {
      s.decks[getCard(card).deck].push(card);
      emit(ctx, { type: "jailCardReturned", card, from: player.id });
    }
    player.jailCards = [];
  }

  player.bankrupt = true;
  player.inJail = false;
  player.jailTurns = 0;
  s.debts = s.debts.filter((d) => d.debtor !== player.id && d.creditor !== player.id);
}

// ---------------------------------------------------------------------------
// Spieler aus dem Spiel nehmen (Eingriff von aussen, kein Spielzug)
// ---------------------------------------------------------------------------

/** Beim Entfernen wird nie gewürfelt oder gemischt. */
const NO_RANDOM: Rng = {
  nextInt(): number {
    throw new Error("Interner Fehler: Beim Entfernen eines Spielers wird nicht gewürfelt.");
  },
};

/**
 * Nimmt einen Spieler aus dem Spiel, auch wenn das Spiel gerade nicht auf ihn wartet
 * (online: Der Host entscheidet so, wenn jemand nicht zurückkommt).
 * Sein offenes Handelsangebot verfällt, er scheidet aus einer Versteigerung aus (war er Höchstbietender,
 * gilt sein Gebot nicht mehr), ein Hypothekenentscheid von ihm verfällt. Danach geht er bankrott an die Bank:
 * Gebäude zurück, Bargeld an die Bank, seine Felder werden versteigert, Schulden von und an ihn verfallen.
 */
export function removePlayer(state: GameState, playerId: PlayerId): ActionResult {
  if (state.winner !== null) return { ok: false, error: makeError("gameOver") };
  const target = findPlayer(state, playerId);
  if (!target) return { ok: false, error: makeError("unknownPlayer") };
  if (target.bankrupt) return { ok: false, error: makeError("playerOut") };

  const ctx: Ctx = { s: cloneState(state), rng: NO_RANDOM, events: [] };
  const s = ctx.s;
  const player = getPlayer(s, playerId);
  emit(ctx, { type: "playerRemoved", player: player.id });

  if (s.trade && (s.trade.from === player.id || s.trade.to === player.id)) {
    closeTrade(ctx, s.trade.from === player.id ? "tradeCancelled" : "tradeRejected");
  }
  if (s.mortgageDecision?.player === player.id) s.mortgageDecision = null;

  const auction = s.auction;
  if (auction) {
    const seat = auction.bidders.indexOf(player.id);
    if (seat >= 0) {
      auction.bidders.splice(seat, 1);
      if (seat < auction.next) auction.next -= 1;
      if (auction.next >= auction.bidders.length) auction.next = 0;
    }
    if (auction.highestBidder === player.id) {
      auction.highestBid = 0;
      auction.highestBidder = null;
    }
    checkAuctionEnd(ctx);
  }

  // «rent» als Grund: Das Geld geht an die Bank, nie in den Jackpot.
  goBankrupt(ctx, player, BANK, "rent");
  settle(ctx);
  ctx.s.log = [...state.log, ...ctx.events].slice(-LOG_LIMIT);
  return { ok: true, state: ctx.s, events: ctx.events };
}

// ---------------------------------------------------------------------------
// Zeitlimit: eine Standardaktion für den Spieler, auf den gewartet wird
// ---------------------------------------------------------------------------

function performTimeout(ctx: Ctx, player: PlayerState): void {
  const s = ctx.s;
  if (s.trade) return closeTrade(ctx, "tradeRejected");
  if (s.mortgageDecision) return resolveMortgages(ctx, player, []);
  const debt = s.debts[0];
  if (debt) {
    if (player.money + liquidationValue(s, player.id) >= debt.amount) return raiseMoney(ctx, player, debt.amount);
    return goBankrupt(ctx, player, debt.creditor, debt.reason);
  }
  if (s.auction) return passBid(ctx, player);
  switch (s.turn.phase) {
    case "preRoll":
      return roll(ctx);
    case "buy":
      return declineProperty(ctx, player);
    case "postRoll":
      emit(ctx, { type: "turnEnded", player: player.id });
      return advanceTurn(ctx);
  }
}

/**
 * Treibt automatisch Geld auf, bis `target` erreicht ist:
 * zuerst Felder ohne Gebäude belasten (billigste zuerst), dann Gebäude gleichmässig verkaufen.
 */
function raiseMoney(ctx: Ctx, player: PlayerState, target: number): void {
  const s = ctx.s;
  while (player.money < target) {
    const owned = getOwnedSpaces(s, player.id);
    const toMortgage = owned
      .filter((i) => checkMortgage(s, player.id, i) === null)
      .sort((a, b) => getPropertySpace(a).mortgage - getPropertySpace(b).mortgage)[0];
    if (toMortgage !== undefined) {
      mortgage(ctx, player, toMortgage);
      continue;
    }
    const toSell = owned.filter((i) => checkSellBuilding(s, player.id, i) === null).pop();
    if (toSell !== undefined) {
      sellBuilding(ctx, player, toSell);
      continue;
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Nach jeder Aktion: Schulden begleichen, Versteigerungen starten, Zug weitergeben, Gewinner
// ---------------------------------------------------------------------------

function settle(ctx: Ctx): void {
  const s = ctx.s;
  for (let guard = 0; guard < 1000; guard++) {
    if (s.winner !== null) return;
    const active = getActivePlayers(s);
    if (active.length <= 1) return declareWinner(ctx, active[0]);
    if (s.trade || s.mortgageDecision) return;

    const debt = s.debts[0];
    if (debt) {
      const debtor = getPlayer(s, debt.debtor);
      if (debtor.money < debt.amount) return; // Der Schuldner muss handeln.
      s.debts.shift();
      payDebt(ctx, debt);
      continue;
    }
    if (s.auction) return;
    const next = s.auctionQueue.shift();
    if (next !== undefined) return startAuction(ctx, next, "bankruptcy");
    if (getCurrentPlayer(s).bankrupt) {
      advanceTurn(ctx);
      continue;
    }
    return;
  }
  throw new Error("Interner Fehler: Spielablauf kommt nicht zur Ruhe.");
}

function declareWinner(ctx: Ctx, winner: PlayerState | undefined): void {
  const s = ctx.s;
  if (!winner) throw new Error("Interner Fehler: kein Spieler mehr im Spiel.");
  s.winner = winner.id;
  s.trade = null;
  s.mortgageDecision = null;
  s.debts = [];
  s.auction = null;
  s.auctionQueue = [];
  emit(ctx, { type: "gameWon", player: winner.id });
}

function advanceTurn(ctx: Ctx): void {
  const s = ctx.s;
  for (let i = 1; i <= s.players.length; i++) {
    const index = (s.current + i) % s.players.length;
    if (!s.players[index]?.bankrupt) {
      s.current = index;
      break;
    }
  }
  s.turnNumber += 1;
  s.turn = freshTurn();
  emit(ctx, { type: "turnStarted", player: getCurrentPlayer(s).id, turnNumber: s.turnNumber });
}
