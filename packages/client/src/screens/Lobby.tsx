// Lobby: Mitspielende mit Namen und Figur, dazu die Spieloptionen.
// Lokal: 2 bis 6 Personen an einem Gerät. Solo: du und 1 bis 5 Computergegner mit Stufe.
// Geprüft wird mit validateGameConfig aus der Engine (deutsche Fehlermeldung).
import { type CSSProperties, type FormEvent, useRef, useState } from "react";
import type { BotLevel, GameConfig, GameOptions, TokenId } from "@zueripoly/engine";
import { BOT_NAMES, DEFAULT_OPTIONS, MAX_PLAYERS, MIN_PLAYERS, TOKENS, validateGameConfig } from "@zueripoly/engine";
import { describeSave, loadLocalGame } from "../game/local-save";
import { GameOptionsForm } from "../components/GameOptionsForm";
import { Icon } from "../components/Icon";
import { TokenPicker } from "../components/TokenPicker";
import "./Lobby.css";

export type LobbyMode = "local" | "solo";

interface Seat {
  key: number;
  name: string;
  token: TokenId;
  /** Stufe des Computergegners oder null für einen Menschen. */
  bot: BotLevel | null;
}

interface LobbyProps {
  mode: LobbyMode;
  /** Einstellungen der letzten Partie (für «Nochmals spielen» / Zurück in die Lobby). */
  initial: GameConfig | null;
  onStart: (config: GameConfig) => void;
  onBack: () => void;
}

const MAX_BOTS = MAX_PLAYERS - 1;
export const BOT_LEVELS: { level: BotLevel; label: string }[] = [
  { level: "easy", label: "Einfach" },
  { level: "clever", label: "Clever" },
];

/** Zufälliger Zürcher Name, der noch nicht vergeben ist. */
function freeBotName(taken: readonly string[]): string {
  const free = BOT_NAMES.filter((n) => !taken.includes(n));
  return free[Math.floor(Math.random() * free.length)] ?? `Computer ${taken.length + 1}`;
}

function initialSeats(mode: LobbyMode, initial: GameConfig | null): Seat[] {
  if (initial) return initial.players.map((p, i) => ({ key: i, name: p.name, token: p.token, bot: p.bot ?? null }));
  if (mode === "local") {
    return [
      { key: 0, name: "", token: "tram", bot: null },
      { key: 1, name: "", token: "swan", bot: null },
    ];
  }
  const first = freeBotName([]);
  return [
    { key: 0, name: "", token: "tram", bot: null },
    { key: 1, name: first, token: "swan", bot: "easy" },
    { key: 2, name: freeBotName([first]), token: "boeoegg", bot: "easy" },
  ];
}

export function Lobby({ mode, initial, onStart, onBack }: LobbyProps) {
  const [seats, setSeats] = useState<Seat[]>(() => initialSeats(mode, initial));
  const [options, setOptions] = useState<GameOptions>(() => ({ ...DEFAULT_OPTIONS, ...initial?.options }));
  const [error, setError] = useState<string | null>(null);
  // Es gibt nur einen Speicherplatz: Ein neues Spiel ersetzt den gespeicherten Stand.
  const [save] = useState(loadLocalGame);
  const nextKey = useRef(seats.length);

  const update = (key: number, change: Partial<Seat>) => {
    setSeats((current) => current.map((s) => (s.key === key ? { ...s, ...change } : s)));
    setError(null);
  };

  const solo = mode === "solo";
  const bots = seats.filter((s) => s.bot !== null).length;

  const addSeat = () => {
    const used = new Set(seats.map((s) => s.token));
    const token = TOKENS.find((t) => !used.has(t));
    if (!token || seats.length >= MAX_PLAYERS) return;
    const seat: Seat = solo
      ? { key: nextKey.current++, name: freeBotName(seats.map((s) => s.name)), token, bot: "easy" }
      : { key: nextKey.current++, name: "", token, bot: null };
    setSeats([...seats, seat]);
  };

  const removeSeat = (key: number) => setSeats(seats.filter((s) => s.key !== key));
  const canRemove = (seat: Seat) => (solo ? seat.bot !== null && bots > 1 : seats.length > MIN_PLAYERS);

  const start = (event: FormEvent) => {
    event.preventDefault();
    const config: GameConfig = {
      players: seats.map((s, i) => ({ id: `p${i + 1}`, name: s.name.trim(), token: s.token, bot: s.bot })),
      options,
    };
    const names = config.players.map((p) => p.name.toLocaleLowerCase("de-CH")).filter((n) => n !== "");
    const problem = validateGameConfig(config) ?? (new Set(names).size < names.length ? "Jeder Name darf nur einmal vorkommen." : null);
    if (problem) {
      setError(problem);
      return;
    }
    onStart(config);
  };

  return (
    <main className="lobby">
      <form className="lobby__form" onSubmit={start} noValidate>
        <header className="lobby__head">
          <p>{solo ? "Solo gegen den Computer" : "Lokal spielen"}</p>
          <h1>{solo ? "Gegen wen fährst du?" : "Wer fährt mit?"}</h1>
        </header>

        <ol className="seats">
          {seats.map((seat, i) => {
            const takenByOthers = new Set(seats.filter((s) => s.key !== seat.key).map((s) => s.token));
            const who = seat.bot ? `Computergegner ${i}` : solo ? "dir" : `Spieler ${i + 1}`;
            return (
              <li
                key={seat.key}
                className={`seat${seat.bot ? " seat--bot" : ""}`}
                style={{ "--player": `var(--player-${seat.token})`, "--player-on": `var(--player-${seat.token}-on)` } as CSSProperties}
              >
                <span className="seat__number num" aria-hidden="true">
                  {i + 1}
                </span>
                <label className="seat__name">
                  <span className="visually-hidden">Name von {who}</span>
                  <input
                    type="text"
                    value={seat.name}
                    placeholder={solo && !seat.bot ? "Dein Name" : `Name Spieler ${i + 1}`}
                    maxLength={16}
                    autoComplete="off"
                    onChange={(e) => update(seat.key, { name: e.target.value })}
                  />
                </label>
                <TokenPicker value={seat.token} taken={takenByOthers} who={who} onChange={(token) => update(seat.key, { token })} />
                {canRemove(seat) && (
                  <button
                    type="button"
                    className="seat__remove"
                    onClick={() => removeSeat(seat.key)}
                    aria-label={`${seat.bot ? seat.name || who : `Spieler ${i + 1}`} entfernen`}
                  >
                    <Icon name="close" />
                  </button>
                )}
                {seat.bot && (
                  <div className="seat__level">
                    <span className="seat__kind" id={`level-${seat.key}`}>
                      Computer
                    </span>
                    <div className="segments" role="radiogroup" aria-labelledby={`level-${seat.key}`}>
                      {BOT_LEVELS.map(({ level, label }) => (
                        <button
                          key={level}
                          type="button"
                          role="radio"
                          aria-checked={seat.bot === level}
                          className="segments__item"
                          onClick={() => update(seat.key, { bot: level })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {seats.length < MAX_PLAYERS && (!solo || bots < MAX_BOTS) && (
          <button type="button" className="button lobby__add" onClick={addSeat}>
            {solo ? "Weiteren Computergegner dazu" : "Weitere Person dazu"}
          </button>
        )}
        {solo && (
          <p className="lobby__help">
            <strong>Einfach</strong> spielt nach Gefühl und macht Fehler. <strong>Clever</strong> rechnet mit Farbgruppen und Mieten,
            hält eine Geldreserve und handelt geschickt.
          </p>
        )}

        <GameOptionsForm options={options} onChange={(change) => setOptions((o) => ({ ...o, ...change }))} />

        {error && (
          <p className="lobby__error" role="alert">
            {error}
          </p>
        )}

        {save && <p className="lobby__note">Losfahren ersetzt das gespeicherte Spiel ({describeSave(save)}).</p>}

        <div className="lobby__actions">
          <button type="submit" className="button button--primary lobby__start">
            Losfahren
          </button>
          <button type="button" className="button" onClick={onBack}>
            Zurück
          </button>
        </div>
      </form>
    </main>
  );
}
