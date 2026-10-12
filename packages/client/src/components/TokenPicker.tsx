// Figurenwahl: sechs Figuren als runde Knöpfe. Schon vergebene Figuren sind blass und nicht wählbar.
import type { TokenId } from "@zueripoly/engine";
import { TOKENS, TOKEN_NAMES } from "@zueripoly/engine";
import { TokenFigure } from "./Token";
import "./TokenPicker.css";

interface TokenPickerProps {
  value: TokenId;
  /** Figuren, die andere schon haben. */
  taken: ReadonlySet<TokenId>;
  /** Für Screenreader: «Figur von …». */
  who: string;
  disabled?: boolean;
  onChange: (token: TokenId) => void;
}

export function TokenPicker({ value, taken, who, disabled = false, onChange }: TokenPickerProps) {
  return (
    <div className="token-picker" role="radiogroup" aria-label={`Figur von ${who}`}>
      {TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          role="radio"
          aria-checked={value === token}
          aria-label={TOKEN_NAMES[token]}
          title={TOKEN_NAMES[token]}
          className="token-picker__item"
          disabled={disabled || taken.has(token)}
          onClick={() => onChange(token)}
        >
          <TokenFigure token={token} />
        </button>
      ))}
    </div>
  );
}
