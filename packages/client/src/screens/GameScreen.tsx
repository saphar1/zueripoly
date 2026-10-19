// Spiel an einem Gerät (Lokal und Solo): Die Engine läuft im Browser, Bots ziehen mit Denkpause.
// Die Anzeige selbst ist GameView (gemeinsam mit dem Online-Spiel).
import { useEffect } from "react";
import type { GameConfig, GameState } from "@zueripoly/engine";
import { getWaitingFor } from "@zueripoly/engine";
import { type SaveMode, clearLocalGame, saveLocalGame } from "../game/local-save";
import { useBotTurns } from "../game/use-bot-turns";
import { type GameSession, useLocalGame } from "../game/use-local-game";
import { useTurnTimer } from "../game/use-turn-timer";
import { useSignal } from "../screen-history";
import { GameView } from "./GameView";

interface GameScreenProps {
  session: GameSession;
  /** Spielart und Einstellungen: kommen mit in den Spielstand (für «Nochmals spielen» nach dem Fortsetzen). */
  mode: SaveMode;
  config: GameConfig;
  onNewGame: () => void;
  onMenu: () => void;
  /** Zurück-Geste des Browsers (Zähler): fragt nach, ob man aussteigen will. */
  leaveAsk: number;
}

export function GameScreen({ session, mode, config, onNewGame, onMenu, leaveAsk }: GameScreenProps) {
  // Nach jeder Aktion speichern, beim Spielende löschen (fortsetzen gibt es dann nichts mehr).
  const store = (state: GameState) => {
    if (state.winner !== null) clearLocalGame();
    else saveLocalGame(mode, config, session, state);
  };
  const game = useLocalGame(session, store);
  // Auch der Startstand: Neuladen vor dem ersten Wurf führt ebenfalls zurück ins Spiel.
  useEffect(() => store(session.initial), [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const { state, act } = game;
  const waiting = getWaitingFor(state);
  // Ist ein Computergegner dran, entscheidet er selbst; die Bedienelemente für Menschen ruhen so lange.
  const botWaiting = useBotTurns(game, session.botRng);
  const human = waiting !== null && botWaiting === null;

  // Das Zeitlimit gilt nur für Menschen (docs/regeln.md, Abschnitt 14).
  const secondsLeft = useTurnTimer(state.options.turnTimeLimit, state, game.busy || state.winner !== null || !human, () => {
    if (waiting && human) act(waiting, { type: "timeout" });
  });

  // Nach Spielende braucht es keine Rückfrage mehr.
  useSignal(leaveAsk, () => {
    if (state.winner) onMenu();
  });

  return (
    <GameView
      game={game}
      me={null}
      canAct={human}
      onAct={(action, as) => {
        const who = as ?? waiting;
        if (who) act(who, action);
      }}
      secondsLeft={human ? secondsLeft : null}
      endActions={
        <div className="tafel__actions">
          <button type="button" className="button button--primary" onClick={onNewGame}>
            Nochmals spielen
          </button>
          <button type="button" className="button" onClick={onMenu}>
            Zum Hauptmenü
          </button>
        </div>
      }
      leave={state.winner ? null : { onLeave: onMenu, askToken: leaveAsk, warning: "Der Spielstand bleibt gespeichert. Du kannst ihn im Hauptmenü fortsetzen." }}
    />
  );
}
