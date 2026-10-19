// Ein normales Feld am Brettrand (keine Ecke). Reine Anzeige; Zeiger und Klick behandelt das Brett.
// Der Inhalt (`tile__face`) ist immer gleich aufgebaut: Balken innen, Name, Fuss aussen.
// Je nach Seite wird er gedreht, damit der Balken zur Brettmitte zeigt.
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { PlayerId, PlayerState, PropertyState, Space } from "@zueripoly/engine";
import { HOTEL_LEVEL, TOKEN_NAMES } from "@zueripoly/engine";
import type { Side } from "../board-layout";
import { formatChf, hyphenate } from "../format";
import { motionMs } from "../motion";
import { Icon, type IconName } from "./Icon";
import { Token } from "./Token";
import "./Tile.css";

interface TileProps {
  space: Space;
  side: Side;
  property: PropertyState | null;
  owner: PlayerState | null;
  visitors: PlayerState[];
  movingPlayer: PlayerId | null;
  markedPlayer: PlayerId | null;
}

const SPACE_ICONS: Partial<Record<Space["kind"], IconName>> = {
  station: "station",
  event: "card",
  community: "card",
  tax: "bill",
};

function iconFor(space: Space): IconName | null {
  if (space.kind === "utility") return space.name === "Stromnetz" ? "power" : "water";
  return SPACE_ICONS[space.kind] ?? null;
}

/** `from`: so viele Gebäude standen vorher; neu dazugekommene setzen sich mit einer kurzen Bewegung. */
function Buildings({ level, from }: { level: number; from: number }) {
  if (level === HOTEL_LEVEL) return <Icon name="hotel" className={`tile__hotel${from < HOTEL_LEVEL ? " tile__built" : ""}`} />;
  return (
    <>
      {Array.from({ length: level }, (_, i) => (
        <Icon key={i} name="house" className={`tile__house${i >= from ? " tile__built" : ""}`} />
      ))}
    </>
  );
}

/**
 * Ab welcher Stufe die Gebäude neu sind. Beim ersten Zeichnen die aktuelle (beim Laden setzt sich nichts).
 * Nach dem Bauen bleibt die alte Stufe so lange stehen, bis die Bewegung fertig ist; sonst würde jedes
 * neue Zeichnen (Zeiger über dem Brett …) die Klasse und damit die Bewegung abbrechen.
 */
function useBuiltFrom(level: number): number {
  const [from, setFrom] = useState(level);
  const last = useRef(level);
  useEffect(() => {
    const before = last.current;
    last.current = level;
    if (level <= before) {
      setFrom(level);
      return;
    }
    setFrom(before);
    const timer = setTimeout(() => setFrom(level), motionMs("build") + 100);
    return () => clearTimeout(timer);
  }, [level]);
  return Math.min(from, level);
}

export function Tile({ space, side, property, owner, visitors, movingPlayer, markedPlayer }: TileProps) {
  const icon = iconFor(space);
  const houses = property?.houses ?? 0;
  const builtFrom = useBuiltFrom(houses);
  const barColor =
    space.kind === "street"
      ? `var(--group-${space.group})`
      : space.kind === "station"
        ? "var(--group-station)"
        : space.kind === "utility"
          ? "var(--group-utility)"
          : null;

  return (
    <div className={`tile tile--${side} tile--${space.kind}${property?.mortgaged ? " tile--mortgaged" : ""}`}>
      <div className="tile__face">
        {barColor && (
          <div className="tile__bar" style={{ "--bar": barColor } as CSSProperties}>
            {houses > 0 && <Buildings level={houses} from={builtFrom} />}
          </div>
        )}
        <div className="tile__body">
          {icon && <Icon name={icon} className={`tile__icon tile__icon--${space.kind}`} />}
          <span className="tile__name">{hyphenate(space.name)}</span>
        </div>
        {/* Fuss: Preis, solange das Feld frei ist; danach nur der Besitzerkreis (belastet: Ring). */}
        <div className="tile__foot">
          {owner ? (
            <span
              className={`tile__owner${property?.mortgaged ? " tile__owner--mortgaged" : ""}`}
              style={{ "--owner": `var(--player-${owner.token})` } as CSSProperties}
            />
          ) : space.kind === "tax" ? (
            <span className="tile__price num">−{formatChf(space.amount)}</span>
          ) : "price" in space ? (
            <span className="tile__price num">{formatChf(space.price)}</span>
          ) : null}
        </div>
      </div>
      {visitors.length > 0 && (
        <div className="tile__tokens">
          {visitors.map((p) => (
            <Token
              key={p.id}
              token={p.token}
              label={`${p.name} (${TOKEN_NAMES[p.token]})`}
              moving={p.id === movingPlayer}
              marked={p.id === markedPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
