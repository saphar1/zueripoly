// Tafel im Stil einer Haltestellenanzeige: dunkle Fläche, helle Schrift, Figur als «Liniennummer».
import type { TokenId } from "@zueripoly/engine";
import { Token } from "./Token";
import "./Sign.css";

export interface SignMessage {
  token: TokenId;
  /** Kopfzeile, z. B. «Anna · 4 + 3». */
  line: string;
  /** Kleine Zeile über dem Halt, z. B. «Nächster Halt». */
  label: string;
  /** Grosse Zeile: das Feld. */
  stop: string;
  /** Was dort passiert. */
  note?: string;
}

export function Sign({ token, line, label, stop, note }: SignMessage) {
  return (
    <div className="sign" role="status">
      <div className="sign__head">
        <Token token={token} />
        <span className="sign__line">{line}</span>
      </div>
      <p className="sign__label">{label}</p>
      <p className="sign__stop">{stop}</p>
      {note && <p className="sign__note">{note}</p>}
    </div>
  );
}
