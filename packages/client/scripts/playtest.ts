// Durchspiel-Test der Oberfläche: Playwright startet ein lokales Spiel und klickt zufällig auf das,
// was die Tafel anbietet (dazu ab und zu Bauen/Belasten über die Besitzkarte), bis jemand gewinnt
// oder die Höchstzahl an Schritten erreicht ist. Meldet Fehler und Stellen, an denen nichts mehr geht.
// Start: npm run playtest -w @zueripoly/client   (optional: -- --steps 3000 --players 4 --money 500 --snapshot 150)
// Strategie: meist der Hauptknopf (kaufen, würfeln, Zug beenden), oft bauen, belasten nur bei Schulden.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.resolve(clientRoot, "../../screenshots");
const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const MAX_STEPS = option("steps", 2500);
const PLAYERS = ["Anna", "Ben", "Clara", "Dario", "Elif", "Fabio"].slice(0, option("players", 3));
const START_MONEY = option("money", 1500);
/** Bei diesem Schritt ein Bild mitten aus der Partie speichern (0 = keins). */
const SNAPSHOT = option("snapshot", 0);

/** Wartet, bis die Oberfläche wieder bereit ist: freie Knöpfe auf der Tafel, Spielende oder Geld auftreiben. */
async function ready(page: Page): Promise<"buttons" | "end" | "manage"> {
  const handle = await page.waitForFunction(
    () => {
      if (document.querySelector(".tafel--end")) return "end";
      if (document.querySelector('.tafel[aria-busy="true"]')) return false;
      if (document.querySelector(".tafel .tafel__actions .button:not(:disabled)")) return "buttons";
      return document.querySelector(".tafel") ? "manage" : false;
    },
    null,
    { timeout: 15000 },
  );
  return (await handle.jsonValue()) as "buttons" | "end" | "manage";
}

/**
 * Ein Feld des wartenden Spielers anklicken und eine Aktion der Besitzkarte wählen.
 * `prefer`: bevorzugte Knöpfe; mit `only` wird sonst nichts gedrückt.
 */
async function manage(page: Page, prefer: RegExp, only = false): Promise<boolean> {
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
async function trade(page: Page): Promise<boolean> {
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

const server = await createServer({ root: clientRoot, logLevel: "warn", server: { port: 5198 } });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? "http://localhost:5198/";
const browser = await chromium.launch();
const errors: string[] = [];
let exitCode = 0;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "de-CH" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`Seitenfehler: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`Konsole: ${m.text()}`);
  });

  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Lokal spielen/ }).click();
  for (let i = 1; i < PLAYERS.length - 1; i++) await page.getByRole("button", { name: "Weitere Person dazu" }).click();
  for (const [i, name] of PLAYERS.entries()) await page.getByPlaceholder(`Name Spieler ${i + 1}`).fill(name);
  for (let money = 1500; money > START_MONEY; money -= 100) await page.getByRole("button", { name: "−100", exact: true }).click();
  for (let money = 1500; money < START_MONEY; money += 100) await page.getByRole("button", { name: "+100", exact: true }).click();
  await page.getByRole("button", { name: "Losfahren" }).click();

  let steps = 0;
  let trades = 0;
  let result = "kein Gewinner";
  while (steps < MAX_STEPS) {
    const state = await ready(page);
    if (state === "end") {
      result = (await page.locator(".tafel__name").innerText()).trim();
      break;
    }
    steps++;
    if (steps === SNAPSHOT) await page.screenshot({ path: path.join(outDir, "playtest-mitten.png") });
    if (state === "manage") {
      // Schulden, aber Bankrott noch nicht erlaubt: Geld auftreiben.
      if (!(await manage(page, /verkaufen|Hypothek aufnehmen/))) throw new Error("Schulden, aber keine Aktion möglich.");
      continue;
    }
    // Ab und zu handeln.
    if (Math.random() < 0.05 && (await page.getByRole("button", { name: "Handeln" }).count()) > 0) {
      if (await trade(page)) trades++;
      continue;
    }
    // Oft bauen (falls möglich), selten auslösen: so endet eine Partie schneller.
    if (Math.random() < 0.3 && (await page.locator(".tafel__hint", { hasText: "Feld auf dem Brett anklicken" }).count()) > 0) {
      if (await manage(page, Math.random() < 0.9 ? /bauen/ : /Auslösen/, true)) continue;
    }
    const buttons = page.locator(".tafel .tafel__actions .button:not(:disabled)");
    const labels = await buttons.allInnerTexts();
    // Meist der Hauptknopf (steht vorne), sonst zufällig; Bankrott nur, wenn nichts anderes geht.
    const options = labels.map((label, i) => ({ label, i })).filter((o) => !/Bankrott/.test(o.label));
    const pick =
      options.length === 0
        ? 0
        : Math.random() < 0.8
          ? options[0]!.i
          : options[Math.floor(Math.random() * options.length)]!.i;
    await buttons.nth(pick).click();
    // Gezogene Karte wegklicken, damit sie nicht über der Besitzkarte liegt.
    const close = page.getByRole("button", { name: "Zurücklegen" });
    if ((await close.count()) > 0 && (await close.first().isVisible())) await close.first().click();
  }

  await page.screenshot({ path: path.join(outDir, "playtest-ende.png") });
  console.log(`Schritte: ${steps}, Handelsangebote: ${trades}, Ergebnis: ${result}`);
  const logLines = await page.locator(".log__text").count();
  console.log(`Protokollzeilen sichtbar: ${logLines}`);
  await context.close();
} catch (error) {
  exitCode = 1;
  console.log("Abbruch:", error instanceof Error ? error.message : error);
} finally {
  if (errors.length > 0) {
    exitCode = 1;
    console.log(`Fehler (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.log(" -", e);
  } else {
    console.log("Keine Fehler in der Konsole.");
  }
  await browser.close();
  await server.close();
  process.exitCode = exitCode;
}
