// Spiel an einem Gerät (Lokal und Solo): Die Engine läuft im Browser, Bots ziehen mit Denkpause.
// Die Anzeige selbst ist GameView (gemeinsam mit dem Online-Spiel).
import { getWaitingFor } from "@zueripoly/engine";
import { useBotTurns } from "../game/use-bot-turns";
import { type GameSession, useLocalGame } from "../game/use-local-game";
import { useTurnTimer } from "../game/use-turn-timer";
import { useSignal } from "../screen-history";
import { GameView } from "./GameView";

interface GameScreenProps {
  session: GameSession;
  onNewGame: () => void;
  onMenu: () => void;
  /** Zurück-Geste des Browsers (Zähler): fragt nach, ob man aussteigen will. */
  leaveAsk: number;
}

export function GameScreen({ session, onNewGame, onMenu, leaveAsk }: GameScreenProps) {
  const game = useLocalGame(session);
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
      leave={state.winner ? null : { onLeave: onMenu, askToken: leaveAsk, warning: "Wirklich aussteigen? Der Spielstand geht verloren." }}
    />
  );
}
