// Brettmitte: Logo, Zürichsee, Haltestellentafel mit dem letzten Zug, Würfel, Kartenstapel, Vorrat.
import type { GameState } from "@zueripoly/engine";
import { DECK_NAMES } from "@zueripoly/engine";
import { Dice } from "./Dice";
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

/** Kartenstapel: Rückseite mit Linienmuster (wie ein Liniennetz), harter Versatz als Stapelkante. */
function Deck({ deck }: { deck: "event" | "community" }) {
  return (
    <div className={`deck deck--${deck}`}>
      <svg className="deck__lines" viewBox="0 0 120 56" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-4 10 H42 L66 34 H124 M-4 20 H38 L62 44 H124 M-4 30 H34 L58 54 H124" />
      </svg>
      <span className="deck__name">{DECK_NAMES[deck]}</span>
    </div>
  );
}

/** Vorrat der Bank, wie eine kleine Fahrplantabelle. */
function Stock({ houses, hotels }: { houses: number; hotels: number }) {
  return (
    <div className="center__stock">
      <p className="center__stock-title">Vorrat der Bank</p>
      <dl>
        <div>
          <dt>Häuser</dt>
          <dd className="num">{houses}</dd>
        </div>
        <div>
          <dt>Hotels</dt>
          <dd className="num">{hotels}</dd>
        </div>
      </dl>
    </div>
  );
}

/** `message`: was die Tafel zeigt (kommt später aus dem Protokoll). */
export function BoardCenter({ state, message }: { state: GameState; message: SignMessage | null }) {
  const dice = state.turn.dice;
  return (
    <div className="center">
      <Lake />
      <h1 className="logo">
        <span className="logo__badge" aria-hidden="true">
          Z
        </span>
        ZüriPoly
      </h1>
      <div className="center__move">
        {message && <Sign {...message} />}
        <div className="center__aside">
          {dice && <Dice dice={dice} />}
          <Stock houses={state.bank.houses} hotels={state.bank.hotels} />
        </div>
      </div>
      <div className="center__decks">
        <Deck deck="event" />
        <Deck deck="community" />
      </div>
    </div>
  );
}
