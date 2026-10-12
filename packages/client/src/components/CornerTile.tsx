// Die vier Eckfelder: Start, Gefängnis, Ferien am Zürichsee, Gehe ins Gefängnis.
// Reine Anzeige; Zeiger und Klick behandelt das Brett.
import type { PlayerId, PlayerState, Space } from "@zueripoly/engine";
import { START_SALARY, TOKEN_NAMES } from "@zueripoly/engine";
import { formatChf } from "../format";
import { Icon } from "./Icon";
import { Token } from "./Token";
import "./CornerTile.css";

interface CornerTileProps {
  space: Space;
  /** Figuren auf diesem Feld (beim Gefängnis: nur die Besucher). */
  visitors: PlayerState[];
  /** Nur beim Gefängnis: wer drin sitzt. */
  prisoners: PlayerState[];
  /** Jackpot-Topf, wenn die Option aktiv ist, sonst `null`. */
  jackpot: number | null;
  movingPlayer: PlayerId | null;
  markedPlayer: PlayerId | null;
}

interface TokensProps {
  players: PlayerState[];
  className: string;
  movingPlayer: PlayerId | null;
  markedPlayer: PlayerId | null;
}

function Tokens({ players, className, movingPlayer, markedPlayer }: TokensProps) {
  if (players.length === 0) return null;
  return (
    <div className={className}>
      {players.map((p) => (
        <Token
          key={p.id}
          token={p.token}
          label={`${p.name} (${TOKEN_NAMES[p.token]})`}
          moving={p.id === movingPlayer}
          marked={p.id === markedPlayer}
        />
      ))}
    </div>
  );
}

export function CornerTile({ space, visitors, prisoners, jackpot, movingPlayer, markedPlayer }: CornerTileProps) {
  const marks = { movingPlayer, markedPlayer };
  switch (space.kind) {
    case "start":
      return (
        <div className="corner corner--start">
          <Icon name="arrow" className="corner__arrow" />
          <span className="corner__title">Start</span>
          <span className="corner__badge num">+{formatChf(START_SALARY)}</span>
          <Tokens players={visitors} className="corner__tokens" {...marks} />
        </div>
      );
    case "jail":
      return (
        <div className="corner corner--jail">
          <div className="jail__cell">
            <span className="jail__label">Gefängnis</span>
            <Tokens players={prisoners} className="jail__tokens" {...marks} />
            <svg className="jail__bars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M20 0 V100 M40 0 V100 M60 0 V100 M80 0 V100" />
            </svg>
          </div>
          <span className="jail__visit">Nur zu Besuch</span>
          <Tokens players={visitors} className="jail__visitors" {...marks} />
        </div>
      );
    case "vacation":
      return (
        <div className="corner corner--vacation">
          <span className="corner__title">Ferien</span>
          <span className="corner__sub">am Zürichsee</span>
          {jackpot !== null && <span className="corner__pot num">Topf {formatChf(jackpot)}</span>}
          <div className="vacation__lake">
            <Icon name="waves" />
          </div>
          <Tokens players={visitors} className="corner__tokens" {...marks} />
        </div>
      );
    case "goToJail":
      return (
        <div className="corner corner--gotojail">
          <span className="corner__title">Gehe ins Gefängnis</span>
          <Icon name="arrowDiagonal" className="corner__arrow" />
          <Tokens players={visitors} className="corner__tokens" {...marks} />
        </div>
      );
    default:
      return null;
  }
}
