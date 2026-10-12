// Handel der Computergegner: Angebote prüfen und selbst Angebote machen.
// Ein Handel wird auf einer Kopie durchgespielt (applyAction, ohne Würfel) und danach bewertet.
import { getPropertySpace, GROUP_STREETS, COLOR_GROUPS } from "./board";
import {
  type BotContext,
  ceilTo10,
  chance,
  eventsThisTurn,
  floorTo10,
  fairRatio,
  listValue,
  patience,
  positionValue,
  cashReserve,
} from "./bot-eval";
import { applyAction } from "./game";
import type { Rng } from "./random";
import { canProposeTrade, getActivePlayers, getPlayer, getProperty, unmortgageCost } from "./rules";
import type { Action, GameState, PlayerId, SpaceIndex, TradeOffer, TradeProposal } from "./types";
import { validateAction } from "./validate";

/** Zufallsquelle für Gedankenspiele: Ein Handel würfelt nie. */
const NO_DICE: Rng = {
  nextInt(): number {
    throw new Error("Bot-Gedankenspiel: Hier wird nicht gewürfelt.");
  },
};

/** Zustand nach dem Handel, wenn der Empfänger ohne Auslösen annimmt. `null`, wenn der Handel ungültig ist. */
export function simulateTrade(state: GameState, from: PlayerId, proposal: TradeProposal): GameState | null {
  const proposed = applyAction(state, from, { type: "proposeTrade", offer: proposal }, NO_DICE);
  if (!proposed.ok) return null;
  const accepted = applyAction(proposed.state, proposal.to, { type: "acceptTrade", lift: [] }, NO_DICE);
  return accepted.ok ? accepted.state : null;
}

/** Wie viel ein Spieler durch den Wechsel von `before` zu `after` gewinnt (clevere Bewertung). */
function gain(before: GameState, after: GameState, playerId: PlayerId): number {
  return positionValue(after, playerId) - positionValue(before, playerId);
}

/** Annahmeregel der Stufe «clever»: eigener Gewinn positiv und nicht viel kleiner als der des Partners (`fairRatio`). */
function cleverAccepts(myGain: number, theirGain: number, state: GameState): boolean {
  return myGain > 0 && myGain >= theirGain * fairRatio(state);
}

/** Wie die Stufe «einfach» ein Angebot sieht: Gewinn nach Listenpreisen. Annahme, wenn er die Schätzungenauigkeit übersteigt. */
function easyListGain(before: GameState, after: GameState, playerId: PlayerId): number {
  return listValue(after, playerId) - listValue(before, playerId);
}

/** Grösste Ungenauigkeit der Stufe «einfach» zu ihren Ungunsten (siehe `answerTrade`). */
function easyDoubt(givenByEasy: number): number {
  return 0.1 * (givenByEasy + 100);
}

// ---------------------------------------------------------------------------
// Angebot beantworten
// ---------------------------------------------------------------------------

/** Belastete Felder aus dem Angebot sofort auslösen, wenn danach die Reserve bleibt (nur «clever»). */
function chooseLift(ctx: BotContext, offer: TradeOffer): SpaceIndex[] {
  if (ctx.level !== "clever") return [];
  const mortgaged = offer.give.spaces.filter((i) => getProperty(ctx.state, i).mortgaged);
  if (mortgaged.length === 0) return [];
  const cost = mortgaged.reduce((sum, i) => sum + unmortgageCost(getPropertySpace(i)), 0);
  const cashAfter = ctx.me.money + offer.give.money - offer.take.money - cost;
  return cashAfter >= cashReserve(ctx.state, ctx.me.id) ? mortgaged : [];
}

/** Antwort auf ein offenes Handelsangebot an den Bot: annehmen oder ablehnen. */
export function answerTrade(ctx: BotContext): Action {
  const { state, me, rng } = ctx;
  const offer = state.trade;
  const reject: Action = { type: "rejectTrade" };
  if (!offer || offer.to !== me.id) return reject;

  let accept: Action = { type: "acceptTrade", lift: chooseLift(ctx, offer) };
  if (validateAction(state, me.id, accept) !== null) accept = { type: "acceptTrade", lift: [] };
  const result = applyAction(state, me.id, accept, NO_DICE);
  if (!result.ok) return reject;
  const after = result.state;

  if (ctx.level === "clever") {
    return cleverAccepts(gain(state, after, me.id), gain(state, after, offer.from), state) ? accept : reject;
  }
  // «einfach»: zählt nur Listenpreise und schätzt ungenau (nimmt auch einmal ein schlechtes Angebot an).
  const given = offer.take.spaces.reduce((sum, i) => sum + getPropertySpace(i).price, 0) + offer.take.money;
  const noise = ((rng.nextInt(31) - 20) / 100) * (given + 100);
  return easyListGain(state, after, me.id) >= noise ? accept : reject;
}

// ---------------------------------------------------------------------------
// Selbst ein Angebot machen
// ---------------------------------------------------------------------------

/** Gleiches Angebot (Partner und gewünschte Felder) wurde kürzlich abgelehnt oder zurückgezogen. */
function recentlyRefused(state: GameState, from: PlayerId, to: PlayerId, take: SpaceIndex[]): boolean {
  const key = [...take].sort((a, b) => a - b).join();
  return state.log.some(
    (e) =>
      (e.type === "tradeRejected" || e.type === "tradeCancelled") &&
      e.offer.from === from &&
      e.offer.to === to &&
      [...e.offer.take.spaces].sort((a, b) => a - b).join() === key,
  );
}

interface Candidate {
  to: PlayerId;
  give: SpaceIndex[];
  take: SpaceIndex[];
}

/**
 * Mögliche Tauschgeschäfte: Felder einer Farbgruppe, die der Bot teilweise besitzt, von einem Gegner holen.
 * «einfach» will nur die ganze Gruppe. Dazu Gegentausch: eigene Felder, die dem Gegner eine Gruppe vollenden.
 */
function candidates(state: GameState, me: PlayerId, onlyComplete: boolean): Candidate[] {
  const result: Candidate[] = [];
  const owner = (i: SpaceIndex) => getProperty(state, i).owner;
  for (const group of COLOR_GROUPS) {
    const streets = GROUP_STREETS[group];
    if (!streets.some((i) => owner(i) === me)) continue;
    const missing = streets.filter((i) => owner(i) !== me);
    if (missing.length === 0 || missing.some((i) => owner(i) === null)) continue;
    for (const partner of getActivePlayers(state)) {
      if (partner.id === me) continue;
      const take = missing.filter((i) => owner(i) === partner.id);
      if (take.length === 0 || (onlyComplete && take.length !== missing.length)) continue;
      if (recentlyRefused(state, me, partner.id, take)) continue;
      result.push({ to: partner.id, give: [], take });
      // Gegentausch: Was fehlt dem Partner in einer anderen Gruppe, und gehört es dem Bot?
      for (const other of COLOR_GROUPS) {
        if (other === group) continue;
        const theirs = GROUP_STREETS[other];
        const lacking = theirs.filter((i) => owner(i) !== partner.id);
        if (theirs.some((i) => owner(i) === partner.id) && lacking.length > 0 && lacking.every((i) => owner(i) === me)) {
          result.push({ to: partner.id, give: lacking, take });
        }
      }
    }
  }
  return result;
}

function proposal(c: Candidate, giveMoney: number, takeMoney: number): TradeProposal {
  return {
    to: c.to,
    give: { spaces: c.give, money: giveMoney, jailCards: [] },
    take: { spaces: c.take, money: takeMoney, jailCards: [] },
    lift: [],
  };
}

/**
 * Angebot der Stufe «clever». Der Geldausgleich richtet sich nach dem Partner (die Stufe steht in der Spielerliste):
 * - Partner «einfach» rechnet nur mit Listenpreisen: gerade so viel, dass sie sicher zusagt.
 * - Mensch oder «clever»: so viel, dass der Partner nach der cleveren Annahmeregel gerade zusagt.
 * Abgeschickt wird nur, was dem Bot selbst klar etwas bringt.
 */
function cleverOffer(ctx: BotContext, c: Candidate): { action: Action; net: number } | null {
  const { state, me } = ctx;
  const plain = simulateTrade(state, me.id, proposal(c, 0, 0));
  if (!plain) return null;
  const mine = gain(state, plain, me.id);
  const theirs = gain(state, plain, c.to);
  const ratio = fairRatio(state);
  const partner = getPlayer(state, c.to);

  let balance: number; // > 0: Bot zahlt, < 0: Partner zahlt
  if (partner.bot === "easy") {
    const given = c.take.reduce((sum, i) => sum + getPropertySpace(i).price, 0);
    balance = easyDoubt(given) - easyListGain(state, plain, c.to);
  } else {
    if (mine + theirs <= 0) return null; // Der Handel schafft keinen Wert.
    balance = (ratio * mine - theirs) / (1 + ratio);
  }
  // Im Zweikampf zahlt «clever» kein Geld für Felder: Der Gegner würde damit sofort Häuser bauen.
  const headsUp = getActivePlayers(state).length <= 2;
  if (headsUp && balance > 0) return null;
  const giveMoney = balance > 0 ? ceilTo10(balance) + 10 : 0;
  const takeMoney = balance < 0 ? Math.min(floorTo10(-balance * 0.8), floorTo10(partner.money)) : 0;
  if (me.money - giveMoney < cashReserve(state, me.id) * (1 - patience(state))) return null;

  const offer = proposal(c, giveMoney, takeMoney);
  const action: Action = { type: "proposeTrade", offer };
  if (validateAction(state, me.id, action) !== null) return null;
  const after = simulateTrade(state, me.id, offer);
  if (!after) return null;
  // Im Zweikampf hilft jeder Vorteil des Gegners direkt gegen den Bot: Dann nur klar bessere Geschäfte anbieten.
  const demand = headsUp ? 1.4 : 1;
  const net = gain(state, after, me.id);
  return net >= 50 && net >= gain(state, after, c.to) * ratio * demand - 30 ? { action, net } : null;
}

/** Angebot der Stufe «einfach»: Listenpreis plus zufälliger Aufschlag in bar. */
function easyOffer(ctx: BotContext, c: Candidate): Action | null {
  const { state, me, rng } = ctx;
  if (c.give.length > 0) return null;
  const price = c.take.reduce((sum, i) => sum + getPropertySpace(i).price, 0);
  const money = ceilTo10(price * (1 + rng.nextInt(51) / 100));
  if (me.money - money < 50) return null;
  const action: Action = { type: "proposeTrade", offer: proposal(c, money, 0) };
  return validateAction(state, me.id, action) === null ? action : null;
}

/**
 * Handelsangebot für den eigenen Zug, oder `null`.
 * Höchstens ein Angebot pro Zug; kürzlich abgelehnte Angebote werden nicht wiederholt.
 */
export function proposeTrade(ctx: BotContext): Action | null {
  const { state, me, level, rng } = ctx;
  if (state.turn.phase === "buy" || !canProposeTrade(state, me.id)) return null;
  if (eventsThisTurn(state).some((e) => e.type === "tradeProposed" && e.offer.from === me.id)) return null;

  if (level === "easy") {
    if (!chance(rng, 0.1 + patience(state) * 0.5)) return null;
    for (const c of candidates(state, me.id, true)) {
      const action = easyOffer(ctx, c);
      if (action) return action;
    }
    return null;
  }

  let top: { action: Action; net: number } | null = null;
  for (const c of candidates(state, me.id, false)) {
    const offer = cleverOffer(ctx, c);
    if (offer && (!top || offer.net > top.net)) top = offer;
  }
  return top?.action ?? null;
}
