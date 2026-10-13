// Online-Start: Name eingeben, dann Raum eröffnen (du bist Host) oder mit Raumcode beitreten.
// Wer vor kurzem in einem Raum war, kann direkt dorthin zurück.
import { type FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Reply, SeatGrant } from "@zueripoly/server/protocol";
import { NAME_MAX, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@zueripoly/server/protocol";
import { type ConnectionStatus, type OnlineClient, SERVER_URL } from "../online/connection";
import { loadLastSeat, loadName, saveName } from "../online/seat-storage";
import "./Lobby.css";
import "./OnlineStart.css";

interface OnlineStartProps {
  client: OnlineClient;
  /** Raumcode aus dem Link (?raum=…), sonst leer. */
  initialCode: string;
  /** Platz bekommen: weiter in den Raum. */
  onSeated: () => void;
  onBack: () => void;
}

/** Nur erlaubte Zeichen, Grossbuchstaben, höchstens 5. */
export function cleanCodeInput(value: string): string {
  return [...value.toUpperCase()].filter((c) => ROOM_CODE_ALPHABET.includes(c)).join("").slice(0, ROOM_CODE_LENGTH);
}

/** Wie lange schon keine Verbindung: «fresh» (bis 3 s), «slow» (bis 90 s), danach «stuck». */
type Waiting = "fresh" | "slow" | "stuck";

function useWaiting(status: ConnectionStatus): Waiting {
  const [waiting, setWaiting] = useState<Waiting>("fresh");
  const online = status === "online";
  useEffect(() => {
    setWaiting("fresh");
    if (online) return;
    const slow = setTimeout(() => setWaiting("slow"), 3000);
    const stuck = setTimeout(() => setWaiting("stuck"), 90_000);
    return () => {
      clearTimeout(slow);
      clearTimeout(stuck);
    };
  }, [online]);
  return waiting;
}

/** Satz zur Verbindung, solange sie nicht steht. */
function connectionText(status: ConnectionStatus, waiting: Waiting): string {
  if (SERVER_URL) {
    // Gratis-Server im Internet: schläft nach 15 Minuten ohne Spiel und wacht bei der ersten Anfrage auf.
    if (waiting === "stuck") return "Der Spielserver antwortet nicht. Bitte später nochmals versuchen.";
    if (status === "connecting" && waiting === "fresh") return "Verbinde mit dem Spielserver …";
    return "Der Spielserver schläft und wird gerade geweckt. Das dauert bis zu einer Minute, die Seite verbindet sich von selbst.";
  }
  if (status === "connecting") return "Verbinde mit dem Spielserver …";
  return import.meta.env.DEV
    ? "Keine Verbindung zum Spielserver. Läuft er? (Im Projektordner: npm run dev)"
    : "Keine Verbindung zum Spielserver. Läuft er noch? (Im Projektordner: npm start)";
}

export function OnlineStart({ client, initialCode, onSeated, onBack }: OnlineStartProps) {
  const online = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const waiting = useWaiting(online.status);
  const last = useMemo(loadLastSeat, []);
  const [name, setName] = useState(() => loadName() || last?.name || "");
  const [code, setCode] = useState(() => cleanCodeInput(initialCode));
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const run = async (task: () => Promise<Reply<SeatGrant>>) => {
    setWorking(true);
    setError(null);
    const reply = await task();
    setWorking(false);
    if (reply.ok) onSeated();
    else setError(reply.error);
  };

  const withName = (next: (trimmed: string) => void) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Bitte zuerst deinen Namen eingeben.");
      return;
    }
    saveName(trimmed);
    next(trimmed);
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    withName((n) => void run(() => client.create(n)));
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== ROOM_CODE_LENGTH) {
      setError(`Der Raumcode hat ${ROOM_CODE_LENGTH} Zeichen.`);
      return;
    }
    withName((n) => void run(() => client.join(code, n)));
  };

  return (
    <main className="lobby online-start">
      <div className="lobby__form">
        <header className="lobby__head">
          <p>Online mit Freunden</p>
          <h1>Wer fährt mit?</h1>
        </header>

        {online.status !== "online" && (
          <p className="online-start__status" role="status">
            {connectionText(online.status, waiting)}
          </p>
        )}

        {last && (
          <section className="online-start__resume" aria-label="Letzter Raum">
            <p>
              Du warst in Raum <strong className="num">{last.code}</strong> als <strong>{last.name}</strong>.
            </p>
            <button type="button" className="button" disabled={working} onClick={() => void run(() => client.resume(last, last.name))}>
              Zurück in Raum {last.code}
            </button>
          </section>
        )}

        <label className="online-start__name">
          <span>Dein Name</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            placeholder="Name für die Mitspielenden"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </label>

        <div className="online-start__ways">
          <form className="way" onSubmit={create}>
            <h2>Raum eröffnen</h2>
            <div className="way__body">
              <p>Du bekommst einen Raumcode für deine Freunde. Als Host stellst du die Optionen ein und startest das Spiel.</p>
              <button type="submit" className="button button--primary" disabled={working}>
                Raum eröffnen
              </button>
            </div>
          </form>

          <form className="way" onSubmit={join}>
            <h2>Raum beitreten</h2>
            <div className="way__body">
              <label className="way__code">
                <span>Raumcode</span>
                <input
                  type="text"
                  value={code}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={ROOM_CODE_LENGTH + 4}
                  aria-describedby="code-help"
                  onChange={(e) => {
                    setCode(cleanCodeInput(e.target.value));
                    setError(null);
                  }}
                />
              </label>
              <p id="code-help" className="way__help">
                5 Zeichen. Ohne 0, O, 1, I und L, damit nichts verwechselt wird.
              </p>
              <button type="submit" className="button button--primary" disabled={working || code.length !== ROOM_CODE_LENGTH}>
                Beitreten
              </button>
            </div>
          </form>
        </div>

        {error && (
          <p className="lobby__error" role="alert">
            {error}
          </p>
        )}

        <div className="lobby__actions">
          <button type="button" className="button" onClick={onBack}>
            Zurück
          </button>
        </div>
      </div>
    </main>
  );
}
