// Ein normales Feld am Brettrand (keine Ecke).
// Der Inhalt (`tile__face`) ist immer gleich aufgebaut: Balken innen, Name, Fuss aussen.
// Je nach Seite wird er gedreht, damit der Balken zur Brettmitte zeigt.
import type { CSSProperties } from "react";
import type { PlayerState, PropertyState, Space } from "@zueripoly/engine";
import { GROUP_NAMES, HOTEL_LEVEL, TOKEN_NAMES } from "@zueripoly/engine";
import type { Side } from "../board-layout";
import { formatChf, hyphenate } from "../format";
import { Icon, type IconName } from "./Icon";
import { Token } from "./Token";
import "./Tile.css";

interface TileProps {
  space: Space;
  side: Side;
  property: PropertyState | null;
  owner: PlayerState | null;
  visitors: PlayerState[];
  style: CSSProperties;
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

function Buildings({ level }: { level: number }) {
  if (level === HOTEL_LEVEL) return <Icon name="hotel" className="tile__hotel" />;
  return (
    <>
      {Array.from({ length: level }, (_, i) => (
        <Icon key={i} name="house" className="tile__house" />
      ))}
    </>
  );
}

function describe(space: Space, property: PropertyState | null, owner: PlayerState | null): string {
  const parts: string[] = [space.name];
  if (space.kind === "street") parts.push(GROUP_NAMES[space.group]);
  if (space.kind === "tax") parts.push(`zahle ${formatChf(space.amount)}`);
  if ("price" in space && !owner) parts.push(formatChf(space.price));
  if (owner) parts.push(`gehört ${owner.name}`);
  if (property?.mortgaged) parts.push("mit Hypothek belastet");
  if (property && property.houses === HOTEL_LEVEL) parts.push("Hotel");
  else if (property && property.houses > 0) parts.push(`${property.houses} ${property.houses === 1 ? "Haus" : "Häuser"}`);
  return parts.join(", ");
}

export function Tile({ space, side, property, owner, visitors, style }: TileProps) {
  const icon = iconFor(space);
  const barColor =
    space.kind === "street"
      ? `var(--group-${space.group})`
      : space.kind === "station"
        ? "var(--group-station)"
        : space.kind === "utility"
          ? "var(--group-utility)"
          : null;

  return (
    <div
      className={`tile tile--${side} tile--${space.kind}${property?.mortgaged ? " tile--mortgaged" : ""}`}
      style={style}
      role="img"
      aria-label={describe(space, property, owner)}
    >
      <div className="tile__face">
        {barColor && (
          <div className="tile__bar" style={{ "--bar": barColor } as CSSProperties}>
            {property && property.houses > 0 && <Buildings level={property.houses} />}
          </div>
        )}
        <div className="tile__body">
          {icon && <Icon name={icon} className={`tile__icon tile__icon--${space.kind}`} />}
          <span className="tile__name">{hyphenate(space.name)}</span>
        </div>
        <div className="tile__foot">
          {owner && <span className="tile__owner" style={{ "--owner": `var(--player-${owner.token})` } as CSSProperties} />}
          {property?.mortgaged ? (
            <span className="tile__price">Hypothek</span>
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
            <Token key={p.id} token={p.token} label={`${p.name} (${TOKEN_NAMES[p.token]})`} />
          ))}
        </div>
      )}
    </div>
  );
}
