// Störungsmeldung im Online-Spiel: Jemand ist länger nicht verbunden oder hat das Spiel verlassen.
// Der Host entscheidet: warten, ein Computer spielt weiter, oder aus dem Spiel nehmen.
// Alle anderen sehen, worauf gewartet wird. Stil wie eine Störungsanzeige an der Haltestelle.
import { useEffect, useState } from "react";
import type { PlayerId } from "@zueripoly/engine";
import type { AbsentDecision, RoomSnapshot } from "@zueripoly/server/protocol";
import "./AbsentNotice.css";

interface AbsentNoticeProps {
  room: RoomSnapshot;
  /** Zeitpunkt, zu dem `room` ankam (performance.now), für «seit …». */
  roomAt: number;
  disabled: boolean;
  onDecide: (seatId: PlayerId, decision: AbsentDecision) => void;
}

function duration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Sekundentakt, damit «seit 1:05» weiterläuft. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function AbsentNotice({ room, roomAt, disabled, onDecide }: AbsentNoticeProps) {
  const seats = room.seats.filter((s) => s.needsDecision);
  const now = useNow(seats.length > 0);
  if (seats.length === 0) return null;
  const isHost = room.hostId === room.you;
  const host = room.seats.find((s) => s.id === room.hostId);

  return (
    <section className="absent" aria-live="polite" aria-label="Störung">
      <p className="absent__head">Störung</p>
      {seats.map((seat) => {
        const away = seat.awayMs === null ? null : duration(seat.awayMs + Math.max(0, now - roomAt));
        return (
          <div key={seat.id} className="absent__item">
            <p className="absent__text">
              {seat.left ? (
                <>
                  <strong>{seat.name}</strong> hat das Spiel verlassen.
                </>
              ) : (
                <>
                  <strong>{seat.name}</strong> ist seit <span className="num">{away}</span> nicht verbunden.
                </>
              )}{" "}
              {isHost ? "Wie geht es weiter?" : `${host?.name ?? "Der Host"} entscheidet, wie es weitergeht.`}
            </p>
            {isHost && (
              <div className="absent__actions">
                {!seat.left && (
                  <button type="button" className="button" disabled={disabled} onClick={() => onDecide(seat.id, "wait")}>
                    Warten
                  </button>
                )}
                <button type="button" className="button button--primary" disabled={disabled} onClick={() => onDecide(seat.id, "bot")}>
                  Computer spielt weiter
                </button>
                <button type="button" className="button button--danger" disabled={disabled} onClick={() => onDecide(seat.id, "remove")}>
                  Aus dem Spiel nehmen
                </button>
              </div>
            )}
            {isHost && (
              <p className="absent__help">
                {seat.left
                  ? "Aus dem Spiel nehmen: Der Besitz geht an die Bank zurück, die Felder sind wieder frei."
                  : "Kommt die Person zurück, spielt sie wieder selbst. Aus dem Spiel nehmen: Der Besitz geht an die Bank zurück, die Felder sind wieder frei."}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
