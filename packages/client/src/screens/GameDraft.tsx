// Entwurf der Spielansicht mit festem Beispielstand (Mitte einer Partie, Anna am Zug, darf bauen).
// Nur zum Anschauen und für Screenshots: Knöpfe lösen nichts aus. Erreichbar unter /entwurf.html?ansicht=spiel.
import { useCallback, useMemo } from "react";
import { getSpace } from "@zueripoly/engine";
import { DEMO_MESSAGE, createDemoState } from "../demo/demo-state";
import type { LogEntry } from "../game/use-game-playback";
import { GameView, type GameViewModel } from "./GameView";

function demoLog(): LogEntry[] {
  const lines: [number, string][] = [
    [21, `Dario baut ein Hotel auf ${getSpace(34).name}.`],
    [22, "Clara landet im Gefängnis."],
    [22, "Elif würfelt 6 + 1 und fährt weiter."],
    [23, "Anna würfelt 4 + 3 und fährt zur Langstrasse."],
    [23, "Anna zahlt Ben 700 CHF Miete für die Langstrasse."],
  ];
  return lines.map(([turn, text], id) => ({ id, turn, text }));
}

export function GameDraft() {
  const state = useMemo(createDemoState, []);
  const log = useMemo(demoLog, []);
  const dismissCard = useCallback(() => {}, []);
  const game: GameViewModel = {
    state,
    view: state,
    busy: false,
    rollingDice: null,
    movingPlayer: null,
    card: null,
    message: DEMO_MESSAGE,
    log,
    error: null,
    dismissCard,
  };
  return (
    <GameView
      game={game}
      me={null}
      canAct
      onAct={() => {}}
      secondsLeft={null}
      endActions={null}
      leave={{ onLeave: () => {}, warning: "Wirklich aussteigen? Der Spielstand geht verloren." }}
    />
  );
}
