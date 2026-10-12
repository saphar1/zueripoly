// Zeitlimit pro Entscheidung (Option der Lobby). Die Uhr läuft ausserhalb der Engine:
// Ist die Zeit um, schickt der Client «timeout» für den wartenden Spieler (siehe docs/engine.md).
import { useEffect, useRef, useState } from "react";

/**
 * @param limit Sekunden oder null (kein Zeitlimit)
 * @param resetKey ändert sich bei jedem neuen Spielstand → Uhr beginnt von vorn
 * @param paused z. B. während Bewegungen oder nach Spielende
 * @returns Restzeit in Sekunden oder null
 */
export function useTurnTimer(limit: number | null, resetKey: unknown, paused: boolean, onTimeout: () => void): number | null {
  const [left, setLeft] = useState(limit ?? 0);
  const timeout = useRef(onTimeout);

  useEffect(() => {
    timeout.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    setLeft(limit ?? 0);
  }, [limit, resetKey]);

  useEffect(() => {
    if (limit === null || paused) return;
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [limit, paused, resetKey]);

  useEffect(() => {
    if (limit !== null && !paused && left === 0) timeout.current();
  }, [left, limit, paused]);

  return limit === null ? null : left;
}
