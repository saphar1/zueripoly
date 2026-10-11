// Spielerpanel im Stil einer Fahrplanzeile: Figur, Name, Kontostand, Besitzstreifen, Zustand.
import type { CSSProperties } from "react";
import type { ColorGroup, GameState, PlayerState, SpaceIndex } from "@zueripoly/engine";
import {
  COLOR_GROUPS,
  GROUP_STREETS,
  JAIL_INDEX,
  MAX_JAIL_ROLLS,
  STATION_INDICES,
  UTILITY_INDICES,
  countBuildings,
  getSpace,
} from "@zueripoly/engine";
import { formatChf } from "../format";
import { Icon } from "./Icon";
import { Token } from "./Token";
import "./PlayerPanel.css";

interface DeedGroup {
  key: string;
  color: string;
  spaces: readonly SpaceIndex[];
}

/** Besitzstreifen: alle 28 kaufbaren Felder, nach Gruppen in Brettreihenfolge. */
const DEED_GROUPS: DeedGroup[] = [
  ...COLOR_GROUPS.map((group: ColorGroup) => ({
    key: group,
    color: `var(--group-${group})`,
    spaces: GROUP_STREETS[group],
  })),
  { key: "station", color: "var(--group-station)", spaces: STATION_INDICES },
  { key: "utility", color: "var(--group-utility)", spaces: UTILITY_INDICES },
];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function DeedStrip({ player, state }: { player: PlayerState; state: GameState }) {
  return (
    <div className="deeds" aria-hidden="true">
      {DEED_GROUPS.map((group) => {
        const owned = group.spaces.filter((i) => state.properties[i]?.owner === player.id);
        const complete = owned.length === group.spaces.length;
        return (
          <span
            key={group.key}
            className={`deeds__group${complete ? " deeds__group--complete" : ""}`}
            style={{ "--deed": group.color, flexGrow: group.spaces.length } as CSSProperties}
          >
            {group.spaces.map((index) => {
              const property = state.properties[index];
              const mine = property?.owner === player.id;
              return (
                <span
                  key={index}
                  className={`deed${mine ? " deed--owned" : ""}${mine && property?.mortgaged ? " deed--mortgaged" : ""}`}
                  title={getSpace(index).name}
                />
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

function describeOwnership(player: PlayerState, state: GameState): string {
  const owned = Object.entries(state.properties).filter(([, p]) => p.owner === player.id);
  if (owned.length === 0) return "Kein Besitz";
  const mortgaged = owned.filter(([, p]) => p.mortgaged).length;
  const { houses, hotels } = countBuildings(state, player.id);
  const parts = [plural(owned.length, "Feld", "Felder")];
  if (houses > 0) parts.push(plural(houses, "Haus", "Häuser"));
  if (hotels > 0) parts.push(plural(hotels, "Hotel", "Hotels"));
  if (mortgaged > 0) parts.push(`${mortgaged} mit Hypothek`);
  return parts.join(" · ");
}

export function PlayerPanel({ player, state, active }: { player: PlayerState; state: GameState; active: boolean }) {
  const classes = ["panel"];
  if (active) classes.push("panel--active");
  if (player.bankrupt) classes.push("panel--bankrupt");

  return (
    <article className={classes.join(" ")} aria-label={player.name}>
      <header className="panel__head">
        <Token token={player.token} />
        <div className="panel__who">
          <div className="panel__title">
            <h2 className="panel__name">{player.name}</h2>
            {active && <span className="chip chip--turn">Am Zug</span>}
            {player.inJail && (
              <span className="chip chip--jail">
                <Icon name="jail" /> Gefängnis
              </span>
            )}
            {player.jailCards.length > 0 && (
              <span className="chip chip--card" title="Aus dem Gefängnis frei">
                <Icon name="freeCard" /> {player.jailCards.length}
                <span className="visually-hidden"> Freikarte</span>
              </span>
            )}
            {player.bankrupt && <span className="chip chip--bankrupt">Bankrott</span>}
          </div>
          <p className="panel__where">
            {player.bankrupt ? (
              "Ausgeschieden"
            ) : player.inJail ? (
              `Versuch ${player.jailTurns + 1} von ${MAX_JAIL_ROLLS}`
            ) : (
              <>
                <span className="panel__label">Feld</span>{" "}
                {player.position === JAIL_INDEX ? "Gefängnis, nur zu Besuch" : getSpace(player.position).name}
              </>
            )}
          </p>
        </div>
        {!player.bankrupt && <p className="panel__money num">{formatChf(player.money)}</p>}
      </header>
      {!player.bankrupt && (
        <div className="panel__deeds">
          <DeedStrip player={player} state={state} />
          <p className="panel__summary">{describeOwnership(player, state)}</p>
        </div>
      )}
    </article>
  );
}

/** Alle Spielerpanels mit Kopfzeile wie ein Fahrplan. */
export function PlayerList({ state }: { state: GameState }) {
  const current = state.players[state.current];
  return (
    <section className="players" aria-label="Spieler">
      <header className="players__head">
        <h2>Spieler</h2>
        <span className="num">Zug {state.turnNumber}</span>
      </header>
      {state.players.map((player) => (
        <PlayerPanel key={player.id} player={player} state={state} active={player.id === current?.id} />
      ))}
    </section>
  );
}
