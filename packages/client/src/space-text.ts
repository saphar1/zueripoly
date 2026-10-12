// Texte zu Feldern: Beschreibung für Screenreader und Hinweise für Tafel und Besitzkarte.
import type { GameState, PlayerState, PropertyState, Space, SpaceIndex } from "@zueripoly/engine";
import {
  GROUP_NAMES,
  HOTEL_LEVEL,
  JAIL_FINE,
  START_SALARY,
  calculateRent,
  getSpace,
  isPropertySpace,
} from "@zueripoly/engine";
import { formatChf } from "./format";

export function ownerOf(state: GameState, index: SpaceIndex): PlayerState | null {
  const ownerId = state.properties[index]?.owner;
  return ownerId ? (state.players.find((p) => p.id === ownerId) ?? null) : null;
}

function buildingsText(houses: number): string | null {
  if (houses === HOTEL_LEVEL) return "Hotel";
  if (houses > 0) return `${houses} ${houses === 1 ? "Haus" : "Häuser"}`;
  return null;
}

/** Kurzbeschreibung eines Feldes (aria-label). */
export function describeSpace(state: GameState, index: SpaceIndex): string {
  const space = getSpace(index);
  const property: PropertyState | undefined = state.properties[index];
  const owner = ownerOf(state, index);
  const parts: string[] = [space.name];
  if (space.kind === "street") parts.push(GROUP_NAMES[space.group]);
  if (space.kind === "tax") parts.push(`zahle ${formatChf(space.amount)}`);
  if (space.kind === "start") parts.push(`${formatChf(START_SALARY)} beim Vorbeiziehen`);
  if (space.kind === "vacation" && state.options.jackpot) parts.push(`Topf ${formatChf(state.jackpot)}`);
  if (isPropertySpace(space) && !owner) parts.push(formatChf(space.price));
  if (owner) parts.push(`gehört ${owner.name}`);
  if (property?.mortgaged) parts.push("mit Hypothek belastet");
  const buildings = property ? buildingsText(property.houses) : null;
  if (buildings) parts.push(buildings);
  return parts.join(", ");
}

/** Was auf einem Feld gilt, in einem Satz (für Felder ohne Besitzkarte). */
export function spaceRule(state: GameState, space: Space): string {
  switch (space.kind) {
    case "start":
      return `Wer hier landet oder vorbeizieht, bekommt ${formatChf(START_SALARY)}.`;
    case "jail":
      return `Zu Besuch passiert nichts. Wer drin sitzt, kommt mit einem Pasch, ${formatChf(JAIL_FINE)} oder einer Freikarte raus.`;
    case "vacation":
      return state.options.jackpot
        ? `Wer hier landet, kassiert den Topf: jetzt ${formatChf(state.jackpot)}.`
        : "Ausruhen am See. Hier passiert nichts.";
    case "goToJail":
      return "Direkt ins Gefängnis, ohne über Start zu ziehen.";
    case "event":
      return "Ziehe die oberste Ereigniskarte.";
    case "community":
      return "Ziehe die oberste Gemeindekarte.";
    case "tax":
      return state.options.jackpot
        ? `Zahle ${formatChf(space.amount)}. Das Geld kommt in den Topf am Zürichsee.`
        : `Zahle ${formatChf(space.amount)} an die Bank.`;
    default:
      return "";
  }
}

/** Hinweis auf der Tafel, wenn eine Figur auf einem Feld ankommt. */
export function landingNote(state: GameState, index: SpaceIndex, diceSum: number, moverId: string): string {
  const space = getSpace(index);
  if (!isPropertySpace(space)) return spaceRule(state, space);
  const owner = ownerOf(state, index);
  if (!owner) return `Noch frei, zu haben für ${formatChf(space.price)}.`;
  if (owner.id === moverId) return "Eigenes Feld. Hier wohnt man gratis.";
  if (state.properties[index]?.mortgaged) return `Gehört ${owner.name}, ist aber belastet: keine Miete.`;
  return `Gehört ${owner.name}. Miete: ${formatChf(calculateRent(state, index, diceSum))}.`;
}
