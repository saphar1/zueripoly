// Online-Spiel: Der Server hält den Spielstand. Bedienen kann man nur den eigenen Platz;
// die Züge der anderen erscheinen live (Bewegung, Tafel, Protokoll). Dazu Verbindung und
// Abwesenheit je Spieler, und für den Host die Entscheide bei längerer Abwesenheit.
import { useCallback } from "react";
import type { Action, PlayerId } from "@zueripoly/engine";
import { getWaitingFor } from "@zueripoly/engine";
import type { GameUpdate, RoomSnapshot } from "@zueripoly/server/protocol";
import { AbsentNotice } from "../components/AbsentNotice";
import { ConnectionBanner } from "../components/ConnectionBanner";
import type { PlayerPresence } from "../components/PlayerPanel";
import { useOnlineGame } from "../game/use-online-game";
import type { OnlineClient } from "../online/connection";
import { useServerClock } from "../online/use-server-clock";
import { GameView } from "./GameView";

interface OnlineGameScreenProps {
  client: OnlineClient;
  room: RoomSnapshot;
  /** Erster Spielstand (beim Start oder nach dem Wiederverbinden). */
  first: GameUpdate;
  onLeave: () => void;
  /** Zurück-Geste des Browsers (Zähler). */
  leaveAsk: number;
}

export function OnlineGameScreen({ client, room, first, onLeave, leaveAsk }: OnlineGameScreenProps) {
  const game = useOnlineGame(client, first);
  const { state, online, act } = game;
  const me = room.you;
  const isHost = room.hostId === me;
  const host = room.seats.find((s) => s.id === room.hostId);
  const waiting = getWaitingFor(state);
  const canAct = waiting === me && online.status === "online";
  const secondsLeft = useServerClock(online.clock);

  const presence: Record<PlayerId, PlayerPresence> = {};
  for (const seat of room.seats) {
    presence[seat.id] = { you: seat.id === me, connected: seat.connected, left: seat.left, standIn: seat.standIn };
  }
  const waitingSeat = room.seats.find((s) => s.id === waiting);
  const waitingLabel = waitingSeat?.standIn ? "Computer vertritt" : null;
  const waitingNote =
    waitingSeat && waitingSeat.bot === null && !waitingSeat.connected && !waitingSeat.standIn
      ? `${waitingSeat.name} ist gerade nicht verbunden. Das Spiel wartet.`
      : null;

  const onAct = useCallback(
    (action: Action, as?: PlayerId) => {
      // Online nur für den eigenen Platz (z. B. das eigene Angebot zurückziehen). Prüfen tut der Server.
      if (as !== undefined && as !== me) return;
      void act(action);
    },
    [act, me],
  );

  const decide = async (seatId: PlayerId, decision: "wait" | "bot" | "remove") => {
    await client.request("game:absent", { seatId, decision });
  };

  const toLobby = () => void client.request("game:toLobby", {});

  return (
    <GameView
      game={game}
      me={me}
      canAct={canAct}
      onAct={onAct}
      secondsLeft={secondsLeft}
      waitingLabel={waitingLabel}
      waitingNote={waitingNote}
      presence={presence}
      banner={<ConnectionBanner status={online.status} />}
      notice={<AbsentNotice room={room} roomAt={online.roomAt} disabled={online.status !== "online"} onDecide={(id, d) => void decide(id, d)} />}
      endActions={
        <>
          <div className="tafel__actions">
            {isHost && (
              <button type="button" className="button button--primary" onClick={toLobby}>
                Zurück in die Lobby
              </button>
            )}
            <button type="button" className="button" onClick={onLeave}>
              Raum verlassen
            </button>
          </div>
          {!isHost && <p className="tafel__hint">{host?.name ?? "Der Host"} entscheidet, ob es eine nächste Runde gibt.</p>}
        </>
      }
      leave={
        state.winner
          ? null
          : {
              onLeave,
              askToken: leaveAsk,
              warning: `Wirklich aussteigen? Du kommst nicht mehr auf deinen Platz zurück. ${isHost ? "Ein anderer Spieler wird Host und " : ""}${isHost ? "entscheidet" : `${host?.name ?? "Der Host"} entscheidet`}, ob ein Computer für dich weiterspielt.`,
            }
      }
    />
  );
}
