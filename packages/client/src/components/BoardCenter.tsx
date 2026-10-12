// Brettmitte: Haltestellentafel mit dem letzten Zug und Würfel im Mittelpunkt; Logo, Zürichsee
// und Kartenstapel treten zurück. Der Vorrat der Bank erscheint nur, wenn er knapp wird.
import type { ReactNode } from "react";
import type { DeckId, Dice as DicePair, GameState } from "@zueripoly/engine";
import { DECK_NAMES } from "@zueripoly/engine";
import { Dice } from "./Dice";
import { DeckPattern } from "./EventCard";
import { Logo } from "./Logo";
import { Sign, type SignMessage } from "./Sign";
import "./BoardCenter.css";

/**
 * Zürichsee wie auf einem Netzplan: nur senkrechte, waagrechte und 45°-Kanten.
 * Schmal beim Bellevue, breit zwischen Horgen und Meilen (mit Halbinsel Au), dann der Obersee
 * nach Osten aus dem Bild. Die Mitte ist quadratisch, darum rechnet die Zeichnung in 600 × 600.
 */
function Lake() {
  return (
    <svg className="center__lake" viewBox="0 0 600 600" aria-hidden="true">
      <path
        className="center__lake-water"
        d="M380 296 H410 V326 L544 460 H660 V500 H476 L436 460 L446 450 L436 440 L426 450 L380 404 Z"
      />
      <text className="center__lake-name" x="466" y="424" transform="rotate(45 466 424)">
        Zürichsee
      </text>
    </svg>
  );
}

/** Kartenstapel: Rückseite mit Linienmuster, harter Versatz als Stapelkante. Mit `onSelect` ein Knopf. */
function Deck({ deck, onSelect }: { deck: DeckId; onSelect?: (deck: DeckId) => void }) {
  const content = (
    <>
      <DeckPattern className="deck__lines" />
      <span className="deck__name">{DECK_NAMES[deck]}</span>
    </>
  );
  if (!onSelect) return <div className={`deck deck--${deck}`}>{content}</div>;
  return (
    <button
      type="button"
      className={`deck deck--${deck} deck--button`}
      onClick={() => onSelect(deck)}
      aria-label={`${DECK_NAMES[deck]} ziehen`}
    >
      {content}
    </button>
  );
}

/** Ab hier wird der Vorrat der Bank knapp und als Hinweis gezeigt (sonst spielt er keine Rolle). */
const SCARCE_HOUSES = 8;
const SCARCE_HOTELS = 2;

function scarce(count: number, one: string, many: string, limit: number): string | null {
  if (count > limit) return null;
  return count === 0 ? `keine ${many} mehr` : `nur noch ${count} ${count === 1 ? one : many}`;
}

/** Vorrat der Bank: nur ein Hinweis, wenn Häuser oder Hotels knapp werden. */
function Stock({ houses, hotels }: { houses: number; hotels: number }) {
  const parts = [scarce(houses, "Haus", "Häuser", SCARCE_HOUSES), scarce(hotels, "Hotel", "Hotels", SCARCE_HOTELS)].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="center__stock">Bank: {parts.join(" · ")}</p>;
}

interface BoardCenterProps {
  state: GameState;
  /** Was die Tafel zeigt (kommt später aus dem Protokoll). */
  message: SignMessage | null;
  /** Augen während des Rollens; sonst der letzte Wurf aus dem Zustand. */
  rollingDice?: DicePair | null;
  /** Besitzkarte oder gezogene Karte, liegt über dem See. */
  overlay?: ReactNode;
  onRoll?: () => void;
  onDeckSelect?: (deck: DeckId) => void;
}

export function BoardCenter({ state, message, rollingDice = null, overlay, onRoll, onDeckSelect }: BoardCenterProps) {
  // Vor dem ersten Wurf: leere Würfel, damit sie als Knopf da sind.
  const dice = rollingDice ?? state.turn.dice ?? (onRoll ? ([0, 0] as DicePair) : null);
  return (
    <div className="center">
      <Lake />
      <Logo />
      <div className="center__move">
        {message && <Sign {...message} />}
        <div className="center__aside">
          {dice && <Dice dice={dice} rolling={rollingDice !== null} onRoll={onRoll} />}
          <Stock houses={state.bank.houses} hotels={state.bank.hotels} />
        </div>
      </div>
      <div className="center__decks">
        <Deck deck="event" onSelect={onDeckSelect} />
        <Deck deck="community" onSelect={onDeckSelect} />
      </div>
      {overlay && <div className="center__overlay">{overlay}</div>}
    </div>
  );
}
