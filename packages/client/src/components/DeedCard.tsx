// Besitzkarte (Titelkarte) eines Feldes: Farbbalken, Mietentabelle, Hauspreis, Hypothek, Besitzer.
// Für Felder ohne Besitz (Ecken, Karten, Steuern) zeigt sie die Regel des Feldes.
import type { CSSProperties, ReactNode } from "react";
import type { GameState, PropertySpace, Space, SpaceIndex } from "@zueripoly/engine";
import {
  GROUP_NAMES,
  HOTEL_LEVEL,
  STATION_INDICES,
  STATION_RENTS,
  TOKEN_NAMES,
  UTILITY_INDICES,
  UTILITY_MULTIPLIERS,
  getSpace,
  groupHasMortgage,
  isPropertySpace,
  ownsWholeGroup,
  unmortgageCost,
} from "@zueripoly/engine";
import { formatChf, formatNumber } from "../format";
import { ownerOf, spaceRule } from "../space-text";
import { Token } from "./Token";
import "./DeedCard.css";

interface RentRow {
  label: string;
  value: string;
}

const BAR_COLORS: Partial<Record<Space["kind"], string>> = {
  station: "var(--group-station)",
  utility: "var(--group-utility)",
  event: "var(--color-tram)",
  community: "var(--color-ink)",
  tax: "var(--color-paper-dark)",
  start: "var(--color-tram)",
  jail: "var(--color-ink)",
  vacation: "var(--color-lake)",
  goToJail: "var(--color-signal)",
};

const KIND_LABELS: Record<Space["kind"], string> = {
  street: "Besitzkarte",
  station: "Bahnhof",
  utility: "Versorger",
  tax: "Abgabe",
  event: "Kartenfeld",
  community: "Kartenfeld",
  start: "Ecke",
  jail: "Ecke",
  vacation: "Ecke",
  goToJail: "Ecke",
};

function rentRows(space: PropertySpace): RentRow[] {
  switch (space.kind) {
    case "street": {
      const [base, ...withHouses] = space.rents;
      return [
        { label: "Miete", value: formatNumber(base) },
        { label: "Ganze Gruppe", value: formatNumber(base * 2) },
        ...withHouses.map((rent, i) => ({
          label: i === HOTEL_LEVEL - 1 ? "Hotel" : `${i + 1} ${i === 0 ? "Haus" : "Häuser"}`,
          value: formatNumber(rent),
        })),
      ];
    }
    case "station":
      return STATION_RENTS.map((rent, i) => ({
        label: `${i + 1} ${i === 0 ? "Bahnhof" : "Bahnhöfe"}`,
        value: formatNumber(rent),
      }));
    case "utility":
      return UTILITY_MULTIPLIERS.map((factor, i) => ({
        label: i === 0 ? "1 Versorger" : "Beide",
        value: `${factor} × Augen`,
      }));
  }
}

/** Welche Zeile der Mietentabelle gerade gilt (oder null). */
function currentRow(state: GameState, space: PropertySpace): number | null {
  const property = state.properties[space.index];
  if (!property?.owner || property.mortgaged) return null;
  const owner = property.owner;
  switch (space.kind) {
    case "street":
      if (property.houses > 0) return property.houses + 1;
      return ownsWholeGroup(state, owner, space.group) && !groupHasMortgage(state, space.group) ? 1 : 0;
    case "station":
      return STATION_INDICES.filter((i) => state.properties[i]?.owner === owner).length - 1;
    case "utility":
      return UTILITY_INDICES.filter((i) => state.properties[i]?.owner === owner).length - 1;
  }
}

function buildingsLabel(houses: number): string | null {
  if (houses === HOTEL_LEVEL) return "Hotel";
  if (houses > 0) return `${houses} ${houses === 1 ? "Haus" : "Häuser"}`;
  return null;
}

/** `children`: z. B. Knöpfe zum Bauen oder Belasten, erscheinen unten auf der Karte. */
export function DeedCard({ state, index, children }: { state: GameState; index: SpaceIndex; children?: ReactNode }) {
  const space = getSpace(index);
  const property = state.properties[index];
  const owner = ownerOf(state, index);
  const here = state.players.filter((p) => !p.bankrupt && p.position === index);
  const bar = space.kind === "street" ? `var(--group-${space.group})` : (BAR_COLORS[space.kind] ?? "var(--color-ink)");
  const kind = space.kind === "street" ? `${KIND_LABELS.street} · ${GROUP_NAMES[space.group]}` : KIND_LABELS[space.kind];
  const current = isPropertySpace(space) ? currentRow(state, space) : null;

  return (
    <article className="deed-card" aria-label={`Feldinfo: ${space.name}`}>
      <div className="deed-card__bar" style={{ "--bar": bar } as CSSProperties} />
      <header className="deed-card__head">
        <p className="deed-card__kind">{kind}</p>
        <div className="deed-card__title">
          <h3 className="deed-card__name">{space.name}</h3>
          {isPropertySpace(space) && (
            <span className="deed-card__price num">
              <span className="visually-hidden">Kaufpreis </span>
              {formatChf(space.price)}
            </span>
          )}
        </div>
      </header>

      {isPropertySpace(space) ? (
        <>
          <table className="deed-card__rents">
            <tbody>
              {rentRows(space).map((row, i) => (
                <tr key={row.label} className={i === current ? "is-current" : undefined}>
                  <th scope="row">{row.label}</th>
                  <td className="num">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="deed-card__facts">
            {space.kind === "street" && (
              <div>
                <dt>Haus oder Hotel</dt>
                <dd className="num">je {formatChf(space.housePrice)}</dd>
              </div>
            )}
            <div>
              <dt>Hypothek / Auslösen</dt>
              <dd className="num">
                {formatNumber(space.mortgage)} / {formatChf(unmortgageCost(space))}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="deed-card__rule">{spaceRule(state, space)}</p>
      )}

      {isPropertySpace(space) && (
        <p className="deed-card__owner">
          {owner ? (
            <>
              <span className="deed-card__disc" style={{ "--owner": `var(--player-${owner.token})` } as CSSProperties} />
              <span>
                Gehört <strong>{owner.name}</strong>
                {property && buildingsLabel(property.houses) && ` · ${buildingsLabel(property.houses)}`}
                {property?.mortgaged && " · mit Hypothek belastet"}
              </span>
            </>
          ) : (
            <span>Noch frei</span>
          )}
        </p>
      )}

      {here.length > 0 && (
        <div className="deed-card__here">
          <span>Hier:</span>
          {here.map((p) => (
            <span key={p.id} className="deed-card__visitor">
              <Token token={p.token} label={`${p.name} (${TOKEN_NAMES[p.token]})`} />
              {p.name}
              {p.inJail && " (sitzt)"}
            </span>
          ))}
        </div>
      )}
      {children}
    </article>
  );
}
