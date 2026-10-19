// Hauptmenü wie eine Linientafel: jede Spielart ist eine «Linie».
// Was gerade nicht geht, steht als stillgelegte Linie da (kein Platzhalter-Knopf).
import { useState } from "react";
import { describeSave, loadLocalGame } from "../game/local-save";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import "./MainMenu.css";

interface Line {
  number: number;
  title: string;
  detail: string;
  onSelect?: () => void;
  /** Grund, warum die Linie nicht fährt. */
  off?: string;
}

interface MainMenuProps {
  onLocal: () => void;
  onSolo: () => void;
  onOnline: () => void;
  onResume: () => void;
}

export function MainMenu({ onLocal, onSolo, onOnline, onResume }: MainMenuProps) {
  const [save] = useState(loadLocalGame);
  const lines: Line[] = [
    { number: 1, title: "Lokal spielen", detail: "2 bis 6 Personen an einem Gerät", onSelect: onLocal },
    { number: 2, title: "Solo gegen den Computer", detail: "1 bis 5 Gegner, einfach oder clever", onSelect: onSolo },
    { number: 3, title: "Online mit Freunden", detail: "Raum eröffnen oder mit Raumcode beitreten", onSelect: onOnline },
    save
      ? { number: 4, title: "Spielstand fortsetzen", detail: describeSave(save), onSelect: onResume }
      : { number: 4, title: "Spielstand fortsetzen", detail: "Lokal und Solo werden laufend gespeichert", off: "Kein gespeichertes Spiel" },
  ];

  return (
    <main className="menu">
      <header className="menu__head">
        <Logo className="menu__logo" />
        <p className="menu__claim">Das Brettspiel rund um Zürich.</p>
      </header>
      <nav className="menu__lines" aria-label="Spielart wählen">
        <p className="menu__label">Abfahrten</p>
        {lines.map((line) =>
          line.onSelect ? (
            <button key={line.number} type="button" className="line" onClick={line.onSelect}>
              <span className="line__number num">{line.number}</span>
              <span className="line__text">
                <strong>{line.title}</strong>
                <span>{line.detail}</span>
              </span>
              <Icon name="arrow" className="line__arrow" />
            </button>
          ) : (
            <div key={line.number} className="line line--off" aria-disabled="true">
              <span className="line__number num">{line.number}</span>
              <span className="line__text">
                <strong>{line.title}</strong>
                <span>{line.detail}</span>
              </span>
              <span className="line__status">{line.off}</span>
            </div>
          ),
        )}
      </nav>
    </main>
  );
}
