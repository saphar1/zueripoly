// Eigene Icons, 24×24, Linie 2 px. Farben kommen aus CSS (Klassen in Icon.css).
import type { JSX } from "react";
import "./Icon.css";

export type IconName =
  | "house"
  | "hotel"
  | "station"
  | "power"
  | "water"
  | "card"
  | "bill"
  | "freeCard"
  | "jail"
  | "arrow"
  | "arrowDiagonal"
  | "waves";

const PATHS: Record<IconName, () => JSX.Element> = {
  house: () => <path className="i-fill" d="M4 11 L12 4 L20 11 V20 H4 Z" />,
  hotel: () => <path className="i-fill" d="M2 11 L12 4 L22 11 V20 H2 Z M10 20 V15 H14 V20" />,
  station: () => (
    <>
      <path className="i-fill" d="M5 3 H19 V18 H5 Z" />
      <path className="i-line" d="M8 6 H16 V10 H8 Z M8 18 L5 22 M16 18 L19 22" />
      <circle className="i-dot" cx="9" cy="14.5" r="1.3" />
      <circle className="i-dot" cx="15" cy="14.5" r="1.3" />
    </>
  ),
  power: () => <path className="i-fill" d="M14 2 L5 14 H11 L10 22 L19 10 H13 Z" />,
  water: () => <path className="i-fill" d="M12 3 C12 3 5 11 5 15 A7 7 0 0 0 19 15 C19 11 12 3 12 3 Z" />,
  card: () => (
    <>
      <path className="i-fill" d="M3 6 H21 V19 H3 Z" />
      <path className="i-line" d="M7 10 H17 M7 14 H14" />
    </>
  ),
  bill: () => (
    <>
      <path className="i-fill" d="M5 2 H19 V22 L16 20 L12 22 L8 20 L5 22 Z" />
      <path className="i-line" d="M8 7 H16 M8 11 H16 M8 15 H13" />
    </>
  ),
  freeCard: () => (
    <>
      <path className="i-fill" d="M5 11 H19 V21 H5 Z" />
      <path className="i-line" d="M8 11 V7 A4 4 0 0 1 16 7" />
    </>
  ),
  jail: () => <path className="i-fill" d="M4 4 H20 V20 H4 Z M9 4 V20 M15 4 V20" />,
  arrow: () => <path className="i-line" d="M21 12 H4 M10 6 L4 12 L10 18" />,
  arrowDiagonal: () => <path className="i-line" d="M19 5 L5 19 M5 10 V19 H14" />,
  waves: () => <path className="i-line" d="M2 9 C5 6 8 6 11 9 S17 12 20 9 L22 8 M2 15 C5 12 8 12 11 15 S17 18 20 15 L22 14" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const Shape = PATHS[name];
  return (
    <svg className={`icon icon--${name}${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <Shape />
    </svg>
  );
}
