// Das Spielbrett: 11×11-Raster mit 40 Feldern und der Mitte.
// Die Grösse kommt von aussen (CSS-Variable --board-size); alles darin rechnet in --u (eine Feldbreite).
// Jedes Feld steckt in einer Zelle, die Zeiger, Fokus und Klick behandelt (Felder selbst sind reine Anzeige).
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import type { DeckId, Dice, GameState, PlayerId, SpaceIndex } from "@zueripoly/engine";
import { BOARD } from "@zueripoly/engine";
import { placeTile } from "../board-layout";
import { describeSpace, ownerOf } from "../space-text";
import { BoardCenter } from "./BoardCenter";
import { CornerTile } from "./CornerTile";
import type { SignMessage } from "./Sign";
import { Tile } from "./Tile";
import "./Board.css";

export interface BoardProps {
  state: GameState;
  message: SignMessage | null;
  /** Feld unter dem Zeiger oder mit Fokus: hebt sich an. */
  focusSpace?: SpaceIndex | null;
  /** Angetipptes / angeklicktes Feld: bleibt markiert. */
  selectedSpace?: SpaceIndex | null;
  /** Spieler, dessen Felder hervorgehoben werden (alle anderen unter einem Papierschleier). */
  highlightPlayer?: PlayerId | null;
  /** Figur, die gerade Feld für Feld zieht. */
  movingPlayer?: PlayerId | null;
  /** Augen, die während des Rollens gezeigt werden (sonst der letzte Wurf aus dem Zustand). */
  rollingDice?: Dice | null;
  /** Inhalt über der Brettmitte, z. B. Besitzkarte oder gezogene Karte. */
  overlay?: ReactNode;
  onSpaceHover?: (index: SpaceIndex | null) => void;
  onSpaceSelect?: (index: SpaceIndex) => void;
  onRoll?: () => void;
  onDeckSelect?: (deck: DeckId) => void;
}

export function Board({
  state,
  message,
  focusSpace = null,
  selectedSpace = null,
  highlightPlayer = null,
  movingPlayer = null,
  rollingDice = null,
  overlay,
  onSpaceHover,
  onSpaceSelect,
  onRoll,
  onDeckSelect,
}: BoardProps) {
  const onBoard = state.players.filter((p) => !p.bankrupt);
  const highlighted = state.players.find((p) => p.id === highlightPlayer);
  const markColor = highlighted ? `var(--player-${highlighted.token})` : undefined;
  const interactive = Boolean(onSpaceHover || onSpaceSelect);

  // Nur echte Mauszeiger lösen Hover aus; auf Touch-Geräten wählt Antippen aus.
  const hover = (index: SpaceIndex | null) => (event: PointerEvent) => {
    if (event.pointerType === "mouse") onSpaceHover?.(index);
  };
  const keySelect = (index: SpaceIndex) => (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSpaceSelect?.(index);
    }
  };

  return (
    <div className={`board${highlightPlayer ? " board--highlighting" : ""}`} role="group" aria-label="Spielbrett">
      {BOARD.map((space) => {
        const { row, column, side } = placeTile(space.index);
        const here = onBoard.filter((p) => p.position === space.index);
        const property = state.properties[space.index] ?? null;
        const owner = ownerOf(state, space.index);

        const classes = ["board__cell"];
        if (space.index === focusSpace) classes.push("board__cell--focus");
        if (space.index === selectedSpace) classes.push("board__cell--selected");
        if (highlightPlayer) classes.push(owner?.id === highlightPlayer ? "board__cell--marked" : "board__cell--veiled");

        const marks = { movingPlayer, markedPlayer: highlightPlayer };
        return (
          <div
            key={space.index}
            className={classes.join(" ")}
            style={{ gridRow: row, gridColumn: column, "--mark": markColor } as CSSProperties}
            role={interactive ? "button" : "img"}
            tabIndex={interactive ? 0 : undefined}
            aria-label={describeSpace(state, space.index)}
            aria-pressed={interactive ? space.index === selectedSpace : undefined}
            onPointerEnter={hover(space.index)}
            onPointerLeave={hover(null)}
            onFocus={() => onSpaceHover?.(space.index)}
            onBlur={() => onSpaceHover?.(null)}
            onClick={() => onSpaceSelect?.(space.index)}
            onKeyDown={keySelect(space.index)}
          >
            {side === null ? (
              <CornerTile
                space={space}
                visitors={here.filter((p) => !p.inJail)}
                prisoners={here.filter((p) => p.inJail)}
                jackpot={state.options.jackpot ? state.jackpot : null}
                {...marks}
              />
            ) : (
              <Tile space={space} side={side} property={property} owner={owner} visitors={here} {...marks} />
            )}
          </div>
        );
      })}
      <BoardCenter
        state={state}
        message={message}
        rollingDice={rollingDice}
        overlay={overlay}
        onRoll={onRoll}
        onDeckSelect={onDeckSelect}
      />
    </div>
  );
}
