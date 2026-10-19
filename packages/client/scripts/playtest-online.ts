// Online-Durchspiel-Test: eigener Spielserver und Vite-Server, ein Browserfenster (Playwright-Kontext)
// pro Person. Anna eröffnet einen Raum, die anderen treten über den Link bei, alle spielen gleichzeitig
// und klicken nur, wenn ihre eigene Tafel Knöpfe anbietet. Unterwegs lädt Ben die Seite neu
// (Wiederverbinden mit dem gespeicherten Platz). Bilder: screenshots/online-*.png
// Start: npm run playtest -w @zueripoly/client -- --online   (optional: --players 3 --money 500 --bots 0 --steps 600)
// Mit --prod wie im Internet (Seite auf GitHub Pages, Server auf Render): Die Seite wird gebaut
// (Pfad /zueripoly/, Serveradresse eingebaut) und von einem eigenen Server ausgeliefert, der Spielserver
// läuft unter einer anderen Adresse und erlaubt nur diese Seite. Bilder: screenshots/online-prod-*.png
// Mit --restart startet der Spielserver mitten in der Partie neu (wie Render nach einem Push): Die Fenster
// stellen den Raum aus dem aufbewahrten Spielstand wieder her und spielen bis zum Gewinner weiter.
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "playwright";
import { build, createServer, preview } from "vite";
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
const PROD = args.includes("--prod");
const RESTART = args.includes("--restart");
/** Bei diesem Schritt von Anna startet der Spielserver neu (mit --restart). */
const RESTART_AT = 40;
const PREFIX = PROD ? "online-prod" : "online";

/** Freier Port (für die Seite, damit der Spielserver ihre Adresse schon beim Start kennt). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

// Spielserver mit kurzen Bot-Pausen (die Browser laufen mit «weniger Bewegung»).
const timing = { botScale: 0.05, playbackScale: 0.1 };
/** Gleicher Schlüssel vor und nach dem Neustart (wie ZUERIPOLY_SAVE_KEY auf Render). */
const saveKey = randomBytes(32);
let gameOptions: Parameters<typeof startZueriServer>[0] = {};
let base: string;
let closeSite: () => Promise<void>;
let game: Awaited<ReturnType<typeof startZueriServer>>;
if (PROD) {
  const sitePort = await freePort();
  const siteOrigin = `http://localhost:${sitePort}`;
  gameOptions = { log: false, timing, saveKey, allowedOrigins: [siteOrigin] };
  game = await startZueriServer({ ...gameOptions, port: 0 });
  const outDir = mkdtempSync(path.join(tmpdir(), "zueripoly-prod-"));
  process.env.ZUERIPOLY_BASE = "/zueripoly/";
  process.env.VITE_ZUERIPOLY_SERVER = `http://localhost:${game.port}`;
  await build({ root: clientRoot, logLevel: "warn", build: { outDir, emptyOutDir: true } });
  const site = await preview({ root: clientRoot, logLevel: "warn", build: { outDir }, preview: { port: sitePort, strictPort: true } });
  base = `${siteOrigin}/zueripoly/`;
  closeSite = async () => {
    await site.close();
    rmSync(outDir, { recursive: true, force: true });
  };
  console.log(`Seite ${base} (gebaut), Spielserver http://localhost:${game.port} (erlaubt nur die Seite).`);
} else {
  gameOptions = { log: false, timing, saveKey };
  game = await startZueriServer({ ...gameOptions, port: 0 });
  process.env.ZUERIPOLY_SERVER = `http://localhost:${game.port}`;
  const vite = await createServer({ root: clientRoot, logLevel: "warn", server: { port: 5199, strictPort: false } });
  await vite.listen();
  base = vite.resolvedUrls?.local[0] ?? "http://localhost:5199/";
  closeSite = () => vite.close();
}

const browser = await chromium.launch();
let restarting = false;
let restarted = false;
const errors: string[] = [];
let exitCode = 0;

async function openWindow(name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "de-CH" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: Seitenfehler: ${e.message}`));
  page.on("console", (m) => {
    // Während des Neustarts scheitern Verbindungsversuche; das meldet der Browser selbst in der Konsole.
    if (restarting && /ERR_CONNECTION_REFUSED|WebSocket connection|Failed to load resource/.test(m.text())) return;
    if (m.type() === "error") errors.push(`${name}: Konsole: ${m.text()}`);
  });
  return { context, page };
}

const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: path.join(outDir, `${PREFIX}-${name}.png`), fullPage });

try {
  // --- Lobby -------------------------------------------------------------------------
  const windows = await Promise.all(NAMES.map((name) => openWindow(name)));
  const pages = windows.map((w) => w.page);
  const host = pages[0]!;
  await host.goto(base, { waitUntil: "networkidle" });
  await host.getByRole("button", { name: /Online mit Freunden/ }).click();
  await host.getByLabel("Dein Name").fill(NAMES[0]!);
  await shot(host, "start");
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
  await shot(host, "lobby-host", true);
  await shot(pages[1]!, "lobby-gast", true);

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
      while (restarting) await page.waitForTimeout(100);
      const state = await ready(page, 180_000);
      if (state === "end") {
        finished = true;
        return;
      }
      stats[i]!.steps++;
      if (i === 1 && stats[i]!.steps === RELOAD_AT && !reloaded) {
        reloaded = true;
        await shot(page, "spiel-gast");
        await page.reload({ waitUntil: "networkidle" });
        await page.locator(".tafel").waitFor({ timeout: 15_000 });
        console.log(`${NAMES[i]} hat die Seite neu geladen und ist wieder im Spiel.`);
        continue;
      }
      if (i === 0 && stats[i]!.steps === 20) await shot(page, "spiel-host");
      if (RESTART && i === 0 && stats[i]!.steps === RESTART_AT && !restarted) {
        restarted = true;
        await restartServer();
        continue;
      }
      try {
        if ((await randomStep(page, state)).traded) stats[i]!.trades++;
      } catch (error) {
        // Ein Knopf kann verschwinden, weil der Server inzwischen weiter ist (z. B. Zeitlimit). Dann nochmals schauen.
        if (finished) return;
        if (!(error instanceof Error && /Timeout|detached|not attached|intercepts/.test(error.message))) throw error;
      }
    }
  }
  /** Spielserver beenden und auf demselben Port mit demselben Schlüssel neu starten. */
  async function restartServer(): Promise<void> {
    restarting = true;
    await host.waitForTimeout(1000);
    const port = game.port;
    await game.close();
    console.log("Spielserver beendet (alle Räume weg).");
    await host.waitForTimeout(1500);
    game = await startZueriServer({ ...gameOptions, port });
    const started = Date.now();
    while (game.registry.roomCount === 0) {
      if (Date.now() - started > 30_000) throw new Error("Nach dem Neustart wurde der Raum nicht wiederhergestellt.");
      await host.waitForTimeout(100);
    }
    await Promise.all(pages.map((p) => p.locator(".connection").waitFor({ state: "detached", timeout: 30_000 })));
    await shot(host, "nach-neustart");
    restarting = false;
    console.log("Spielserver neu gestartet, Raum aus dem aufbewahrten Spielstand wiederhergestellt.");
  }

  await Promise.all(NAMES.map((_, i) => play(i)));

  const winner = finished ? (await host.locator(".tafel--end .tafel__name").innerText()).trim() : "kein Gewinner";
  await shot(host, "ende");
  console.log(`Ergebnis: ${winner}`);
  for (const [i, s] of stats.entries()) console.log(`  ${NAMES[i]}: ${s.steps} Schritte, ${s.trades} Handelsangebote`);
  if (!reloaded) throw new Error("Neu laden wurde nicht geprüft (Partie zu kurz).");
  if (RESTART && !restarted) throw new Error("Der Neustart wurde nicht geprüft (Partie zu kurz).");
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
  await closeSite();
  await game.close();
  process.exitCode = exitCode;
}
