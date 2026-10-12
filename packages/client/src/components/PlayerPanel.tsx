// Spielerpanel im Stil einer Fahrplanzeile: Figur, Name, Kontostand, Besitzstreifen, Zustand.
import type { CSSProperties, PointerEvent } from "react";
import type { BotLevel, ColorGroup, GameState, PlayerId, PlayerState, SpaceIndex } from "@zueripoly/engine";
import {
  BOT_LEVEL_NAMES,
  COLOR_GROUPS,
  GROUP_STREETS,
  JAIL_INDEX,
  MAX_JAIL_ROLLS,
  STATION_INDICES,
  UTILITY_INDICES,
  countBuildings,
  getSpace,
} from "@zueripoly/engine";
import { Icon } from "./Icon";
import { Money } from "./Money";
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

/** Nur echte Mauszeiger lösen Hover aus; auf Touch-Geräten gibt es kein Hover. */
function onMouse(handler: () => void) {
  return (event: PointerEvent) => {
    if (event.pointerType === "mouse") handler();
  };
}

interface DeedStripProps {
  player: PlayerState;
  state: GameState;
  focusSpace: SpaceIndex | null;
  onSpaceHover?: (index: SpaceIndex | null) => void;
}

function DeedStrip({ player, state, focusSpace, onSpaceHover }: DeedStripProps) {
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
              const classes = ["deed"];
              if (mine) classes.push("deed--owned");
              if (mine && property?.mortgaged) classes.push("deed--mortgaged");
              if (index === focusSpace) classes.push("deed--focus");
              return (
                <span
                  key={index}
                  className={classes.join(" ")}
                  onPointerEnter={onMouse(() => onSpaceHover?.(index))}
                  onPointerLeave={onMouse(() => onSpaceHover?.(null))}
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

/** Online: Verbindung und Vertretung eines Platzes (lokal gibt es das nicht). */
export interface PlayerPresence {
  /** Das bist du (dieses Fenster). */
  you: boolean;
  connected: boolean;
  /** Hat das Spiel verlassen. */
  left: boolean;
  /** Ein Computer spielt für diesen Menschen. */
  standIn: BotLevel | null;
}

interface PlayerPanelProps {
  player: PlayerState;
  state: GameState;
  active: boolean;
  presence?: PlayerPresence;
  /** Verknüpft: der Spieler besitzt das Feld unter dem Zeiger, oder sein Panel ist unter dem Zeiger. */
  linked?: boolean;
  focusSpace?: SpaceIndex | null;
  onPlayerHover?: (id: PlayerId | null) => void;
  onSpaceHover?: (index: SpaceIndex | null) => void;
}

export function PlayerPanel({
  player,
  state,
  active,
  presence,
  linked = false,
  focusSpace = null,
  onPlayerHover,
  onSpaceHover,
}: PlayerPanelProps) {
  const classes = ["panel"];
  if (active) classes.push("panel--active");
  if (player.bankrupt) classes.push("panel--bankrupt");
  if (linked) classes.push("panel--linked");
  const interactive = Boolean(onPlayerHover) && !player.bankrupt;

  return (
    <article
      className={classes.join(" ")}
      aria-label={player.name}
      style={{ "--player": `var(--player-${player.token})` } as CSSProperties}
      tabIndex={interactive ? 0 : undefined}
      onPointerEnter={interactive ? onMouse(() => onPlayerHover?.(player.id)) : undefined}
      onPointerLeave={interactive ? onMouse(() => onPlayerHover?.(null)) : undefined}
      onFocus={interactive ? () => onPlayerHover?.(player.id) : undefined}
      onBlur={interactive ? () => onPlayerHover?.(null) : undefined}
    >
      <header className="panel__head">
        <Token token={player.token} />
        <div className="panel__who">
          <div className="panel__title">
            <h2 className="panel__name">{player.name}</h2>
            {presence?.you && <span className="chip chip--you">Du</span>}
            {player.bot && <span className="chip chip--bot">Computer · {BOT_LEVEL_NAMES[player.bot]}</span>}
            {active && <span className="chip chip--turn">Am Zug</span>}
            {presence && !player.bankrupt && presence.left && <span className="chip chip--away">Ausgestiegen</span>}
            {presence && !player.bankrupt && !presence.left && !presence.connected && <span className="chip chip--away">Getrennt</span>}
            {presence?.standIn && !player.bankrupt && <span className="chip chip--bot">Computer vertritt</span>}
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
        {!player.bankrupt && <Money amount={player.money} className="panel__money" />}
      </header>
      {!player.bankrupt && (
        <div className="panel__deeds">
          <DeedStrip player={player} state={state} focusSpace={focusSpace} onSpaceHover={onSpaceHover} />
          <p className="panel__summary">{describeOwnership(player, state)}</p>
        </div>
      )}
    </article>
  );
}

interface PlayerListProps {
  state: GameState;
  /** Online: Verbindung je Spieler. */
  presence?: Record<PlayerId, PlayerPresence>;
  /** Spieler, dessen Panel markiert ist (Besitzer des Feldes unter dem Zeiger oder Panel unter dem Zeiger). */
  linkedPlayer?: PlayerId | null;
  focusSpace?: SpaceIndex | null;
  onPlayerHover?: (id: PlayerId | null) => void;
  onSpaceHover?: (index: SpaceIndex | null) => void;
}

/** Alle Spielerpanels mit Kopfzeile wie ein Fahrplan. */
export function PlayerList({ state, presence, linkedPlayer = null, focusSpace = null, onPlayerHover, onSpaceHover }: PlayerListProps) {
  const current = state.players[state.current];
  return (
    <section className="players" aria-label="Spieler">
      <header className="players__head">
        <h2>Spieler</h2>
        <span className="num">Zug {state.turnNumber}</span>
      </header>
      {state.players.map((player) => (
        <PlayerPanel
          key={player.id}
          player={player}
          state={state}
          active={state.winner === null && !player.bankrupt && player.id === current?.id}
          presence={presence?.[player.id]}
          linked={player.id === linkedPlayer}
          focusSpace={focusSpace}
          onPlayerHover={onPlayerHover}
          onSpaceHover={onSpaceHover}
        />
      ))}
    </section>
  );
}
