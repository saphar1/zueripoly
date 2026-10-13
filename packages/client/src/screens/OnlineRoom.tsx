// Online-Raum: zeigt je nach Stand des Servers die Lobby, das Spiel oder eine Meldung
// (Verbinden …, Raum geschlossen). Beim Neuladen meldet er sich mit dem gespeicherten Platz wieder an.
import { useEffect, useSyncExternalStore } from "react";
import type { SeatGrant } from "@zueripoly/server/protocol";
import { ConnectionBanner } from "../components/ConnectionBanner";
import type { OnlineClient } from "../online/connection";
import { useSignal } from "../screen-history";
import { OnlineGameScreen } from "./OnlineGameScreen";
import { OnlineLobby } from "./OnlineLobby";
import "./Lobby.css";

interface OnlineRoomProps {
  client: OnlineClient;
  /** Gespeicherter Platz dieses Fensters (nach dem Neuladen), sonst null. */
  resume: SeatGrant | null;
  /** Zurück zum Online-Start. */
  onExit: () => void;
  /** Zurück-Geste des Browsers (Zähler): im Spiel Rückfrage, in der Lobby Raum verlassen. */
  leaveAsk: number;
}

function Message({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return (
    <main className="lobby">
      <div className="lobby__form">
        <header className="lobby__head">
          <p>Online mit Freunden</p>
          <h1>{title}</h1>
        </header>
        <p className="lobby__help" role="status">
          {text}
        </p>
        <div className="lobby__actions">
          <button type="button" className="button" onClick={onAction}>
            {action}
          </button>
        </div>
      </div>
    </main>
  );
}

export function OnlineRoom({ client, resume, onExit, leaveAsk }: OnlineRoomProps) {
  const online = useSyncExternalStore(client.subscribe, client.getSnapshot);

  useEffect(() => {
    if (resume && !client.getSnapshot().grant) void client.resume(resume);
  }, [client, resume]);

  const leave = () => {
    void client.leave().then(onExit);
  };

  // Im laufenden Spiel fragt OnlineGameScreen nach. In der Lobby kann man jederzeit wieder beitreten.
  useSignal(leaveAsk, () => {
    if (online.closed || !online.room) onExit();
    else if (online.room.phase !== "game" || online.latest?.state.winner) leave();
  });

  if (online.closed) {
    return <Message title="Nicht mehr im Raum" text={online.closed} action="Zurück zum Online-Menü" onAction={onExit} />;
  }
  if (!online.room) {
    const code = online.grant?.code ?? resume?.code;
    return (
      <>
        <ConnectionBanner status={online.status} />
        <Message title={code ? `Raum ${code}` : "Raum"} text="Verbinde mit dem Raum …" action="Abbrechen" onAction={onExit} />
      </>
    );
  }
  if (online.room.phase === "game") {
    if (!online.latest) return <Message title={`Raum ${online.room.code}`} text="Spielstand wird geladen …" action="Abbrechen" onAction={onExit} />;
    return <OnlineGameScreen client={client} room={online.room} first={online.latest} onLeave={leave} leaveAsk={leaveAsk} />;
  }
  return (
    <>
      <ConnectionBanner status={online.status} />
      <OnlineLobby client={client} room={online.room} onLeave={leave} />
    </>
  );
}
