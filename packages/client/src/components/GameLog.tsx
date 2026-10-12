// Spielprotokoll wie ein Fahrplan: links die Zugnummer, rechts der Satz. Neuestes oben.
import type { LogEntry } from "../game/use-game-playback";
import "./GameLog.css";

const SHOWN = 120;

export function GameLog({ entries }: { entries: readonly LogEntry[] }) {
  const shown = entries.slice(-SHOWN).reverse();
  return (
    <section className="log" aria-label="Spielprotokoll">
      <header className="log__head">
        <h2>Protokoll</h2>
        <span>Zug</span>
      </header>
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
    </section>
  );
}
