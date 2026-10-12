// Spielansicht (lokal, ein Gerät): Brett links, rechts Tafel mit der Entscheidung, Spieler, Protokoll.
// Wer gerade entscheidet, sagt die Engine (getWaitingFor); angeboten wird nur, was getLegalActions erlaubt.
import { useCallback, useEffect, useState } from "react";
import type { Action, PlayerId, SpaceIndex } from "@zueripoly/engine";
import { getLegalActions, getWaitingFor } from "@zueripoly/engine";
import { ActionPanel } from "../components/ActionPanel";
import { Board } from "../components/Board";
import { BoardViewport } from "../components/BoardViewport";
import { DeedCard } from "../components/DeedCard";
import { EventCard } from "../components/EventCard";
import { GameLog } from "../components/GameLog";
import { PlayerList } from "../components/PlayerPanel";
import { PropertyActions } from "../components/PropertyActions";
import { Sign } from "../components/Sign";
import { useBotTurns } from "../game/use-bot-turns";
import { type GameSession, useLocalGame } from "../game/use-local-game";
import { useTurnTimer } from "../game/use-turn-timer";
import { ownerOf } from "../space-text";
import "./GameScreen.css";

interface GameScreenProps {
  session: GameSession;
  onNewGame: () => void;
  onMenu: () => void;
}

function LeaveGame({ onMenu }: { onMenu: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="button game__leave" onClick={() => setAsking(true)}>
        Spiel verlassen
      </button>
    );
  }
  return (
    <div className="game__leave-ask" role="group" aria-label="Spiel verlassen?">
      <p>Wirklich aussteigen? Der Spielstand geht verloren.</p>
      <button type="button" className="button button--danger" onClick={onMenu}>
        Ja, aussteigen
      </button>
      <button type="button" className="button" onClick={() => setAsking(false)}>
        Weiterspielen
      </button>
    </div>
  );
}

export function GameScreen({ session, onNewGame, onMenu }: GameScreenProps) {
  const game = useLocalGame(session);
  const { state, view, act, dismissCard } = game;
  const waiting = getWaitingFor(state);
  // Ist ein Computergegner dran, entscheidet er selbst; die Bedienelemente für Menschen ruhen so lange.
  const botWaiting = useBotTurns(game, session.botRng);
  const human = waiting !== null && botWaiting === null;

  const [hovered, setHovered] = useState<SpaceIndex | null>(null);
  const [selected, setSelected] = useState<SpaceIndex | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<PlayerId | null>(null);
  const focusSpace = hovered ?? selected;
  const linkedPlayer = hoveredPlayer ?? (focusSpace !== null ? (ownerOf(view, focusSpace)?.id ?? null) : null);

  const actNow = useCallback(
    (action: Action) => {
      if (waiting && human) act(waiting, action);
    },
    [act, waiting, human],
  );

  // Das Zeitlimit gilt nur für Menschen (docs/regeln.md, Abschnitt 14).
  const secondsLeft = useTurnTimer(state.options.turnTimeLimit, state, game.busy || state.winner !== null || !human, () => {
    if (waiting && human) act(waiting, { type: "timeout" });
  });

  // Esc hebt Auswahl und gezogene Karte auf.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelected(null);
      dismissCard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissCard]);

  const canRoll = human && !game.busy && getLegalActions(state, waiting).some((a) => a.type === "rollDice");

  const deedCard = (index: SpaceIndex) => (
    <DeedCard state={view} index={index}>
      {index === selected && human && !game.busy && (
        <PropertyActions state={state} actor={waiting} index={index} disabled={game.busy} onAct={actNow} />
      )}
    </DeedCard>
  );

  const overlay = game.card ? (
    <EventCard cardId={game.card} onClose={dismissCard} />
  ) : focusSpace !== null ? (
    deedCard(focusSpace)
  ) : null;

  return (
    <main className="game">
      <div className="game__board">
        <BoardViewport>
          <Board
            state={view}
            message={game.message}
            focusSpace={focusSpace}
            selectedSpace={selected}
            highlightPlayer={hoveredPlayer}
            movingPlayer={game.movingPlayer}
            rollingDice={game.rollingDice}
            overlay={overlay}
            onSpaceHover={setHovered}
            onSpaceSelect={(index) => setSelected((current) => (current === index ? null : index))}
            onRoll={canRoll ? () => actNow({ type: "rollDice" }) : undefined}
          />
        </BoardViewport>
      </div>

      <div className="game__panel">
        <ActionPanel
          state={state}
          busy={game.busy}
          error={game.error}
          secondsLeft={human ? secondsLeft : null}
          onAct={(action, as) => {
            const who = as ?? waiting;
            if (who) act(who, action);
          }}
          onNewGame={onNewGame}
          onMenu={onMenu}
        />
      </div>

      {/* Auf dem Handy ist die Brettmitte zu klein: Tafel, Karte und Besitzkarte stehen dort unter dem Brett. */}
      <div className="game__below">
        {game.message && <Sign {...game.message} />}
        {game.card && <EventCard cardId={game.card} onClose={dismissCard} />}
        {selected !== null && deedCard(selected)}
      </div>

      <div className="game__side">
        <PlayerList
          state={view}
          linkedPlayer={linkedPlayer}
          focusSpace={focusSpace}
          onPlayerHover={setHoveredPlayer}
          onSpaceHover={setHovered}
        />
        <GameLog entries={game.log} />
        {!state.winner && <LeaveGame onMenu={onMenu} />}
      </div>
    </main>
  );
}
