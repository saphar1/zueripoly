// Computergegner im lokalen Spiel: Wartet das Spiel auf einen Bot und läuft keine Bewegung,
// überlegt der Bot kurz (Denkpause), dann führt der Hook seine Aktion wie die eines Menschen aus.
// Die Pause ist Lesezeit, keine Animation: Sie bleibt auch bei «weniger Bewegung» bestehen.
import { useEffect } from "react";
import type { Action, GameState, PlayerId, Rng } from "@zueripoly/engine";
import { chooseBotAction, getWaitingFor } from "@zueripoly/engine";
import type { LocalGame } from "./use-local-game";

/** Normale Denkpause vor einem Entscheid. */
const THINK_MS = 1000;
/** Kürzere Pause für Folgeschritte (Gebote, Bauen, Belasten). */
const QUICK_MS = 500;
/** Nach einer gezogenen Karte: Zeit zum Lesen. */
const READ_CARD_MS = 2000;
/** Spielen nur noch Bots, laufen sie im Zeitraffer zu Ende. */
const NO_AUDIENCE_MS = 150;

const QUICK: readonly Action["type"][] = ["bid", "passBid", "buildHouse", "sellBuilding", "mortgage", "unmortgage"];

/** Nur im Entwicklungsmodus: `?botpause=50` setzt alle Pausen (für den Durchspiel-Test). */
function devPause(): number | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(window.location.search).get("botpause");
  return value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
}

/** Ist der Spieler ein Computergegner? */
export function isBot(state: GameState, id: PlayerId | null): boolean {
  return id !== null && Boolean(state.players.find((p) => p.id === id)?.bot);
}

function pauseFor(state: GameState, action: Action, cardShown: boolean): number {
  const dev = devPause();
  if (dev !== null) return dev;
  if (!state.players.some((p) => !p.bot && !p.bankrupt)) return NO_AUDIENCE_MS;
  if (cardShown) return READ_CARD_MS;
  return QUICK.includes(action.type) ? QUICK_MS : THINK_MS;
}

/**
 * Lässt die Computergegner ziehen. Gibt den Bot zurück, auf den das Spiel wartet (oder null).
 * `botRng` ist die eigene Zufallsquelle der Bots.
 */
export function useBotTurns(game: LocalGame, botRng: Rng): PlayerId | null {
  const { state, busy, act, card } = game;
  const waiting = getWaitingFor(state);
  const bot = isBot(state, waiting) ? waiting : null;

  useEffect(() => {
    if (bot === null || busy || state.winner !== null) return;
    const action = chooseBotAction(state, bot, botRng);
    const id = window.setTimeout(() => {
      if (act(bot, action)) return;
      // Darf nicht vorkommen (die Engine-Tests prüfen jede Bot-Aktion). Dann den Standardschritt der Engine nehmen.
      console.warn(`Computergegner ${bot}: Aktion ${action.type} abgelehnt, nehme den Standardschritt.`);
      act(bot, { type: "timeout" });
    }, pauseFor(state, action, card !== null));
    return () => window.clearTimeout(id);
  }, [state, busy, bot, card, act, botRng]);

  return bot;
}
