// Fester Beispiel-Spielstand für den Designentwurf (Mitte einer Partie, 6 Spieler).
// Nur zum Anzeigen: Der Zustand wird direkt gesetzt und läuft nicht über applyAction.
import type { GameState, PlayerId, SpaceIndex } from "@zueripoly/engine";
import { TOTAL_HOTELS, TOTAL_HOUSES, createGame, createSeededRng } from "@zueripoly/engine";
import type { SignMessage } from "../components/Sign";

interface DemoPlayer {
  money: number;
  position: SpaceIndex;
  inJail?: boolean;
  jailTurns?: number;
  jailCards?: string[];
  bankrupt?: boolean;
  /** Feld → Häuser (0–4, 5 = Hotel); negativ = mit Hypothek belastet. */
  owns: Record<SpaceIndex, number>;
}

const SEATS: Record<PlayerId, DemoPlayer> = {
  anna: { money: 1240, position: 18, owns: { 1: 2, 3: 2, 5: 0, 6: 0, 15: 0 } },
  ben: { money: 860, position: 24, owns: { 12: 0, 16: 3, 18: 3, 19: 3 } },
  clara: { money: 310, position: 10, inJail: true, jailTurns: 1, jailCards: ["E08"], owns: { 11: -1, 21: 0, 23: 0 } },
  dario: { money: 1575, position: 10, owns: { 26: 0, 31: 4, 32: 4, 34: 5 } },
  elif: { money: 95, position: 24, owns: { 8: 0, 9: 0, 25: 0, 28: -1, 37: 0, 39: 0 } },
  fabio: { money: 0, position: 0, bankrupt: true, owns: {} },
};

export function createDemoState(): GameState {
  const state = createGame(
    {
      players: [
        { id: "anna", name: "Anna", token: "tram" },
        { id: "ben", name: "Ben", token: "swan" },
        { id: "clara", name: "Clara", token: "boeoegg" },
        { id: "dario", name: "Dario", token: "fondue" },
        { id: "elif", name: "Elif", token: "bike" },
        { id: "fabio", name: "Fabio", token: "coffee" },
      ],
      options: { jackpot: true },
    },
    createSeededRng(1),
  );

  // Sitzordnung fest wie oben, Anna ist am Zug.
  const order = Object.keys(SEATS);
  state.players.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  state.current = 0;
  state.turnNumber = 23;
  state.turn = { phase: "postRoll", doublesCount: 0, extraRoll: false, dice: [4, 3], pendingBuy: null };
  state.jackpot = 350;

  let houses = 0;
  let hotels = 0;
  for (const player of state.players) {
    const seat = SEATS[player.id];
    if (!seat) continue;
    player.money = seat.money;
    player.position = seat.position;
    player.inJail = seat.inJail ?? false;
    player.jailTurns = seat.jailTurns ?? 0;
    player.jailCards = seat.jailCards ?? [];
    player.bankrupt = seat.bankrupt ?? false;
    for (const [index, level] of Object.entries(seat.owns)) {
      const property = state.properties[Number(index)];
      if (!property) continue;
      property.owner = player.id;
      property.mortgaged = level < 0;
      property.houses = Math.max(0, level);
      if (level === 5) hotels += 1;
      else if (level > 0) houses += level;
    }
  }
  state.bank = { houses: TOTAL_HOUSES - houses, hotels: TOTAL_HOTELS - hotels };
  return state;
}

/** Was die Haltestellentafel im Entwurf zeigt. */
export const DEMO_MESSAGE: SignMessage = {
  token: "tram",
  line: "Anna · 4 + 3",
  label: "Nächster Halt",
  stop: "Langstrasse",
  note: "Ben kassiert 550 CHF Miete. Das wird teuer.",
};
