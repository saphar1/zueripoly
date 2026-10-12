// Ereignis- und Gemeindekarte: erscheint mit der Rückseite und dreht sich um (--motion-card).
// Bei reduzierter Bewegung erscheint direkt die Vorderseite.
import { useEffect, useState } from "react";
import type { CardId, DeckId } from "@zueripoly/engine";
import { DECK_NAMES, getCard } from "@zueripoly/engine";
import "./EventCard.css";

/** Linienmuster der Kartenrückseite (wie ein Liniennetz). */
export function DeckPattern({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 120 56" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M-4 10 H42 L66 34 H124 M-4 20 H38 L62 44 H124 M-4 30 H34 L58 54 H124" />
    </svg>
  );
}

export function EventCard({ cardId, onClose }: { cardId: CardId; onClose: () => void }) {
  const card = getCard(cardId);
  const deck: DeckId = card.deck;
  const [open, setOpen] = useState(false);

  // Erst mit der Rückseite zeigen, dann umdrehen (sonst gäbe es keinen Übergang).
  useEffect(() => {
    setOpen(false);
    const timer = setTimeout(() => setOpen(true), 40);
    return () => clearTimeout(timer);
  }, [cardId]);

  return (
    <div className={`event-card event-card--${deck}${open ? " event-card--open" : ""}`}>
      <div className="event-card__inner">
        <div className="event-card__face event-card__back" aria-hidden="true">
          <DeckPattern className="event-card__pattern" />
          <span className="event-card__back-name">{DECK_NAMES[deck]}</span>
        </div>
        <section className="event-card__face event-card__front" aria-label={DECK_NAMES[deck]} aria-live="polite">
          <p className="event-card__deck">{DECK_NAMES[deck]}</p>
          <p className="event-card__text">{card.text}</p>
          <div className="event-card__foot">
            <span className="event-card__id num">{card.id}</span>
            <button type="button" className="button" onClick={onClose}>
              Zurücklegen
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
