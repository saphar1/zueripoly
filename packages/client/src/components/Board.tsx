// Das Spielbrett: 11×11-Raster mit 40 Feldern und der Mitte.
// Die Grösse kommt von aussen (CSS-Variable --board-size); alles darin rechnet in --u (eine Feldbreite).
import type { GameState } from "@zueripoly/engine";
import { BOARD } from "@zueripoly/engine";
import { placeTile } from "../board-layout";
import { BoardCenter } from "./BoardCenter";
import { CornerTile } from "./CornerTile";
import type { SignMessage } from "./Sign";
import { Tile } from "./Tile";
import "./Board.css";

export function Board({ state, message }: { state: GameState; message: SignMessage | null }) {
  const onBoard = state.players.filter((p) => !p.bankrupt);

  return (
    <div className="board" role="group" aria-label="Spielbrett">
      {BOARD.map((space) => {
        const { row, column, side } = placeTile(space.index);
        const style = { gridRow: row, gridColumn: column };
        const here = onBoard.filter((p) => p.position === space.index);

        if (side === null) {
          return (
            <CornerTile
              key={space.index}
              space={space}
              visitors={here.filter((p) => !p.inJail)}
              prisoners={here.filter((p) => p.inJail)}
              jackpot={state.options.jackpot ? state.jackpot : null}
              style={style}
            />
          );
        }

        const property = state.properties[space.index] ?? null;
        const owner = property?.owner ? (state.players.find((p) => p.id === property.owner) ?? null) : null;
        return (
          <Tile
            key={space.index}
            space={space}
            side={side}
            property={property}
            owner={owner}
            visitors={here}
            style={style}
          />
        );
      })}
      <BoardCenter state={state} message={message} />
    </div>
  );
}
