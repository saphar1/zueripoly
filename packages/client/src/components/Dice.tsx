// Würfel als SVG: Papierfläche, Tintenrand, Augen als Kreise.
import type { Dice as DicePair } from "@zueripoly/engine";
import "./Dice.css";

const PIPS: Record<number, [number, number][]> = {
  1: [[32, 32]],
  2: [[19, 19], [45, 45]],
  3: [[19, 19], [32, 32], [45, 45]],
  4: [[19, 19], [45, 19], [19, 45], [45, 45]],
  5: [[19, 19], [45, 19], [32, 32], [19, 45], [45, 45]],
  6: [[19, 19], [45, 19], [19, 32], [45, 32], [19, 45], [45, 45]],
};

export function Die({ value }: { value: number }) {
  return (
    <svg className="die" viewBox="0 0 64 64" role="img" aria-label={value > 0 ? `Würfel: ${value}` : "Würfel"}>
      <rect className="die__face" x="2" y="2" width="60" height="60" />
      {(PIPS[value] ?? []).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} className="die__pip" cx={cx} cy={cy} r="6" />
      ))}
    </svg>
  );
}

interface DiceProps {
  dice: DicePair;
  /** Würfel rollen gerade (Augen wechseln, Würfel wackeln). */
  rolling?: boolean;
  /** Wenn gesetzt, sind die Würfel ein Knopf. */
  onRoll?: () => void;
}

export function Dice({ dice, rolling = false, onRoll }: DiceProps) {
  const className = `dice${rolling ? " dice--rolling" : ""}`;
  const faces = (
    <>
      <Die value={dice[0]} />
      <Die value={dice[1]} />
    </>
  );
  if (!onRoll) return <div className={className}>{faces}</div>;
  return (
    <button type="button" className={`${className} dice--button`} onClick={onRoll} aria-label="Würfeln" aria-busy={rolling}>
      {faces}
    </button>
  );
}
