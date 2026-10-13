// Spielansicht, gemeinsam für Lokal, Solo und Online: Brett links, rechts Tafel mit der Entscheidung,
// Spieler und Protokoll. Wer gerade entscheidet, sagt die Engine (getWaitingFor); angeboten wird nur,
// was getLegalActions erlaubt. Woher der Spielstand kommt (Engine im Browser oder Server), regelt der
// Bildschirm darüber (GameScreen, OnlineGameScreen).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { useSignal } from "../screen-history";
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
  /** «Spiel verlassen» mit Rückfrage (nach Spielende null). */
  leave?: LeaveOptions | null;
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

  // Knopf «Bauen» auf der Tafel: Besitzkarte öffnen. Auf dem Handy steht sie unter dem Brett, also ins Bild holen.
  const below = useRef<HTMLDivElement>(null);
  const showSpace = useCallback((index: SpaceIndex) => {
    setSelected(index);
    requestAnimationFrame(() => {
      const card = below.current?.querySelector(".deed-card");
      if (card && card.getClientRects().length > 0) card.scrollIntoView({ block: "nearest" });
    });
  }, []);

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
      {/* Nur auf dem Handy: schmale Kopfleiste mit Zug und Menü (auf dem Desktop steht «Spiel verlassen» rechts unten). */}
      <header className="game__bar">
        <p className="game__bar-title">
          ZüriPoly <span className="num">· Zug {view.turnNumber}</span>
        </p>
        {leave && <LeaveGame {...leave} label="Menü" />}
      </header>

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
          onShowSpace={canAct ? showSpace : undefined}
        />
      </div>

      {/* Auf dem Handy ist die Brettmitte zu klein: Haltestellentafel (schmal, über der Tafel) und
          gezogene Karte oder gewählte Besitzkarte (ein Platz unter der Tafel) stehen dort ausserhalb. */}
      <div className="game__news">{game.message && <Sign {...game.message} compact />}</div>
      <div ref={below} className="game__below">
        {game.card ? <EventCard cardId={game.card} onClose={dismissCard} /> : selected !== null ? deedCard(selected) : null}
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
        {leave && (
          <div className="game__leave-side">
            <LeaveGame {...leave} />
          </div>
        )}
      </div>
    </main>
  );
}

export interface LeaveOptions {
  onLeave: () => void;
  warning: string;
  /** Jede Erhöhung öffnet die Rückfrage von aussen (Zurück-Geste des Browsers). */
  askToken?: number;
}

/**
 * «Spiel verlassen» mit Rückfrage. Steht zweimal in der Ansicht (Handy: Kopfleiste, Desktop: rechts
 * unten); CSS blendet je eines aus, beide öffnen sich bei der Zurück-Geste.
 */
function LeaveGame({ onLeave, warning, askToken = 0, label = "Spiel verlassen" }: LeaveOptions & { label?: string }) {
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useSignal(askToken, () => setAsking(true));
  // Von aussen geöffnet: Rückfrage ins Bild holen. Ausgeblendet (getClientRects leer): nichts tun.
  useEffect(() => {
    const element = box.current;
    if (asking && element && element.getClientRects().length > 0) element.scrollIntoView({ block: "nearest" });
  }, [asking, askToken]);

  if (!asking) {
    return (
      <button type="button" className="button game__leave" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div ref={box} className="game__leave-ask" role="group" aria-label="Spiel verlassen?">
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
