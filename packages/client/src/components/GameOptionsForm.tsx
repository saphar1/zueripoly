// Spieloptionen der Lobby: Startkapital, Topf am Zürichsee, Zeitlimit.
// Ohne `onChange` nur zum Lesen (online sehen alle die Einstellungen, ändern darf nur der Host).
import type { GameOptions, TurnTimeLimit } from "@zueripoly/engine";
import { START_MONEY_MAX, START_MONEY_MIN, START_MONEY_STEP, TURN_TIME_LIMITS } from "@zueripoly/engine";
import { formatChf } from "../format";
import "./GameOptionsForm.css";

interface GameOptionsFormProps {
  options: GameOptions;
  /** Änderung melden. Fehlt sie, werden die Optionen nur angezeigt. */
  onChange?: (change: Partial<GameOptions>) => void;
  /** Hinweis unter dem Titel, z. B. «Nur der Host ändert die Optionen.» */
  note?: string;
}

const LIMITS: (TurnTimeLimit | null)[] = [null, ...TURN_TIME_LIMITS];
const limitText = (limit: TurnTimeLimit | null) => (limit === null ? "Aus" : `${limit} s`);
const JACKPOT_HELP = "Steuern, Bussen und Kautionen kommen in einen Topf. Wer auf «Ferien am Zürichsee» landet, kassiert ihn.";

export function GameOptionsForm({ options, onChange, note }: GameOptionsFormProps) {
  if (!onChange) {
    return (
      <section className="options" aria-label="Optionen">
        <h2>Optionen</h2>
        {note && <p className="options__note">{note}</p>}
        <dl className="options__list">
          <div className="option">
            <dt className="option__label">Startkapital</dt>
            <dd className="option__value num">{formatChf(options.startMoney)}</dd>
          </div>
          <div className="option">
            <dt className="option__label">Topf am Zürichsee</dt>
            <dd className="option__value">{options.jackpot ? "An" : "Aus"}</dd>
          </div>
          <div className="option">
            <dt className="option__label">Zeitlimit pro Entscheid</dt>
            <dd className="option__value">{limitText(options.turnTimeLimit)}</dd>
          </div>
        </dl>
      </section>
    );
  }

  const changeMoney = (delta: number) =>
    onChange({ startMoney: Math.min(START_MONEY_MAX, Math.max(START_MONEY_MIN, options.startMoney + delta)) });

  return (
    <section className="options" aria-label="Optionen">
      <h2>Optionen</h2>
      {note && <p className="options__note">{note}</p>}
      <div className="option">
        <span className="option__label">Startkapital</span>
        <div className="stepper">
          <button type="button" className="button" onClick={() => changeMoney(-500)} disabled={options.startMoney <= START_MONEY_MIN}>
            −500
          </button>
          <button type="button" className="button" onClick={() => changeMoney(-START_MONEY_STEP)} disabled={options.startMoney <= START_MONEY_MIN}>
            −{START_MONEY_STEP}
          </button>
          <output className="stepper__value num" aria-live="polite">
            {formatChf(options.startMoney)}
          </output>
          <button type="button" className="button" onClick={() => changeMoney(START_MONEY_STEP)} disabled={options.startMoney >= START_MONEY_MAX}>
            +{START_MONEY_STEP}
          </button>
          <button type="button" className="button" onClick={() => changeMoney(500)} disabled={options.startMoney >= START_MONEY_MAX}>
            +500
          </button>
        </div>
      </div>

      <div className="option">
        <span className="option__label" id="jackpot-label">
          Topf am Zürichsee
        </span>
        <button
          type="button"
          className="toggle"
          aria-labelledby="jackpot-label"
          aria-pressed={options.jackpot}
          onClick={() => onChange({ jackpot: !options.jackpot })}
        >
          <span className="toggle__track" aria-hidden="true">
            <span className="toggle__knob" />
          </span>
          {options.jackpot ? "An" : "Aus"}
        </button>
        <p className="option__help">{JACKPOT_HELP}</p>
      </div>

      <div className="option">
        <span className="option__label" id="limit-label">
          Zeitlimit pro Entscheid
        </span>
        <div className="segments" role="radiogroup" aria-labelledby="limit-label">
          {LIMITS.map((limit) => (
            <button
              key={limit ?? "aus"}
              type="button"
              role="radio"
              aria-checked={options.turnTimeLimit === limit}
              className="segments__item"
              onClick={() => onChange({ turnTimeLimit: limit })}
            >
              {limitText(limit)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
