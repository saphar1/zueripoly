// Tempo auf dem Server: Wie lange spielt der Browser die letzten Ereignisse ab, und wie lange
// «denkt» ein Computergegner? Gleiche Werte wie im Client (styles/tokens.css und game/use-bot-turns.ts),
// damit Online-Partien sich gleich anfühlen wie Solo-Partien.
import type { Action, GameEvent } from "@zueripoly/engine";
import { BOARD_SIZE } from "@zueripoly/engine";

/** Bewegungsdauern wie `--motion-*` in tokens.css (volle Bewegung, nicht «weniger Bewegung»). */
const MOTION = { dice: 600, step: 150, card: 500, cardRead: 1400 } as const;

/** Denkpausen wie in game/use-bot-turns.ts. */
const THINK_MS = 1000;
const QUICK_MS = 500;
const READ_CARD_MS = 2000;
const NO_AUDIENCE_MS = 150;
const QUICK: readonly Action["type"][] = ["bid", "passBid", "buildHouse", "sellBuilding", "mortgage", "unmortgage"];

/** Ungefähre Abspielzeit der Ereignisse im Browser (Würfel, Figur Feld für Feld, Karte). */
export function playbackMs(events: readonly GameEvent[]): number {
  let ms = 0;
  events.forEach((event, i) => {
    switch (event.type) {
      case "diceRolled":
        ms += MOTION.dice;
        break;
      case "moved": {
        const steps = event.direction === "forward" ? event.to - event.from : event.from - event.to;
        ms += ((steps + BOARD_SIZE) % BOARD_SIZE) * MOTION.step;
        break;
      }
      case "sentToJail":
        ms += MOTION.card;
        break;
      case "cardDrawn":
        if (events.slice(i + 1).some((e) => e.type === "moved" || e.type === "sentToJail")) ms += MOTION.card + MOTION.cardRead;
        break;
      default:
        break;
    }
  });
  return ms;
}

/** Denkpause eines Computergegners vor `action` (ohne Abspielzeit). */
export function botPauseMs(action: Action, lastEvents: readonly GameEvent[], humansPlaying: boolean): number {
  if (!humansPlaying) return NO_AUDIENCE_MS;
  if (lastEvents.some((e) => e.type === "cardDrawn")) return READ_CARD_MS;
  return QUICK.includes(action.type) ? QUICK_MS : THINK_MS;
}
