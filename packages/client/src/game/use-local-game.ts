// Lokales Spiel an einem Gerät: hält den Spielstand und führt Aktionen über die Engine aus.
// Das Abspielen der Ereignisse (Würfel, Figur, Karte, Tafel, Protokoll) macht use-game-playback.
//
// Zwei Zustände:
//  - `state` ist die Wahrheit (Ergebnis von applyAction).
//  - `view` ist, was gerade angezeigt wird (siehe use-game-playback).
import { useCallback, useRef, useState } from "react";
import type { Action, GameState, PlayerId } from "@zueripoly/engine";
import { applyAction } from "@zueripoly/engine";
import type { Rng, SeededRng } from "@zueripoly/engine";
import { useGamePlayback } from "./use-game-playback";

export type { LogEntry } from "./use-game-playback";

export interface GameSession {
  initial: GameState;
  rng: SeededRng;
  /** Eigene Zufallsquelle der Computergegner (nie die des Spiels). */
  botRng: Rng;
}

export function useLocalGame(session: GameSession) {
  const rng = useRef(session.rng);
  const truth = useRef(session.initial);
  const playback = useGamePlayback(session.initial);
  const { play, isBusy } = playback;

  const [state, setState] = useState(session.initial);
  const [error, setError] = useState<string | null>(null);

  /**
   * Aktion für einen Spieler ausführen. Ungültige Aktionen ändern nichts und zeigen den Grund.
   * Gibt zurück, ob die Aktion ausgeführt wurde.
   */
  const act = useCallback(
    (playerId: PlayerId, action: Action): boolean => {
      if (isBusy()) return false;
      const previous = truth.current;
      const result = applyAction(previous, playerId, action, rng.current);
      if (!result.ok) {
        setError(result.error.message);
        return false;
      }
      setError(null);
      truth.current = result.state;
      setState(result.state);
      void play(previous, result.events, result.state);
      return true;
    },
    [play, isBusy],
  );

  return { ...playback, state, error, act };
}

export type LocalGame = ReturnType<typeof useLocalGame>;
