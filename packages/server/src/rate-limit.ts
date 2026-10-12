// Einfache Begrenzung gegen Nachrichtenflut: ein «Eimer» pro Verbindung.
// Jede Nachricht nimmt eine Marke heraus; pro Sekunde kommen `perSecond` Marken nach, höchstens `capacity`.
// Ist der Eimer leer, wird die Nachricht abgelehnt.
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity = 20,
    private readonly perSecond = 10,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  /** Nimmt eine Marke. `false` = zu viele Nachrichten. */
  take(): boolean {
    const now = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
