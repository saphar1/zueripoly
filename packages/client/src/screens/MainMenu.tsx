// Hauptmenü wie eine Linientafel: jede Spielart ist eine «Linie».
// Was noch nicht gebaut ist, steht als «noch nicht in Betrieb» da (kein Platzhalter-Knopf).
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import "./MainMenu.css";

interface Line {
  number: number;
  title: string;
  detail: string;
  onSelect?: () => void;
  since?: string;
}

export function MainMenu({ onLocal, onSolo }: { onLocal: () => void; onSolo: () => void }) {
  const lines: Line[] = [
    { number: 1, title: "Lokal spielen", detail: "2 bis 6 Personen an einem Gerät", onSelect: onLocal },
    { number: 2, title: "Solo gegen den Computer", detail: "1 bis 5 Gegner, einfach oder clever", onSelect: onSolo },
    { number: 3, title: "Online mit Freunden", detail: "Mit Raumcode im Heimnetz", since: "Phase 5" },
    { number: 4, title: "Spielstand fortsetzen", detail: "Gespeicherte Partie laden", since: "Phase 6" },
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
              <span className="line__status">Noch nicht in Betrieb · {line.since}</span>
            </div>
          ),
        )}
      </nav>
    </main>
  );
}
