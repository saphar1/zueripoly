// Wo liegt welches Feld im 11×11-Raster des Bretts?
// Start (0) ist unten rechts, gezogen wird im Uhrzeigersinn: unten nach links, links hinauf,
// oben nach rechts, rechts hinunter (siehe docs/brett.md).
import type { SpaceIndex } from "@zueripoly/engine";

export type Side = "bottom" | "left" | "top" | "right";

export interface TilePlacement {
  /** Rasterzeile 1–11 (1 = oben). */
  row: number;
  /** Rasterspalte 1–11 (1 = links). */
  column: number;
  /** Seite des Bretts; `null` bei den vier Ecken. */
  side: Side | null;
}

export function placeTile(index: SpaceIndex): TilePlacement {
  if (index === 0) return { row: 11, column: 11, side: null };
  if (index < 10) return { row: 11, column: 11 - index, side: "bottom" };
  if (index === 10) return { row: 11, column: 1, side: null };
  if (index < 20) return { row: 21 - index, column: 1, side: "left" };
  if (index === 20) return { row: 1, column: 1, side: null };
  if (index < 30) return { row: 1, column: index - 19, side: "top" };
  if (index === 30) return { row: 1, column: 11, side: null };
  return { row: index - 29, column: 11, side: "right" };
}
