// Die vier Eckfelder: Start, Gefängnis, Ferien am Zürichsee, Gehe ins Gefängnis.
import type { CSSProperties } from "react";
import type { PlayerState, Space } from "@zueripoly/engine";
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
  style: CSSProperties;
}

function Tokens({ players, className }: { players: PlayerState[]; className: string }) {
  if (players.length === 0) return null;
  return (
    <div className={className}>
      {players.map((p) => (
        <Token key={p.id} token={p.token} label={`${p.name} (${TOKEN_NAMES[p.token]})`} />
      ))}
    </div>
  );
}

export function CornerTile({ space, visitors, prisoners, jackpot, style }: CornerTileProps) {
  switch (space.kind) {
    case "start":
      return (
        <div className="corner corner--start" style={style} role="img" aria-label={`Start: ${formatChf(START_SALARY)} beim Vorbeiziehen`}>
          <Icon name="arrow" className="corner__arrow" />
          <span className="corner__title">Start</span>
          <span className="corner__badge num">+{formatChf(START_SALARY)}</span>
          <Tokens players={visitors} className="corner__tokens" />
        </div>
      );
    case "jail":
      return (
        <div className="corner corner--jail" style={style} role="img" aria-label="Gefängnis, aussen nur zu Besuch">
          <div className="jail__cell">
            <span className="jail__label">Gefängnis</span>
            <Tokens players={prisoners} className="jail__tokens" />
            <svg className="jail__bars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M25 0 V100 M50 0 V100 M75 0 V100" />
            </svg>
          </div>
          <span className="jail__visit">Nur zu Besuch</span>
          <Tokens players={visitors} className="jail__visitors" />
        </div>
      );
    case "vacation":
      return (
        <div
          className="corner corner--vacation"
          style={style}
          role="img"
          aria-label={`Ferien am Zürichsee${jackpot !== null ? `, Topf ${formatChf(jackpot)}` : ""}`}
        >
          <span className="corner__title">Ferien</span>
          <span className="corner__sub">am Zürichsee</span>
          {jackpot !== null && <span className="corner__pot num">Topf {formatChf(jackpot)}</span>}
          <div className="vacation__lake">
            <Icon name="waves" />
          </div>
          <Tokens players={visitors} className="corner__tokens" />
        </div>
      );
    case "goToJail":
      return (
        <div className="corner corner--gotojail" style={style} role="img" aria-label="Gehe ins Gefängnis">
          <span className="corner__title">Gehe ins Gefängnis</span>
          <Icon name="arrowDiagonal" className="corner__arrow" />
        </div>
      );
    default:
      return null;
  }
}
