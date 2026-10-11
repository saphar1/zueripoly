// Statischer Designentwurf: Brett und Spielerpanels mit festem Beispiel-Spielstand.
// Erreichbar unter /entwurf.html (nur Entwicklung).
import { Board } from "../components/Board";
import { PlayerList } from "../components/PlayerPanel";
import { Sign } from "../components/Sign";
import { DEMO_MESSAGE, createDemoState } from "../demo/demo-state";
import "./DesignDraft.css";

const state = createDemoState();

export function DesignDraft() {
  return (
    <main className="draft">
      <div className="draft__board">
        <Board state={state} message={DEMO_MESSAGE} />
        {/* Auf dem Handy ist die Brettmitte zu klein für die Tafel: dort steht sie unter dem Brett. */}
        <div className="draft__sign">
          <Sign {...DEMO_MESSAGE} />
        </div>
      </div>
      <aside className="draft__side">
        <PlayerList state={state} />
      </aside>
    </main>
  );
}
