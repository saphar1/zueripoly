// Welche Webseiten dürfen mit dem Spielserver sprechen? Die eigene Seite (gleiche Adresse: WLAN,
// Render, Vite-Weiterleitung) und die ausdrücklich erlaubten (z. B. die Seite auf GitHub Pages).
// Fremde Webseiten werden abgelehnt, damit sie Besucher nicht unbemerkt mitspielen lassen.

/** Origin vereinheitlichen: Kleinbuchstaben, ohne Schrägstrich am Ende. */
export function normalizeOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, "");
}

/** Liste aus der Umgebungsvariable ZUERIPOLY_ORIGINS («https://a.github.io, https://b.ch»). */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(normalizeOrigin)
    .filter((origin) => origin.length > 0);
}

/**
 * Darf eine Anfrage mit diesem Origin verbinden? Ohne Origin (keine Webseite, z. B. Tests) ja,
 * bei gleicher Adresse wie der Server (Host-Kopfzeile) ja, sonst nur, wenn er erlaubt ist.
 */
export function originAllowed(origin: string | undefined, host: string | undefined, allowed: readonly string[]): boolean {
  if (origin === undefined) return true;
  const normalized = normalizeOrigin(origin);
  if (allowed.includes(normalized)) return true;
  try {
    return host !== undefined && new URL(normalized).host === host.toLowerCase();
  } catch {
    return false;
  }
}
