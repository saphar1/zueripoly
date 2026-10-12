// Online-Spiel: Der Server ist die Wahrheit. Der Browser schickt nur Aktionen und spielt die
// Ereignisse ab, die der Server schickt. Kommen Züge schneller als die Bewegung, stehen sie in
// einer Warteschlange; bei grossem Rückstand (oder verstecktem Fenster) springt die Anzeige.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Action, GameState } from "@zueripoly/engine";
import type { GameUpdate } from "@zueripoly/server/protocol";
import type { OnlineClient } from "../online/connection";
import { useGamePlayback } from "./use-game-playback";

/** Ab so vielen wartenden Zügen wird nicht mehr abgespielt, sondern gesprungen. */
const MAX_BACKLOG = 3;

export function useOnlineGame(client: OnlineClient, first: GameUpdate) {
  const playback = useGamePlayback(first.state);
  const { play, jumpTo } = playback;
  const truth = useRef<{ seq: number; state: GameState }>({ seq: first.seq, state: first.state });
  const queue = useRef<GameUpdate[]>([]);
  const pumping = useRef(false);
  const pendingRef = useRef(false);

  const [state, setState] = useState(first.state);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pump = useCallback(async () => {
    if (pumping.current) return;
    pumping.current = true;
    try {
      while (queue.current.length > 0) {
        const update = queue.current.shift()!;
        if (update.sync) {
          truth.current = { seq: update.seq, state: update.state };
          setState(update.state);
          jumpTo(update.state);
          continue;
        }
        if (update.seq <= truth.current.seq) continue;
        if (update.seq !== truth.current.seq + 1) {
          // Lücke: Vollstand holen (kommt als «sync» zurück).
          queue.current = [];
          void client.request("game:sync", {});
          break;
        }
        const previous = truth.current.state;
        truth.current = { seq: update.seq, state: update.state };
        setState(update.state);
        const animate = queue.current.length < MAX_BACKLOG && !document.hidden;
        await play(previous, update.events, update.state, animate);
      }
    } finally {
      pumping.current = false;
    }
  }, [client, play, jumpTo]);

  useEffect(() => {
    const off = client.onUpdate((update) => {
      queue.current.push(update);
      void pump();
    });
    // Kam zwischen dem ersten Zeichnen und jetzt schon ein neuerer Stand, diesen als Vollstand übernehmen.
    const latest = client.getSnapshot().latest;
    if (latest && latest.seq !== truth.current.seq) {
      queue.current.push({ ...latest, sync: true, events: [] });
      void pump();
    }
    return off;
  }, [client, pump]);

  /** Eigene Aktion an den Server. Gibt zurück, ob der Server sie angenommen hat. */
  const act = useCallback(
    async (action: Action): Promise<boolean> => {
      if (pendingRef.current) return false;
      pendingRef.current = true;
      setPending(true);
      setError(null);
      const reply = await client.request("game:action", { action });
      pendingRef.current = false;
      setPending(false);
      if (!reply.ok) setError(reply.error);
      return reply.ok;
    },
    [client],
  );

  const online = useSyncExternalStore(client.subscribe, client.getSnapshot);

  return { ...playback, busy: playback.busy || pending, state, error, act, online };
}

export type OnlineGame = ReturnType<typeof useOnlineGame>;
