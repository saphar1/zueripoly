// Kontostand, der bei Änderungen sichtbar hoch- oder runterzählt (--motion-count),
// dazu kurz ein Etikett mit der Differenz («+200 CHF»).
import { useEffect, useRef, useState } from "react";
import { formatChf } from "../format";
import { motionMs } from "../motion";
import "./Money.css";

function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    const duration = motionMs("count");
    if (from === target || duration <= 1) {
      current.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const value = Math.round(from + (target - from) * eased);
      current.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}

export function Money({ amount, className }: { amount: number; className?: string }) {
  const shown = useCountUp(amount);
  const previous = useRef(amount);
  const [delta, setDelta] = useState<{ value: number; id: number } | null>(null);

  useEffect(() => {
    const difference = amount - previous.current;
    previous.current = amount;
    if (difference === 0) return;
    setDelta({ value: difference, id: performance.now() });
    const timer = setTimeout(() => setDelta(null), 1800);
    return () => clearTimeout(timer);
  }, [amount]);

  return (
    <span className={`money${className ? ` ${className}` : ""}`}>
      <span className="num">{formatChf(shown)}</span>
      {delta && (
        <span key={delta.id} className={`money__delta money__delta--${delta.value > 0 ? "plus" : "minus"}`} aria-live="polite">
          {delta.value > 0 ? "+" : "−"}
          {formatChf(Math.abs(delta.value))}
        </span>
      )}
    </span>
  );
}
