// Online-Lobby: grosser Raumcode zum Weitergeben, Plätze mit Name, Figur, bereit und verbunden.
// Den eigenen Platz bedient jeder selbst; Optionen, Computergegner und Start nur der Host.
// Alles geht als Anfrage an den Server; angezeigt wird der Stand, den der Server zurückschickt.
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { TokenId } from "@zueripoly/engine";
import { BOT_LEVEL_NAMES, MAX_PLAYERS, MIN_PLAYERS } from "@zueripoly/engine";
import type { RequestName, Requests, RoomSnapshot, SeatInfo } from "@zueripoly/server/protocol";
import { NAME_MAX, ROOM_LINK_PARAM } from "@zueripoly/server/protocol";
import { GameOptionsForm } from "../components/GameOptionsForm";
import { Icon } from "../components/Icon";
import { Token } from "../components/Token";
import { TokenPicker } from "../components/TokenPicker";
import type { OnlineClient } from "../online/connection";
import { BOT_LEVELS } from "./Lobby";
import "./Lobby.css";
import "./OnlineLobby.css";

interface OnlineLobbyProps {
  client: OnlineClient;
  room: RoomSnapshot;
  onLeave: () => void;
}

/** Warum der Host noch nicht starten kann (wie die Prüfung auf dem Server), sonst null. */
function startProblem(room: RoomSnapshot): string | null {
  if (room.seats.length < MIN_PLAYERS) return "Es braucht mindestens 2 Plätze. Lade jemanden ein oder nimm einen Computergegner dazu.";
  const away = room.seats.find((s) => s.bot === null && !s.connected);
  if (away) return `${away.name} ist nicht verbunden. Warten oder Platz entfernen.`;
  const waiting = room.seats.filter((s) => s.bot === null && !s.ready && s.id !== room.hostId);
  if (waiting.length > 0) return `Noch nicht bereit: ${waiting.map((s) => s.name).join(", ")}.`;
  return null;
}

function roomLink(code: string): string {
  return `${window.location.origin}/?${ROOM_LINK_PARAM}=${code}`;
}

/** Raumcode wie eine Anzeigetafel, mit Link zum Weitergeben. */
function RoomCode({ code }: { code: string }) {
  const link = roomLink(code);
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Link kopiert.");
    } catch {
      // Ohne sichere Verbindung (z. B. http im Heimnetz) darf die Seite nicht in die Zwischenablage schreiben.
      input.current?.select();
      setCopied("Link markiert: mit Ctrl+C kopieren.");
    }
  };

  return (
    <section className="room-code" aria-label="Raumcode">
      <div className="room-code__plate">
        <p className="room-code__label">Raumcode</p>
        <p className="room-code__value">{code}</p>
      </div>
      <div className="room-code__share">
        <p>Freunde wählen «Online mit Freunden» und geben den Code ein. Oder du schickst ihnen den Link:</p>
        <div className="room-code__link">
          <input ref={input} type="text" readOnly value={link} aria-label="Link zum Raum" onFocus={(e) => e.target.select()} />
          <button type="button" className="button" onClick={() => void copy()}>
            Link kopieren
          </button>
        </div>
        {copied && (
          <p className="room-code__copied" role="status">
            {copied}
          </p>
        )}
      </div>
    </section>
  );
}

/** Eigener Name: wird beim Verlassen des Feldes oder mit Enter an den Server geschickt. */
function NameInput({ seat, onCommit }: { seat: SeatInfo; onCommit: (name: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(seat.name);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(seat.name);
  }, [seat.name]);
  const commit = async () => {
    editing.current = false;
    const name = draft.trim();
    if (!name || name === seat.name) {
      setDraft(seat.name);
      return;
    }
    if (!(await onCommit(name))) setDraft(seat.name);
  };
  return (
    <label className="seat__name">
      <span className="visually-hidden">Dein Name</span>
      <input
        type="text"
        value={draft}
        maxLength={NAME_MAX}
        autoComplete="off"
        onFocus={() => (editing.current = true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function OnlineLobby({ client, room, onLeave }: OnlineLobbyProps) {
  const me = room.seats.find((s) => s.id === room.you);
  const isHost = room.hostId === room.you;
  const host = room.seats.find((s) => s.id === room.hostId);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const send = async <K extends RequestName>(name: K, data: Requests[K]["data"]): Promise<boolean> => {
    setWorking(true);
    const reply = await client.request(name, data);
    setWorking(false);
    setError(reply.ok ? null : reply.error);
    return reply.ok;
  };

  if (!me) return null;
  const problem = startProblem(room);
  const bots = room.seats.filter((s) => s.bot !== null).length;

  return (
    <main className="lobby online-lobby">
      <div className="lobby__form">
        <header className="lobby__head">
          <p>Online mit Freunden</p>
          <h1>{isHost ? "Dein Raum" : `Raum von ${host?.name ?? "…"}`}</h1>
        </header>

        <RoomCode code={room.code} />

        <ol className="seats" aria-label="Plätze">
          {room.seats.map((seat, i) => {
            const mine = seat.id === me.id;
            const taken = new Set<TokenId>(room.seats.filter((s) => s.id !== seat.id).map((s) => s.token));
            return (
              <li
                key={seat.id}
                className={`seat online-seat${seat.bot ? " seat--bot" : ""}${mine ? " online-seat--mine" : ""}`}
                style={{ "--player": `var(--player-${seat.token})`, "--player-on": `var(--player-${seat.token}-on)` } as CSSProperties}
              >
                <span className="seat__number num" aria-hidden="true">
                  {i + 1}
                </span>
                {mine ? (
                  <NameInput seat={seat} onCommit={(name) => send("lobby:seat", { name })} />
                ) : (
                  <span className="online-seat__name">{seat.name}</span>
                )}
                {mine ? (
                  <TokenPicker value={seat.token} taken={taken} who="dir" disabled={working} onChange={(token) => void send("lobby:seat", { token })} />
                ) : (
                  <span className="online-seat__token">
                    <Token token={seat.token} />
                  </span>
                )}
                {isHost && !mine ? (
                  <button
                    type="button"
                    className="seat__remove"
                    disabled={working}
                    onClick={() => void send("lobby:removeSeat", { seatId: seat.id })}
                    aria-label={`${seat.name} entfernen`}
                  >
                    <Icon name="close" />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
                <div className="online-seat__status">
                  {seat.id === room.hostId && <span className="chip chip--host">Host</span>}
                  {mine && <span className="chip chip--you">Du</span>}
                  {seat.bot === null && !seat.connected && <span className="chip chip--away">Getrennt</span>}
                  {seat.bot === null && seat.connected && seat.id !== room.hostId && (
                    <span className={`chip ${seat.ready ? "chip--ready" : "chip--waiting"}`}>{seat.ready ? "Bereit" : "Noch nicht bereit"}</span>
                  )}
                  {seat.bot !== null && !isHost && <span className="chip chip--bot">Computer · {BOT_LEVEL_NAMES[seat.bot]}</span>}
                  {seat.bot !== null && isHost && (
                    <span className="seat__level">
                      <span className="seat__kind" id={`level-${seat.id}`}>
                        Computer
                      </span>
                      <span className="segments" role="radiogroup" aria-labelledby={`level-${seat.id}`}>
                        {BOT_LEVELS.map(({ level, label }) => (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={seat.bot === level}
                            className="segments__item"
                            disabled={working}
                            onClick={() => void send("lobby:botLevel", { seatId: seat.id, level })}
                          >
                            {label}
                          </button>
                        ))}
                      </span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="online-lobby__seat-actions">
          {!isHost && (
            <button
              type="button"
              className={`button${me.ready ? "" : " button--primary"}`}
              disabled={working}
              aria-pressed={me.ready}
              onClick={() => void send("lobby:seat", { ready: !me.ready })}
            >
              {me.ready ? "Doch nicht bereit" : "Ich bin bereit"}
            </button>
          )}
          {isHost && room.seats.length < MAX_PLAYERS && bots < MAX_PLAYERS - 1 && (
            <button type="button" className="button" disabled={working} onClick={() => void send("lobby:addBot", { level: "easy" })}>
              Computergegner dazu
            </button>
          )}
        </div>

        <GameOptionsForm
          options={room.options}
          onChange={isHost ? (change) => void send("lobby:options", change) : undefined}
          note={isHost ? undefined : `Die Optionen stellt ${host?.name ?? "der Host"} ein.`}
        />

        {error && (
          <p className="lobby__error" role="alert">
            {error}
          </p>
        )}

        <div className="lobby__actions">
          {isHost ? (
            <button
              type="button"
              className="button button--primary lobby__start"
              disabled={working || problem !== null}
              onClick={() => void send("lobby:start", {})}
            >
              Losfahren
            </button>
          ) : (
            <p className="online-lobby__wait">{me.ready ? `${host?.name ?? "Der Host"} startet, sobald alle bereit sind.` : "Bereit? Dann gib Bescheid."}</p>
          )}
          <button type="button" className="button" onClick={onLeave}>
            Raum verlassen
          </button>
        </div>
        {isHost && problem && <p className="lobby__help">{problem}</p>}
      </div>
    </main>
  );
}
