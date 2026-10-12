// Spielansicht, gemeinsam für Lokal, Solo und Online: Brett links, rechts Tafel mit der Entscheidung,
// Spieler und Protokoll. Wer gerade entscheidet, sagt die Engine (getWaitingFor); angeboten wird nur,
// was getLegalActions erlaubt. Woher der Spielstand kommt (Engine im Browser oder Server), regelt der
// Bildschirm darüber (GameScreen, OnlineGameScreen).
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Action, CardId, Dice, GameState, PlayerId, SpaceIndex } from "@zueripoly/engine";
import { getLegalActions, getWaitingFor } from "@zueripoly/engine";
import { ActionPanel } from "../components/ActionPanel";
import { Board } from "../components/Board";
import { BoardViewport } from "../components/BoardViewport";
import { DeedCard } from "../components/DeedCard";
import { EventCard } from "../components/EventCard";
import { GameLog } from "../components/GameLog";
import { PlayerList, type PlayerPresence } from "../components/PlayerPanel";
import { PropertyActions } from "../components/PropertyActions";
import { Sign, type SignMessage } from "../components/Sign";
import type { LogEntry } from "../game/use-game-playback";
import { ownerOf } from "../space-text";
import "./GameScreen.css";

/** Was die Ansicht vom Spiel braucht (aus useLocalGame oder useOnlineGame). */
export interface GameViewModel {
  /** Wahrheit: danach richten sich Tafel und Knöpfe. */
  state: GameState;
  /** Anzeige: während einer Bewegung noch der alte Stand. */
  view: GameState;
  busy: boolean;
  rollingDice: Dice | null;
  movingPlayer: PlayerId | null;
  card: CardId | null;
  message: SignMessage | null;
  log: LogEntry[];
  error: string | null;
  dismissCard: () => void;
}

interface GameViewProps {
  game: GameViewModel;
  /** Online: der eigene Platz. Lokal null. */
  me: PlayerId | null;
  /** Darf jemand an diesem Gerät jetzt für den Wartenden entscheiden? */
  canAct: boolean;
  /** Aktion für den Wartenden (oder mit `as` für jemand anderen, z. B. eigenes Angebot zurückziehen). */
  onAct: (action: Action, as?: PlayerId) => void;
  secondsLeft: number | null;
  waitingLabel?: string | null;
  waitingNote?: string | null;
  presence?: Record<PlayerId, PlayerPresence>;
  /** Knöpfe auf der Tafel nach Spielende. */
  endActions: ReactNode;
  /** Über den Spielern, z. B. Störungsmeldung (online). */
  notice?: ReactNode;
  /** Ganz oben, z. B. «Verbindung unterbrochen». */
  banner?: ReactNode;
  /** Unter dem Protokoll: Spiel verlassen. */
  leave?: ReactNode;
}

export function GameView({
  game,
  me,
  canAct,
  onAct,
  secondsLeft,
  waitingLabel,
  waitingNote,
  presence,
  endActions,
  notice,
  banner,
  leave,
}: GameViewProps) {
  const { state, view, dismissCard } = game;
  const waiting = getWaitingFor(state);

  const [hovered, setHovered] = useState<SpaceIndex | null>(null);
  const [selected, setSelected] = useState<SpaceIndex | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<PlayerId | null>(null);
  const focusSpace = hovered ?? selected;
  const linkedPlayer = hoveredPlayer ?? (focusSpace !== null ? (ownerOf(view, focusSpace)?.id ?? null) : null);

  const actNow = useCallback(
    (action: Action) => {
      if (canAct) onAct(action);
    },
    [canAct, onAct],
  );

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

  const canRoll = canAct && !game.busy && waiting !== null && getLegalActions(state, waiting).some((a) => a.type === "rollDice");

  const deedCard = (index: SpaceIndex) => (
    <DeedCard state={view} index={index}>
      {index === selected && canAct && waiting !== null && !game.busy && (
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
      {banner}
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
          secondsLeft={secondsLeft}
          me={me}
          waitingLabel={waitingLabel}
          waitingNote={waitingNote}
          onAct={onAct}
          endActions={endActions}
        />
      </div>

      {/* Auf dem Handy ist die Brettmitte zu klein: Tafel, Karte und Besitzkarte stehen dort unter dem Brett. */}
      <div className="game__below">
        {game.message && <Sign {...game.message} />}
        {game.card && <EventCard cardId={game.card} onClose={dismissCard} />}
        {selected !== null && deedCard(selected)}
      </div>

      <div className="game__side">
        {notice}
        <PlayerList
          state={view}
          presence={presence}
          linkedPlayer={linkedPlayer}
          focusSpace={focusSpace}
          onPlayerHover={setHoveredPlayer}
          onSpaceHover={setHovered}
        />
        <GameLog entries={game.log} />
        {leave}
      </div>
    </main>
  );
}

/** «Spiel verlassen» mit Rückfrage. */
export function LeaveGame({ onLeave, warning }: { onLeave: () => void; warning: string }) {
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
      <p>{warning}</p>
      <button type="button" className="button button--danger" onClick={onLeave}>
        Ja, aussteigen
      </button>
      <button type="button" className="button" onClick={() => setAsking(false)}>
        Weiterspielen
      </button>
    </div>
  );
}
