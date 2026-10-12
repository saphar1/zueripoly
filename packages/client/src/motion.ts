// Bewegungsdauern für JavaScript-Abläufe. Quelle sind die CSS-Tokens (--motion-*),
// damit CSS und JS dieselben Werte nutzen und `prefers-reduced-motion` überall gilt.

export type MotionName = "dice" | "step" | "card" | "count" | "hover";

/** Dauer in Millisekunden, z. B. motionMs("step") → 150 (bzw. 1 bei reduzierter Bewegung). */
export function motionMs(name: MotionName): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${name}`).trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith("ms") ? value : value * 1000;
}

/** Wartet die angegebene Zeit (für Abläufe wie «Figur hüpft Feld für Feld»). */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
