// Prüfungen, die in jedem gültigen Spielstand gelten müssen.
// Werden in den Tests nach jeder Aktion und beim Laden eines Spielstands verwendet.
import { getPropertySpace, GROUP_STREETS, isSpaceIndex, PROPERTY_INDICES } from "./board";
import { DECK_CARDS } from "./cards";
import {
  getActivePlayers,
  groupHasMortgage,
  HOTEL_LEVEL,
  JAIL_TURNS,
  ownsWholeGroup,
  TOTAL_HOTELS,
  TOTAL_HOUSES,
} from "./rules";
import { BANK, JACKPOT, type DeckId, type GameEvent, type GameState, type PlayerId } from "./types";

/** Liste von Problemen (leer = alles in Ordnung). */
export function checkInvariants(state: GameState): string[] {
  const problems: string[] = [];
  const fail = (message: string) => problems.push(message);
  const players = state.players;
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) fail("Spieler-IDs sind nicht eindeutig.");
  const active = getActivePlayers(state);

  for (const p of players) {
    if (!Number.isInteger(p.money) || p.money < 0) fail(`${p.id}: ungültiges Guthaben ${p.money}.`);
    if (!isSpaceIndex(p.position)) fail(`${p.id}: ungültige Position ${p.position}.`);
    if (p.jailTurns < 0 || p.jailTurns > JAIL_TURNS) fail(`${p.id}: ungültige Gefängnisrunden ${p.jailTurns}.`);
    if (!p.inJail && p.jailTurns !== 0) fail(`${p.id}: nicht im Gefängnis, aber Gefängnisrunden ${p.jailTurns}.`);
    if (p.inJail && p.position !== 10) fail(`${p.id}: im Gefängnis, aber nicht auf Feld 10.`);
    if (p.bankrupt && (p.money !== 0 || p.jailCards.length > 0 || p.buildPermits.length > 0 || p.inJail)) {
      fail(`${p.id}: ausgeschieden, hat aber noch Geld, Karten oder sitzt im Gefängnis.`);
    }
  }

  // Felder und Gebäude
  let housesOnBoard = 0;
  let hotelsOnBoard = 0;
  for (const index of PROPERTY_INDICES) {
    const property = state.properties[index];
    if (!property) {
      fail(`Feld ${index}: Zustand fehlt.`);
      continue;
    }
    const space = getPropertySpace(index);
    const level = property.houses;
    if (!Number.isInteger(level) || level < 0 || level > HOTEL_LEVEL) fail(`Feld ${index}: ungültige Bebauung ${level}.`);
    if (level === HOTEL_LEVEL) hotelsOnBoard += 1;
    else housesOnBoard += level;
    if (property.owner === null) {
      if (level > 0 || property.mortgaged) fail(`Feld ${index}: ohne Besitzer, aber bebaut oder belastet.`);
    } else if (!active.some((p) => p.id === property.owner)) {
      fail(`Feld ${index}: Besitzer ${property.owner} ist nicht (mehr) im Spiel.`);
    }
    if (level > 0) {
      if (space.kind !== "street") fail(`Feld ${index}: Gebäude auf einem Feld ohne Farbgruppe.`);
      else if (property.owner === null || !ownsWholeGroup(state, property.owner, space.group)) {
        fail(`Feld ${index}: Gebäude ohne ganze Farbgruppe.`);
      } else if (groupHasMortgage(state, space.group)) {
        fail(`Feld ${index}: Gebäude in einer belasteten Farbgruppe.`);
      }
    }
  }
  if (housesOnBoard + state.bank.houses !== TOTAL_HOUSES) {
    fail(`Häuser: ${housesOnBoard} auf dem Brett + ${state.bank.houses} in der Bank ≠ ${TOTAL_HOUSES}.`);
  }
  if (hotelsOnBoard + state.bank.hotels !== TOTAL_HOTELS) {
    fail(`Hotels: ${hotelsOnBoard} auf dem Brett + ${state.bank.hotels} in der Bank ≠ ${TOTAL_HOTELS}.`);
  }
  if (state.bank.houses < 0 || state.bank.hotels < 0) fail("Die Bank hat negative Gebäudebestände.");
  for (const group of Object.keys(GROUP_STREETS) as (keyof typeof GROUP_STREETS)[]) {
    const levels = GROUP_STREETS[group].map((i) => state.properties[i]?.houses ?? 0);
    const mortgaged = GROUP_STREETS[group].some((i) => state.properties[i]?.mortgaged);
    if (mortgaged && levels.some((l) => l > 0)) fail(`Gruppe ${group}: belastet und bebaut zugleich.`);
  }

  // Karten: jede Karte genau einmal, entweder im Stapel oder bei einem Spieler (Freikarte, Baubewilligung).
  for (const deck of ["event", "community"] as DeckId[]) {
    const held = players.flatMap((p) => [...p.jailCards, ...p.buildPermits]).filter((c) => c.startsWith(deck === "event" ? "E" : "G"));
    const all = [...state.decks[deck], ...held].sort();
    const expected = DECK_CARDS[deck].map((c) => c.id).sort();
    if (all.join() !== expected.join()) fail(`Stapel ${deck}: Karten fehlen oder sind doppelt.`);
  }

  if (!Number.isInteger(state.jackpot) || state.jackpot < 0) fail(`Ungültiger Jackpot ${state.jackpot}.`);
  if (!state.options.jackpot && state.jackpot !== 0) fail("Jackpot ohne Jackpot-Option.");

  // Ablauf
  if (state.winner === null) {
    if (active.length < 2) fail("Weniger als zwei Spieler im Spiel, aber kein Gewinner.");
    const current = players[state.current];
    // Nach einem Bankrott bleibt der Ausgeschiedene am Zug, bis der Hypothekenentscheid erledigt ist.
    const settling = state.mortgageDecision !== null || state.debts.length > 0;
    if (!current || (current.bankrupt && !settling)) fail("Der Spieler am Zug ist ungültig oder ausgeschieden.");
    if (state.turn.phase === "buy" && state.turn.pendingBuy === null) fail("Kaufentscheid ohne Feld.");
    for (const debt of state.debts) {
      if (!(debt.amount > 0)) fail("Schuld mit ungültigem Betrag.");
      if (!active.some((p) => p.id === debt.debtor)) fail("Schuld eines ausgeschiedenen Spielers.");
    }
    const head = state.debts[0];
    if (head && !state.trade && !state.mortgageDecision) {
      const debtor = players.find((p) => p.id === head.debtor);
      if (debtor && debtor.money >= head.amount) fail("Eine Schuld könnte bezahlt werden, ist aber noch offen.");
    }
  } else {
    if (active.length !== 1 || active[0]?.id !== state.winner) fail("Gewinner passt nicht zu den verbliebenen Spielern.");
  }
  return problems;
}

/**
 * Rechnet alle Geldbewegungen aus dem Protokoll nach (ab Spielstart) und vergleicht sie mit dem Spielstand.
 * `events` muss vollständig sein: Protokoll von `createGame` plus alle `events` aus `applyAction`.
 */
export function checkMoneyLog(state: GameState, events: readonly GameEvent[]): string[] {
  const money = new Map<PlayerId, number>(state.players.map((p) => [p.id, state.options.startMoney]));
  let jackpot = 0;
  const problems: string[] = [];
  const apply = (party: string, delta: number) => {
    if (party === BANK) return;
    if (party === JACKPOT) jackpot += delta;
    else if (money.has(party)) money.set(party, (money.get(party) ?? 0) + delta);
    else problems.push(`Geldbewegung mit unbekannter Partei ${party}.`);
  };
  for (const event of events) {
    if (event.type !== "moneyTransferred") continue;
    if (!(event.amount > 0)) problems.push(`Geldbewegung mit ungültigem Betrag ${event.amount}.`);
    apply(event.from, -event.amount);
    apply(event.to, event.amount);
  }
  for (const p of state.players) {
    if (money.get(p.id) !== p.money) problems.push(`${p.id}: Protokoll ergibt ${money.get(p.id)}, Spielstand ${p.money}.`);
  }
  if (jackpot !== state.jackpot) problems.push(`Jackpot: Protokoll ergibt ${jackpot}, Spielstand ${state.jackpot}.`);
  return problems;
}
