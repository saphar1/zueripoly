import { describe, expect, it } from "vitest";
import { checkInvariants, getWaitingFor, removePlayer, type GameState, type PlayerId, type TradeProposal } from "../src";
import { act, dice, eventsOfType, newGame, own, placeAt, player, setHouses } from "./helpers";
import { playRandomGames } from "./random-play";

/** Entfernt einen Spieler; schlägt fehl, wenn es abgelehnt wird. Prüft danach die Invarianten. */
function remove(state: GameState, id: PlayerId) {
  const result = removePlayer(state, id);
  if (!result.ok) throw new Error(`${id} entfernen abgelehnt (${result.error.code}).`);
  expect(checkInvariants(result.state)).toEqual([]);
  return { state: result.state, events: result.events };
}

const side = (spaces: number[] = [], money = 0) => ({ spaces, money, jailCards: [] as string[] });
const offer = (to: string, give = side(), take = side()): { type: "proposeTrade"; offer: TradeProposal } => ({
  type: "proposeTrade",
  offer: { to, give, take },
});

/** Alle Versteigerungen der Reihe nach mit «passen» beenden. */
function passAllAuctions(state: GameState): GameState {
  for (let guard = 0; state.auction && guard < 100; guard++) {
    const bidder = getWaitingFor(state);
    if (!bidder) break;
    ({ state } = act(state, bidder, { type: "passBid" }));
  }
  return state;
}

describe("Spieler aus dem Spiel nehmen", () => {
  it("im eigenen Zug: Besitz an die Bank, Felder werden versteigert, danach ist der Nächste dran", () => {
    const start = own(newGame(3), "p1", 1, 3, 5);
    setHouses(start, 1, 2);
    setHouses(start, 3, 2);
    const { state, events } = remove(start, "p1");
    expect(events[0]).toEqual({ type: "playerRemoved", player: "p1" });
    expect(player(state, "p1")).toMatchObject({ bankrupt: true, money: 0 });
    expect(eventsOfType(events, "bankrupt")).toEqual([{ type: "bankrupt", player: "p1", creditor: "bank" }]);
    expect(state.bank.houses).toBe(32);
    expect([1, 3, 5].map((s) => state.properties[s]?.owner)).toEqual([null, null, null]);
    // Versteigerung der Konkursmasse, links vom Ausgeschiedenen beginnend.
    expect(state.auction).toMatchObject({ space: 1, origin: "bankruptcy", bidders: ["p2", "p3"] });
    const after = passAllAuctions(state);
    expect(after.auction).toBeNull();
    expect(after.auctionQueue).toEqual([]);
    expect(getWaitingFor(after)).toBe("p2");
    expect(after.turn.phase).toBe("preRoll");
  });

  it("ohne Besitz geht der Zug sofort weiter", () => {
    const { state, events } = remove(newGame(3), "p1");
    expect(getWaitingFor(state)).toBe("p2");
    expect(eventsOfType(events, "turnStarted")).toEqual([{ type: "turnStarted", player: "p2", turnNumber: 2 }]);
  });

  it("wer nicht am Zug ist, kann ebenfalls entfernt werden; das Spiel läuft weiter", () => {
    const { state } = remove(own(newGame(3), "p3", 39), "p3");
    expect(player(state, "p3").bankrupt).toBe(true);
    expect(state.auction).toMatchObject({ space: 39, bidders: ["p2", "p1"] });
    const after = passAllAuctions(state);
    expect(getWaitingFor(after)).toBe("p1");
    expect(after.turnNumber).toBe(1);
  });

  it("in der Versteigerung: das Gebot des Höchstbietenden verfällt, die anderen bieten weiter", () => {
    let state = newGame(3);
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 2]))); // Feld 3, frei
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    expect(state.auction?.bidders).toEqual(["p2", "p3", "p1"]);
    ({ state } = act(state, "p2", { type: "bid", amount: 100 }));
    expect(getWaitingFor(state)).toBe("p3");
    const { state: after } = remove(state, "p2");
    expect(after.auction).toMatchObject({ bidders: ["p3", "p1"], highestBid: 0, highestBidder: null });
    expect(getWaitingFor(after)).toBe("p3");
    ({ state } = act(after, "p3", { type: "bid", amount: 10 }));
    ({ state } = act(state, "p1", { type: "passBid" }));
    expect(state.properties[3]?.owner).toBe("p3");
  });

  it("in der Versteigerung: bleibt nur der Höchstbietende übrig, bekommt er das Feld", () => {
    let state = newGame(3);
    ({ state } = act(state, "p1", { type: "rollDice" }, dice([1, 2])));
    ({ state } = act(state, "p1", { type: "declineProperty" }));
    ({ state } = act(state, "p2", { type: "bid", amount: 60 }));
    ({ state } = act(state, "p3", { type: "passBid" }));
    expect(getWaitingFor(state)).toBe("p1");
    const { state: after, events } = remove(state, "p1");
    expect(eventsOfType(events, "auctionWon")).toEqual([{ type: "auctionWon", player: "p2", space: 3, amount: 60 }]);
    expect(after.properties[3]?.owner).toBe("p2");
    expect(getWaitingFor(after)).toBe("p2");
  });

  it("mit offenem Angebot als Anbieter: das Angebot wird zurückgezogen", () => {
    let state = own(own(newGame(3), "p1", 1), "p2", 3);
    ({ state } = act(state, "p1", offer("p2", side([1]), side([3]))));
    const { state: after, events } = remove(state, "p1");
    expect(eventsOfType(events, "tradeCancelled")).toHaveLength(1);
    expect(after.trade).toBeNull();
    expect(after.properties[3]?.owner).toBe("p2");
  });

  it("mit offenem Angebot als Empfänger: das Angebot gilt als abgelehnt, der Anbieter ist wieder dran", () => {
    let state = own(own(newGame(3), "p1", 1), "p2", 3);
    ({ state } = act(state, "p1", offer("p2", side([1]), side([3]))));
    const { state: after, events } = remove(state, "p2");
    expect(eventsOfType(events, "tradeRejected")).toHaveLength(1);
    expect(after.properties[1]?.owner).toBe("p1");
    const done = passAllAuctions(after);
    expect(getWaitingFor(done)).toBe("p1");
    expect(done.turn.phase).toBe("preRoll");
  });

  it("als Gläubiger: die offene Schuld an ihn verfällt", () => {
    const start = own(own(newGame(3), "p1", 37, 39), "p2", 1);
    setHouses(start, 37, 1);
    setHouses(start, 39, 1); // Miete 200
    player(start, "p2").money = 100;
    start.current = 1;
    placeAt(start, "p2", 35);
    let { state } = act(start, "p2", { type: "rollDice" }, dice([1, 3]));
    expect(state.debts).toHaveLength(1);
    ({ state } = remove(state, "p1"));
    expect(state.debts).toEqual([]);
    expect(player(state, "p2").money).toBe(100);
    const after = passAllAuctions(state);
    expect(getWaitingFor(after)).toBe("p2");
    expect(after.turn.phase).toBe("postRoll");
  });

  it("als Schuldner: die Schuld verfällt, der Gläubiger bekommt nichts", () => {
    const start = own(newGame(3), "p1", 37, 39);
    setHouses(start, 37, 1);
    setHouses(start, 39, 1);
    player(start, "p2").money = 100;
    start.current = 1;
    placeAt(start, "p2", 35);
    let { state } = act(start, "p2", { type: "rollDice" }, dice([1, 3]));
    expect(getWaitingFor(state)).toBe("p2");
    ({ state } = remove(state, "p2"));
    expect(state.debts).toEqual([]);
    expect(player(state, "p1").money).toBe(1500);
    expect(getWaitingFor(state)).toBe("p3");
  });

  it("mit Hypothekenentscheid: der Entscheid verfällt, die Felder gehen an die Bank", () => {
    const start = own(own(newGame(4), "p1", 37, 39), "p2", 12);
    setHouses(start, 37, 5);
    setHouses(start, 39, 5);
    start.properties[12]!.mortgaged = true;
    player(start, "p2").money = 100;
    start.current = 1;
    placeAt(start, "p2", 35);
    let { state } = act(start, "p2", { type: "rollDice" }, dice([1, 3]));
    ({ state } = act(state, "p2", { type: "declareBankruptcy" }));
    expect(state.mortgageDecision).toEqual({ player: "p1", spaces: [12] });
    ({ state } = remove(state, "p1"));
    expect(state.mortgageDecision).toBeNull();
    expect([12, 37, 39].map((s) => state.properties[s])).toEqual([
      { owner: null, houses: 0, mortgaged: false },
      { owner: null, houses: 0, mortgaged: false },
      { owner: null, houses: 0, mortgaged: false },
    ]);
    expect(state.auction?.bidders).toEqual(["p3", "p4"]);
    const after = passAllAuctions(state);
    expect(getWaitingFor(after)).toBe("p3");
  });

  it("bleibt nur ein Spieler übrig, gewinnt er", () => {
    const { state, events } = remove(own(newGame(2), "p2", 1), "p2");
    expect(state.winner).toBe("p1");
    expect(eventsOfType(events, "gameWon")).toEqual([{ type: "gameWon", player: "p1" }]);
    expect(state.auction).toBeNull();
  });

  it("lehnt Unbekannte, Ausgeschiedene und beendete Spiele ab", () => {
    const state = newGame(3);
    const unknown = removePlayer(state, "p9");
    expect(unknown.ok || unknown.error.code).toBe("unknownPlayer");
    const once = remove(state, "p3").state;
    const twice = removePlayer(once, "p3");
    expect(twice.ok || twice.error.code).toBe("playerOut");
    const won = remove(newGame(2), "p2").state;
    const over = removePlayer(won, "p1");
    expect(over.ok || over.error.code).toBe("gameOver");
  });

  it("verändert den alten Spielstand nicht", () => {
    const state = own(newGame(3), "p1", 1);
    const before = JSON.stringify(state);
    remove(state, "p1");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("Zufallspartien mit Entfernen", () => {
  it("Partien 401–450: zufällig entfernte Spieler, Invarianten und Geld-Protokoll stimmen", () => playRandomGames(401, 450, 0.003), 120_000);
});
