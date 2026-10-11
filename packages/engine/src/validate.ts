// Prüft Aktionen, bevor sie ausgeführt werden, und listet gültige Aktionen auf.
// Aktionen können übers Netz kommen, deshalb wird jede Eingabe misstrauisch geprüft.
import { findPropertySpace, getPropertySpace, isSpaceIndex, PROPERTY_INDICES } from "./board";
import {
  checkBuild,
  checkMortgage,
  checkSellBuilding,
  checkUnmortgage,
  findPlayer,
  getCurrentPlayer,
  getPlayer,
  getProperty,
  getWaitingFor,
  isFreeOfBuildings,
  JAIL_FINE,
  liquidationValue,
  minimumBid,
  mortgageInterest,
  mortgageTransferCost,
  unmortgageCost,
} from "./rules";
import type {
  Action,
  ActionError,
  ErrorCode,
  GameState,
  MortgageDecision,
  PlayerId,
  PlayerState,
  SpaceIndex,
  TradeProposal,
  TradeSide,
} from "./types";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  gameOver: "Das Spiel ist bereits zu Ende.",
  unknownPlayer: "Diesen Spieler gibt es nicht.",
  playerOut: "Dieser Spieler ist bereits ausgeschieden.",
  notYourTurn: "Du bist gerade nicht an der Reihe.",
  wrongPhase: "Das ist im Moment nicht möglich.",
  notInJail: "Du bist nicht im Gefängnis.",
  noJailCard: "Du hast keine Freikarte.",
  notEnoughMoney: "Dafür reicht dein Bargeld nicht.",
  invalidSpace: "Dieses Feld ist dafür nicht geeignet.",
  notOwner: "Dieses Feld gehört dir nicht.",
  invalidAmount: "Der Betrag ist ungültig.",
  bidTooLow: "Das Gebot ist zu tief.",
  groupIncomplete: "Dir gehört noch nicht die ganze Farbgruppe.",
  groupMortgaged: "In dieser Farbgruppe ist ein Feld mit einer Hypothek belastet.",
  unevenBuilding: "Es muss gleichmässig gebaut und verkauft werden.",
  maxBuildings: "Auf diesem Feld steht schon ein Hotel.",
  noHousesLeft: "Die Bank hat keine Häuser mehr.",
  noHotelsLeft: "Die Bank hat keine Hotels mehr.",
  noBuildings: "Auf diesem Feld stehen keine Gebäude.",
  alreadyMortgaged: "Dieses Feld ist bereits belastet.",
  notMortgaged: "Dieses Feld ist nicht belastet.",
  groupHasBuildings: "Zuerst müssen alle Gebäude der Farbgruppe verkauft werden.",
  tradeOpen: "Zuerst muss das offene Handelsangebot beantwortet werden.",
  noTrade: "Es gibt kein offenes Handelsangebot.",
  invalidTrade: "Dieses Handelsangebot ist ungültig.",
  emptyTrade: "Das Angebot ist leer.",
  partnerCannotPay: "Dein Handelspartner kann das nicht bezahlen.",
  canStillPay: "Du kannst die Schuld noch begleichen: Gebäude verkaufen oder Hypotheken aufnehmen.",
  unknownAction: "Unbekannte Aktion.",
};

export function makeError(code: ErrorCode): ActionError {
  return { code, message: ERROR_MESSAGES[code] };
}

/** Gibt `null` zurück, wenn der Spieler die Aktion jetzt ausführen darf, sonst den Grund. */
export function validateAction(state: GameState, playerId: PlayerId, action: Action): ActionError | null {
  const code = checkAction(state, playerId, action);
  return code === null ? null : makeError(code);
}

/**
 * Alle gültigen Aktionen eines Spielers.
 * Gebote erscheinen nur mit dem Mindestbetrag, Handelsangebote gar nicht
 * (dafür gibt es `canProposeTrade` und `validateAction`).
 */
export function getLegalActions(state: GameState, playerId: PlayerId): Action[] {
  if (state.winner !== null) return [];
  const candidates: Action[] = [
    { type: "rollDice" },
    { type: "payJailFine" },
    { type: "useJailCard" },
    { type: "buyProperty" },
    { type: "declineProperty" },
    { type: "passBid" },
    { type: "endTurn" },
    { type: "declareBankruptcy" },
    { type: "acceptTrade", lift: [] },
    { type: "rejectTrade" },
    { type: "cancelTrade" },
  ];
  if (state.auction) candidates.push({ type: "bid", amount: minimumBid(state.auction) });
  if (state.mortgageDecision) {
    candidates.push({ type: "resolveMortgages", lift: [] });
    candidates.push({ type: "resolveMortgages", lift: [...state.mortgageDecision.spaces] });
  }
  for (const space of PROPERTY_INDICES) {
    if (getProperty(state, space).owner !== playerId) continue;
    candidates.push(
      { type: "buildHouse", space },
      { type: "sellBuilding", space },
      { type: "mortgage", space },
      { type: "unmortgage", space },
    );
  }
  return candidates.filter((action) => checkAction(state, playerId, action) === null);
}

function checkAction(state: GameState, playerId: PlayerId, action: Action): ErrorCode | null {
  if (state.winner !== null) return "gameOver";
  const player = findPlayer(state, playerId);
  if (!player) return "unknownPlayer";
  if (player.bankrupt) return "playerOut";
  if (!action || typeof action !== "object") return "unknownAction";
  if (action.type === "timeout") return getWaitingFor(state) === playerId ? null : "notYourTurn";

  // 1. Offenes Handelsangebot: Nur Annehmen, Ablehnen oder Zurückziehen.
  const trade = state.trade;
  if (trade) {
    switch (action.type) {
      case "acceptTrade":
        return playerId === trade.to ? checkAccept(state, action.lift ?? []) : "notYourTurn";
      case "rejectTrade":
        return playerId === trade.to ? null : "notYourTurn";
      case "cancelTrade":
        return playerId === trade.from ? null : "notYourTurn";
      default:
        return "tradeOpen";
    }
  }
  if (action.type === "acceptTrade" || action.type === "rejectTrade" || action.type === "cancelTrade") {
    return "noTrade";
  }

  // 2. Hypothekenentscheid nach einem Bankrott.
  const decision = state.mortgageDecision;
  if (decision) {
    if (playerId !== decision.player) return "notYourTurn";
    return action.type === "resolveMortgages" ? checkResolveMortgages(state, decision, action.lift) : "wrongPhase";
  }
  if (action.type === "resolveMortgages") return "wrongPhase";

  // 3. Schuld: Geld auftreiben (verkaufen, belasten, handeln) oder Bankrott erklären.
  const debt = state.debts[0];
  if (debt) {
    if (playerId !== debt.debtor) return "notYourTurn";
    switch (action.type) {
      case "sellBuilding":
        return checkSellBuilding(state, playerId, action.space);
      case "mortgage":
        return checkMortgage(state, playerId, action.space);
      case "proposeTrade":
        return checkProposal(state, playerId, action.offer);
      case "declareBankruptcy":
        return player.money + liquidationValue(state, playerId) < debt.amount ? null : "canStillPay";
      default:
        return "wrongPhase";
    }
  }
  if (action.type === "declareBankruptcy") return "wrongPhase";

  // 4. Versteigerung: bieten oder passen; vor dem Bieten darf Geld aufgetrieben werden.
  const auction = state.auction;
  if (auction) {
    if (playerId !== auction.bidders[auction.next]) return "notYourTurn";
    switch (action.type) {
      case "bid":
        if (!Number.isInteger(action.amount) || action.amount <= 0) return "invalidAmount";
        if (action.amount < minimumBid(auction)) return "bidTooLow";
        return action.amount > player.money ? "notEnoughMoney" : null;
      case "passBid":
        return null;
      case "sellBuilding":
        return checkSellBuilding(state, playerId, action.space);
      case "mortgage":
        return checkMortgage(state, playerId, action.space);
      default:
        return "wrongPhase";
    }
  }
  if (action.type === "bid" || action.type === "passBid") return "wrongPhase";

  // 5. Eigener Zug.
  if (playerId !== getCurrentPlayer(state).id) return "notYourTurn";
  const phase = state.turn.phase;
  switch (action.type) {
    case "rollDice":
      return phase === "preRoll" ? null : "wrongPhase";
    case "payJailFine":
      if (phase !== "preRoll") return "wrongPhase";
      if (!player.inJail) return "notInJail";
      return player.money < JAIL_FINE ? "notEnoughMoney" : null;
    case "useJailCard":
      if (phase !== "preRoll") return "wrongPhase";
      if (!player.inJail) return "notInJail";
      return player.jailCards.length === 0 ? "noJailCard" : null;
    case "buyProperty": {
      if (phase !== "buy" || state.turn.pendingBuy === null) return "wrongPhase";
      const space = getPropertySpace(state.turn.pendingBuy);
      return player.money < space.price ? "notEnoughMoney" : null;
    }
    case "declineProperty":
      return phase === "buy" ? null : "wrongPhase";
    case "endTurn":
      return phase === "postRoll" ? null : "wrongPhase";
    case "buildHouse":
      return checkBuild(state, playerId, action.space);
    case "sellBuilding":
      return checkSellBuilding(state, playerId, action.space);
    case "mortgage":
      return checkMortgage(state, playerId, action.space);
    case "unmortgage":
      return checkUnmortgage(state, playerId, action.space);
    case "proposeTrade":
      return checkProposal(state, playerId, action.offer);
    default:
      return "unknownAction";
  }
}

// ---------------------------------------------------------------------------
// Handel
// ---------------------------------------------------------------------------

function isIndexList(value: unknown): value is SpaceIndex[] {
  return Array.isArray(value) && value.every(isSpaceIndex) && new Set(value).size === value.length;
}

function isTradeSide(value: unknown): value is TradeSide {
  if (!value || typeof value !== "object") return false;
  const side = value as Partial<TradeSide>;
  return (
    isIndexList(side.spaces) &&
    Number.isInteger(side.money) &&
    (side.money as number) >= 0 &&
    Array.isArray(side.jailCards) &&
    side.jailCards.every((c) => typeof c === "string") &&
    new Set(side.jailCards).size === side.jailCards.length
  );
}

/** Kosten für belastete Felder, die ein Spieler bekommt. */
function mortgageFees(state: GameState, received: SpaceIndex[], lift: SpaceIndex[]): number {
  let total = 0;
  for (const index of received) {
    if (!getProperty(state, index).mortgaged) continue;
    total += mortgageTransferCost(getPropertySpace(index), lift.includes(index));
  }
  return total;
}

function checkSide(state: GameState, side: TradeSide, owner: PlayerState): ErrorCode | null {
  for (const index of side.spaces) {
    const space = findPropertySpace(index);
    if (!space) return "invalidSpace";
    if (getProperty(state, index).owner !== owner.id) return "notOwner";
    if (!isFreeOfBuildings(state, space)) return "groupHasBuildings";
  }
  if (!side.jailCards.every((card) => owner.jailCards.includes(card))) return "noJailCard";
  return null;
}

function checkLift(state: GameState, lift: SpaceIndex[], received: SpaceIndex[]): boolean {
  return lift.every((index) => received.includes(index) && getProperty(state, index).mortgaged);
}

/** Prüft ein Handelsangebot (ohne die Frage, ob der Anbieter gerade handeln darf). */
export function checkProposal(state: GameState, fromId: PlayerId, proposal: TradeProposal): ErrorCode | null {
  if (!proposal || typeof proposal !== "object") return "invalidTrade";
  const from = getPlayer(state, fromId);
  const to = findPlayer(state, proposal.to);
  if (!to || to.bankrupt || to.id === from.id) return "invalidTrade";
  if (!isTradeSide(proposal.give) || !isTradeSide(proposal.take)) return "invalidTrade";
  const lift = proposal.lift ?? [];
  if (!isIndexList(lift)) return "invalidTrade";
  const { give, take } = proposal;

  const empty = (s: TradeSide) => s.spaces.length === 0 && s.money === 0 && s.jailCards.length === 0;
  if (empty(give) && empty(take)) return "emptyTrade";

  const sideError = checkSide(state, give, from) ?? checkSide(state, take, to);
  if (sideError) return sideError;
  if (give.money > from.money) return "notEnoughMoney";
  if (take.money > to.money) return "partnerCannotPay";
  if (!checkLift(state, lift, take.spaces)) return "invalidTrade";

  // Belastete Felder: Wer sie erhält, zahlt sofort den Zins oder löst ab. Ein Handel darf nie Schulden erzeugen.
  if (from.money - give.money + take.money < mortgageFees(state, take.spaces, lift)) return "notEnoughMoney";
  if (to.money - take.money + give.money < mortgageFees(state, give.spaces, [])) return "partnerCannotPay";
  return null;
}

function checkAccept(state: GameState, lift: unknown): ErrorCode | null {
  const offer = state.trade;
  if (!offer) return "noTrade";
  const proposalError = checkProposal(state, offer.from, offer);
  if (proposalError) return proposalError;
  if (!isIndexList(lift) || !checkLift(state, lift, offer.give.spaces)) return "invalidTrade";
  const to = getPlayer(state, offer.to);
  if (to.money - offer.take.money + offer.give.money < mortgageFees(state, offer.give.spaces, lift)) {
    return "notEnoughMoney";
  }
  return null;
}

function checkResolveMortgages(state: GameState, decision: MortgageDecision, lift: unknown): ErrorCode | null {
  if (!isIndexList(lift) || !lift.every((i) => decision.spaces.includes(i))) return "invalidSpace";
  if (lift.length === 0) return null; // Belastet lassen geht immer; fehlt Geld für den Zins, entsteht eine Schuld.
  let cost = 0;
  for (const index of decision.spaces) {
    const space = getPropertySpace(index);
    cost += lift.includes(index) ? unmortgageCost(space) : mortgageInterest(space);
  }
  return getPlayer(state, decision.player).money < cost ? "notEnoughMoney" : null;
}
