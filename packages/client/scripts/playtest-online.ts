// Online-Durchspiel-Test: eigener Spielserver und Vite-Server, ein Browserfenster (Playwright-Kontext)
// pro Person. Anna eröffnet einen Raum, die anderen treten über den Link bei, alle spielen gleichzeitig
// und klicken nur, wenn ihre eigene Tafel Knöpfe anbietet. Unterwegs lädt Ben die Seite neu
// (Wiederverbinden mit dem gespeicherten Platz). Bilder: screenshots/online-*.png
// Start: npm run playtest -w @zueripoly/client -- --online   (optional: --players 3 --money 500 --bots 0 --steps 600)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "playwright";
import { createServer } from "vite";
import { startZueriServer } from "@zueripoly/server";
import { randomStep, ready } from "./playtest-helpers";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.resolve(clientRoot, "../../screenshots");
const args = process.argv.slice(2);
const option = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const NAMES = ["Anna", "Ben", "Clara", "Dario", "Elif", "Fabio"].slice(0, Math.min(6, Math.max(2, option("players", 3))));
const BOTS = Math.min(6 - NAMES.length, Math.max(0, option("bots", 0)));
const START_MONEY = option("money", 500);
/** Höchstzahl eigener Schritte pro Person. */
const MAX_STEPS = option("steps", 800);
/** Bei diesem Schritt lädt Ben die Seite neu. */
const RELOAD_AT = 25;

// Spielserver mit kurzen Bot-Pausen (die Browser laufen mit «weniger Bewegung»).
const game = await startZueriServer({ port: 0, log: false, timing: { botScale: 0.05, playbackScale: 0.1 } });
process.env.ZUERIPOLY_SERVER = `http://localhost:${game.port}`;
const vite = await createServer({ root: clientRoot, logLevel: "warn", server: { port: 5199, strictPort: false } });
await vite.listen();
const base = vite.resolvedUrls?.local[0] ?? "http://localhost:5199/";

const browser = await chromium.launch();
const errors: string[] = [];
let exitCode = 0;

async function openWindow(name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "de-CH" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: Seitenfehler: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name}: Konsole: ${m.text()}`);
  });
  return { context, page };
}

const shot = (page: Page, file: string, fullPage = false) => page.screenshot({ path: path.join(outDir, file), fullPage });

try {
  // --- Lobby -------------------------------------------------------------------------
  const windows = await Promise.all(NAMES.map((name) => openWindow(name)));
  const pages = windows.map((w) => w.page);
  const host = pages[0]!;
  await host.goto(base, { waitUntil: "networkidle" });
  await host.getByRole("button", { name: /Online mit Freunden/ }).click();
  await host.getByLabel("Dein Name").fill(NAMES[0]!);
  await shot(host, "online-start.png");
  await host.getByRole("button", { name: "Raum eröffnen" }).click();
  const code = (await host.locator(".room-code__value").innerText()).trim();
  console.log(`Raum ${code} eröffnet von ${NAMES[0]}.`);

  for (const [i, page] of pages.entries()) {
    if (i === 0) continue;
    await page.goto(`${base}?raum=${code}`, { waitUntil: "networkidle" });
    await page.getByLabel("Dein Name").fill(NAMES[i]!);
    await page.getByRole("button", { name: "Beitreten" }).click();
    await page.getByRole("button", { name: "Ich bin bereit" }).click();
  }
  for (let b = 0; b < BOTS; b++) await host.getByRole("button", { name: "Computergegner dazu" }).click();
  for (let money = 1500; money > START_MONEY; money -= 100) await host.getByRole("button", { name: "−100", exact: true }).click();
  await host.locator(".seat").nth(NAMES.length + BOTS - 1).waitFor();
  await shot(host, "online-lobby-host.png", true);
  await shot(pages[1]!, "online-lobby-gast.png", true);

  const start = host.getByRole("button", { name: "Losfahren" });
  await start.waitFor();
  await host.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".lobby__start")?.disabled, null, { timeout: 10_000 });
  await start.click();
  await Promise.all(pages.map((p) => p.locator(".tafel").waitFor({ timeout: 15_000 })));
  console.log(`Spiel gestartet: ${NAMES.join(", ")}${BOTS > 0 ? ` und ${BOTS} Computergegner` : ""}, Startkapital ${START_MONEY} CHF.`);

  // --- Spiel: alle gleichzeitig, jeder klickt nur auf der eigenen Tafel --------------------
  let finished = false;
  let reloaded = false;
  const stats = NAMES.map(() => ({ steps: 0, trades: 0 }));

  async function play(i: number): Promise<void> {
    const page = pages[i]!;
    while (!finished && stats[i]!.steps < MAX_STEPS) {
      const state = await ready(page, 180_000);
      if (state === "end") {
        finished = true;
        return;
      }
      stats[i]!.steps++;
      if (i === 1 && stats[i]!.steps === RELOAD_AT && !reloaded) {
        reloaded = true;
        await shot(page, "online-spiel-gast.png");
        await page.reload({ waitUntil: "networkidle" });
        await page.locator(".tafel").waitFor({ timeout: 15_000 });
        console.log(`${NAMES[i]} hat die Seite neu geladen und ist wieder im Spiel.`);
        continue;
      }
      if (i === 0 && stats[i]!.steps === 20) await shot(page, "online-spiel-host.png");
      try {
        if ((await randomStep(page, state)).traded) stats[i]!.trades++;
      } catch (error) {
        // Ein Knopf kann verschwinden, weil der Server inzwischen weiter ist (z. B. Zeitlimit). Dann nochmals schauen.
        if (finished) return;
        if (!(error instanceof Error && /Timeout|detached|not attached|intercepts/.test(error.message))) throw error;
      }
    }
  }
  await Promise.all(NAMES.map((_, i) => play(i)));

  const winner = finished ? (await host.locator(".tafel--end .tafel__name").innerText()).trim() : "kein Gewinner";
  await shot(host, "online-ende.png");
  console.log(`Ergebnis: ${winner}`);
  for (const [i, s] of stats.entries()) console.log(`  ${NAMES[i]}: ${s.steps} Schritte, ${s.trades} Handelsangebote`);
  if (!reloaded) throw new Error("Neu laden wurde nicht geprüft (Partie zu kurz).");
  // Alle Fenster zeigen dasselbe Ergebnis und dasselbe Protokoll-Ende.
  const lastLines = await Promise.all(pages.map((p) => p.locator(".log__text").first().innerText()));
  if (new Set(lastLines).size !== 1) throw new Error(`Protokoll-Enden unterscheiden sich: ${lastLines.join(" | ")}`);
  console.log(`Letzte Protokollzeile bei allen gleich: «${lastLines[0]}»`);

  // Host bringt alle zurück in die Lobby.
  if (finished) {
    await host.getByRole("button", { name: "Zurück in die Lobby" }).click();
    await Promise.all(pages.map((p) => p.locator(".room-code").waitFor({ timeout: 10_000 })));
    console.log("Alle sind zurück in der Lobby.");
  }
  for (const w of windows) await w.context.close();
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
  await vite.close();
  await game.close();
  process.exitCode = exitCode;
}
