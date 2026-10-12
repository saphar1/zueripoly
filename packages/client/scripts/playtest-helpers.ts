// Gemeinsame Klick-Hilfen der Durchspiel-Tests (lokal, solo, online).
import type { Page } from "playwright";

export type Readiness = "buttons" | "end" | "manage";

/** Wartet, bis die Oberfläche wieder bereit ist: freie Knöpfe auf der Tafel, Spielende oder Geld auftreiben. */
export async function ready(page: Page, timeout: number): Promise<Readiness> {
  const handle = await page.waitForFunction(
    () => {
      if (document.querySelector(".tafel--end")) return "end";
      if (document.querySelector('.tafel[aria-busy="true"]')) return false;
      if (document.querySelector(".tafel .tafel__actions .button:not(:disabled)")) return "buttons";
      return document.querySelector(".tafel") ? "manage" : false;
    },
    null,
    { timeout, polling: 50 },
  );
  return (await handle.jsonValue()) as Readiness;
}

/**
 * Ein Feld des wartenden Spielers anklicken und eine Aktion der Besitzkarte wählen.
 * `prefer`: bevorzugte Knöpfe; mit `only` wird sonst nichts gedrückt.
 */
export async function manage(page: Page, prefer: RegExp, only = false): Promise<boolean> {
  const name = (await page.locator(".tafel__name").innerText()).trim();
  const cells = page.locator(`.board__cell[aria-label*="gehört ${name}"]`);
  const count = await cells.count();
  const order = Array.from({ length: count }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (const i of order) {
    await cells.nth(i).click();
    const buttons = page.locator(".center__overlay .property-actions .button:not(:disabled)");
    const n = await buttons.count();
    if (n > 0) {
      const labels = await buttons.allInnerTexts();
      const preferred = labels.findIndex((l) => prefer.test(l));
      if (preferred >= 0 || !only) {
        await buttons.nth(preferred >= 0 ? preferred : Math.floor(Math.random() * n)).click();
        await page.keyboard.press("Escape");
        return true;
      }
    }
    await page.keyboard.press("Escape");
  }
  return false;
}

/** Ein zufälliges Handelsangebot zusammenstellen und senden (oder abbrechen, wenn es nicht gültig ist). */
export async function trade(page: Page): Promise<boolean> {
  await page.getByRole("button", { name: "Handeln" }).click();
  const boxes = page.locator(".trade-side input[type=checkbox]:not(:disabled)");
  const n = await boxes.count();
  for (let k = 0; k < Math.min(n, 1 + Math.floor(Math.random() * 2)); k++) {
    await boxes.nth(Math.floor(Math.random() * n)).click();
  }
  if (Math.random() < 0.5) await page.locator(".trade-money input").first().fill(String(10 * Math.floor(Math.random() * 10)));
  const send = page.getByRole("button", { name: "Angebot senden" });
  if (await send.isEnabled()) {
    await send.click();
    return true;
  }
  await page.getByRole("button", { name: "Abbrechen" }).click();
  return false;
}

/**
 * Ein Schritt wie ein zufälliger Mensch: meist der Hauptknopf, oft bauen, ab und zu handeln,
 * bei Schulden Geld auftreiben. Gibt zurück, ob ein Handelsangebot verschickt wurde.
 */
export async function randomStep(page: Page, state: Exclude<Readiness, "end">): Promise<{ traded: boolean }> {
  if (state === "manage") {
    // Schulden, aber Bankrott noch nicht erlaubt: Geld auftreiben.
    if (!(await manage(page, /verkaufen|Hypothek aufnehmen/))) throw new Error("Schulden, aber keine Aktion möglich.");
    return { traded: false };
  }
  // Ab und zu handeln.
  if (Math.random() < 0.05 && (await page.getByRole("button", { name: "Handeln" }).count()) > 0) {
    return { traded: await trade(page) };
  }
  // Oft bauen (falls möglich), selten auslösen: so endet eine Partie schneller.
  if (Math.random() < 0.3 && (await page.locator(".tafel__hint", { hasText: "Feld auf dem Brett anklicken" }).count()) > 0) {
    if (await manage(page, Math.random() < 0.9 ? /bauen/ : /Auslösen/, true)) return { traded: false };
  }
  const buttons = page.locator(".tafel .tafel__actions .button:not(:disabled)");
  const labels = await buttons.allInnerTexts();
  // Meist der Hauptknopf (steht vorne), sonst zufällig; Bankrott nur, wenn nichts anderes geht.
  const options = labels.map((label, i) => ({ label, i })).filter((o) => !/Bankrott/.test(o.label));
  const pick = options.length === 0 ? 0 : Math.random() < 0.8 ? options[0]!.i : options[Math.floor(Math.random() * options.length)]!.i;
  await buttons.nth(pick).click();
  // Gezogene Karte wegklicken, damit sie nicht über der Besitzkarte liegt. Ziehen Bots schnell weiter,
  // wechselt die Karte laufend; dann nicht warten (die nächste Karte ersetzt sie ohnehin).
  const close = page.getByRole("button", { name: "Zurücklegen" });
  if ((await close.count()) > 0 && (await close.first().isVisible())) await close.first().click({ timeout: 2000 }).catch(() => undefined);
  return { traded: false };
}
