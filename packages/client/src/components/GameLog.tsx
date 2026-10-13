// Spielprotokoll wie ein Fahrplan: links die Zugnummer, rechts der Satz. Neuestes oben.
// Einklappbar; auf dem Handy zu Beginn zu, dann steht die letzte Meldung in der Kopfzeile.
import { useState } from "react";
import type { LogEntry } from "../game/use-game-playback";
import { Icon } from "./Icon";
import "./GameLog.css";

const SHOWN = 120;
const SMALL_SCREEN = "(max-width: 899px)";

export function GameLog({ entries }: { entries: readonly LogEntry[] }) {
  const [open, setOpen] = useState(() => !window.matchMedia(SMALL_SCREEN).matches);
  const shown = entries.slice(-SHOWN).reverse();
  const latest = shown[0];
  return (
    <details className="log" aria-label="Spielprotokoll" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="log__head">
        <h2>Protokoll</h2>
        <span className="log__toggle">
          {open ? "Zug" : null}
          <Icon name={open ? "minus" : "plus"} />
        </span>
        {!open && latest && <span className="log__latest">{latest.text}</span>}
      </summary>
      <ol className="log__list">
        {shown.map((entry, i) => {
          const newTurn = i === 0 || shown[i - 1]?.turn !== entry.turn;
          return (
            <li key={entry.id} className={`log__row${newTurn ? " log__row--turn" : ""}`}>
              <span className="log__turn num">{newTurn ? entry.turn : ""}</span>
              <span className="log__text">{entry.text}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
