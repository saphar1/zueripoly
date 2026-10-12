// Restzeit des Zeitlimits online. Die Uhr läuft auf dem Server; der Browser zeigt sie nur an
// und zählt ab dem Empfang lokal herunter. Die Anzeige beginnt beim vollen Limit, auch wenn der
// Server noch Zeit fürs Abspielen der Bewegung dazugibt.
import { useEffect, useState } from "react";
import type { ReceivedClock } from "./connection";

export function useServerClock(clock: ReceivedClock | null): number | null {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!clock) return;
    setNow(performance.now());
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, [clock]);
  if (!clock) return null;
  const leftMs = clock.ms - (now - clock.receivedAt);
  return Math.max(0, Math.min(Math.ceil(clock.limitMs / 1000), Math.ceil(leftMs / 1000)));
}
