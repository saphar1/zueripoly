// Die sechs Spielfiguren als eigene SVG (64×64, 3-px-Linie in Tinte, Fläche in Spielerfarbe).
// Farbige Flächen nutzen `currentColor`; die Farbe kommt aus der CSS-Variable der Figur.
import type { JSX } from "react";
import type { TokenId } from "@zueripoly/engine";
import { TOKEN_NAMES } from "@zueripoly/engine";
import "./Token.css";

function TramFigure() {
  return (
    <>
      <path className="ln" d="M22 23 L32 13 L42 23 M26 9 H38 M32 13 V9" />
      <path className="fc ln" d="M7 23 H50 L58 33 V46 H7 Z" />
      <path className="fp ln" d="M12 28 H20 V36 H12 Z M24 28 H32 V36 H24 Z M36 28 H44 V36 H36 Z M48 28 L53 34 V36 H48 Z" />
      <circle className="fi ln" cx="18" cy="49" r="4" />
      <circle className="fi ln" cx="46" cy="49" r="4" />
      <path className="ln" d="M3 56 H61" />
    </>
  );
}

function SwanFigure() {
  return (
    <>
      <path className="ln" d="M6 55 C10 52 14 52 18 55 S26 58 30 55 S38 52 42 55 S50 58 54 55" />
      <path className="fc ln" d="M6 28 L20 37 H44 C51 37 53 44 47 48 H19 C11 48 6 40 6 28 Z" />
      <path className="ln" d="M20 41 C26 37 34 37 40 41" />
      <path className="tube-out" d="M44 40 C50 31 40 24 42 17 C43 12 48 10 51 13" />
      <path className="tube-in" d="M44 40 C50 31 40 24 42 17 C43 12 48 10 51 13" />
      <path className="fi ln" d="M52 13 L59 16 L52 18 Z" />
    </>
  );
}

function BoeoeggFigure() {
  return (
    <>
      <path className="ln" d="M52 58 L56 24 M51 22 L56 24 L60 21 M52 27 L56 24 L60 27" />
      <circle className="fc ln" cx="30" cy="45" r="12" />
      <circle className="fc ln" cx="30" cy="26" r="8" />
      <path className="fi ln" d="M23 8 H37 V18 H23 Z" />
      <path className="ln" d="M19 18 H41" />
      <path className="ln" d="M16 6 L19 9 M44 6 L41 9 M30 1 V3" />
      <circle className="fi" cx="27" cy="25" r="1.8" />
      <circle className="fi" cx="33" cy="25" r="1.8" />
      <circle className="fi" cx="30" cy="41" r="2" />
      <circle className="fi" cx="30" cy="49" r="2" />
    </>
  );
}

function FondueFigure() {
  return (
    <>
      <path className="ln" d="M24 29 L38 8" />
      <path className="fp ln" d="M34 3 L42 5 L40 13 L32 11 Z" />
      <path className="fc ln" d="M8 29 H48 L43 49 H13 Z" />
      <path className="fc ln" d="M47 32 L61 27 L62 32 L46 37 Z" />
      <path className="ln" d="M13 35 C16 39 18 35 21 38" />
      <path className="ln" d="M17 49 L15 57 M39 49 L41 57 M12 57 H44" />
    </>
  );
}

function BikeFigure() {
  return (
    <>
      <circle className="fc ln" cx="15" cy="43" r="11" />
      <circle className="fp ln" cx="15" cy="43" r="3.5" />
      <circle className="fc ln" cx="49" cy="43" r="11" />
      <circle className="fp ln" cx="49" cy="43" r="3.5" />
      <path className="ln" d="M15 43 L29 43 L24 24 Z M29 43 L44 24 L24 24 M44 24 L49 43 M44 24 L42 16 L49 14 M19 21 H29" />
    </>
  );
}

function CoffeeFigure() {
  return (
    <>
      <path className="ln" d="M24 16 C20 12 28 9 24 4 M35 16 C31 12 39 9 35 4" />
      <path className="tube-out" d="M44 27 H49 C53 27 55 30 55 34 C55 38 53 41 49 41 H44" />
      <path className="tube-in" d="M44 27 H49 C53 27 55 30 55 34 C55 38 53 41 49 41 H44" />
      <path className="fc ln" d="M12 21 H45 V47 C45 53 41 57 35 57 H22 C16 57 12 53 12 47 Z" />
      <path className="ln" d="M12 27 H45" />
    </>
  );
}

const FIGURES: Record<TokenId, () => JSX.Element> = {
  tram: TramFigure,
  swan: SwanFigure,
  boeoegg: BoeoeggFigure,
  fondue: FondueFigure,
  bike: BikeFigure,
  coffee: CoffeeFigure,
};

/** Nur die Figur, ohne Scheibe. */
export function TokenFigure({ token }: { token: TokenId }) {
  const Figure = FIGURES[token];
  return (
    <svg className={`figure figure--${token}`} viewBox="0 0 64 64" aria-hidden="true">
      <Figure />
    </svg>
  );
}

/** Figur auf runder Papierscheibe mit Tintenrand, wie ein Spielstein. */
export function Token({ token, label }: { token: TokenId; label?: string }) {
  return (
    <span className={`token token--${token}`} role="img" aria-label={label ?? TOKEN_NAMES[token]}>
      <TokenFigure token={token} />
    </span>
  );
}
