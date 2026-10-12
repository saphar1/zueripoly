// Designentwurf: Brett und Spielerpanels mit Beispiel-Spielstand, dazu Hover-Zustände
// und eine kleine Bewegungs-Demo (Würfel, Figur, Geld, Karte). Erreichbar unter /entwurf.html.
import { useEffect, useState } from "react";
import type { PlayerId, SpaceIndex } from "@zueripoly/engine";
import { Board } from "../components/Board";
import { DeedCard } from "../components/DeedCard";
import { EventCard } from "../components/EventCard";
import { PlayerList } from "../components/PlayerPanel";
import { Sign } from "../components/Sign";
import { useDemo } from "../demo/use-demo";
import { ownerOf } from "../space-text";
import "./DesignDraft.css";

export function DesignDraft() {
  const demo = useDemo();
  const { closeCard } = demo;
  const [hovered, setHovered] = useState<SpaceIndex | null>(null);
  const [selected, setSelected] = useState<SpaceIndex | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<PlayerId | null>(null);

  const focusSpace = hovered ?? selected;
  const linkedPlayer = hoveredPlayer ?? (focusSpace !== null ? (ownerOf(demo.game, focusSpace)?.id ?? null) : null);

  // Esc hebt Auswahl und gezogene Karte auf.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelected(null);
      closeCard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeCard]);

  const overlay = demo.drawnCard ? (
    <EventCard cardId={demo.drawnCard} onClose={closeCard} />
  ) : focusSpace !== null ? (
    <DeedCard state={demo.game} index={focusSpace} />
  ) : null;

  return (
    <main className="draft">
      <div className="draft__board">
        <Board
          state={demo.game}
          message={demo.message}
          focusSpace={focusSpace}
          selectedSpace={selected}
          highlightPlayer={hoveredPlayer}
          movingPlayer={demo.movingPlayer}
          rollingDice={demo.rollingDice}
          overlay={overlay}
          onSpaceHover={setHovered}
          onSpaceSelect={(index) => setSelected((current) => (current === index ? null : index))}
          onRoll={demo.roll}
          onDeckSelect={demo.draw}
        />
        {/* Auf dem Handy ist die Brettmitte zu klein: Tafel und Besitzkarte stehen dort unter dem Brett. */}
        <div className="draft__below">
          <Sign {...demo.message} />
          {selected !== null && <DeedCard state={demo.game} index={selected} />}
        </div>
      </div>
      <aside className="draft__side">
        <PlayerList
          state={demo.game}
          linkedPlayer={linkedPlayer}
          focusSpace={focusSpace}
          onPlayerHover={setHoveredPlayer}
          onSpaceHover={setHovered}
        />
        <p className="draft__hint">
          <strong>Entwurf zum Ausprobieren:</strong> Felder und Spieler mit der Maus zeigen oder antippen, Würfel
          und Kartenstapel anklicken. Ein Klick auf ein Feld hält die Besitzkarte fest, Esc hebt die Auswahl auf.
          Gespielt wird noch nicht: Miete, Kauf und Karten wirken erst in der spielbaren Version.
        </p>
      </aside>
    </main>
  );
}
