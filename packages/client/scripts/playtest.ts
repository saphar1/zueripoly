// Durchspiel-Test der Oberfläche: Playwright startet ein lokales Spiel und klickt zufällig auf das,
// was die Tafel anbietet (dazu ab und zu Bauen/Belasten über die Besitzkarte), bis jemand gewinnt
// oder die Höchstzahl an Schritten erreicht ist. Meldet Fehler und Stellen, an denen nichts mehr geht.
// Start: npm run playtest -w @zueripoly/client   (optional: -- --steps 3000 --players 4 --money 500 --snapshot 150)
// Solo: -- --solo --bots 3 (Computergegner abwechselnd einfach/clever; geklickt wird nur für «Anna»).
// Online: -- --online --players 3 (eigener Spielserver, ein Browserfenster pro Person; siehe playtest-online.ts).
// Strategie: meist der Hauptknopf (kaufen, würfeln, Zug beenden), oft bauen, belasten nur bei Schulden.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { ready as waitReady, randomStep } from "./playtest-helpers";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.resolve(clientRoot, "../../screenshots");
const args = process.argv.slice(2);
if (args.includes("--online")) {
  await import("./playtest-online");
  process.exit(process.exitCode ?? 0);
}
const option = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const MAX_STEPS = option("steps", 2500);
const SOLO = args.includes("--solo");
const BOTS = Math.min(5, Math.max(1, option("bots", 3)));
const PLAYERS = ["Anna", "Ben", "Clara", "Dario", "Elif", "Fabio"].slice(0, option("players", 3));
/** Kurze Denkpause der Bots im Test (nur im Entwicklungsmodus wirksam). */
const BOT_PAUSE = 30;
const START_MONEY = option("money", 1500);
/** Bei diesem Schritt ein Bild mitten aus der Partie speichern (0 = keins). */
const SNAPSHOT = option("snapshot", 0);

/** Solo: Ist «Anna» bankrott, spielen die Bots allein zu Ende; das kann dauern. */
const ready = (page: Parameters<typeof waitReady>[0]) => waitReady(page, SOLO ? 600_000 : 15_000);

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
  if (SOLO) {
    await page.getByRole("button", { name: /Solo gegen den Computer/ }).click();
    await page.getByPlaceholder("Dein Name").fill("Anna");
    // Standard sind 2 Gegner: dazu oder weg, dann abwechselnd einfach / clever.
    for (let n = 2; n < BOTS; n++) await page.getByRole("button", { name: "Weiteren Computergegner dazu" }).click();
    for (let n = 2; n > BOTS; n--) await page.locator(".seat__remove").last().click();
    const levels = page.locator(".seat--bot .segments");
    for (let i = 0; i < BOTS; i++) await levels.nth(i).getByRole("radio", { name: i % 2 === 0 ? "Einfach" : "Clever" }).click();
    await page.screenshot({ path: path.join(outDir, "solo-lobby.png"), fullPage: true });
  } else {
    await page.getByRole("button", { name: /Lokal spielen/ }).click();
    for (let i = 1; i < PLAYERS.length - 1; i++) await page.getByRole("button", { name: "Weitere Person dazu" }).click();
    for (const [i, name] of PLAYERS.entries()) await page.getByPlaceholder(`Name Spieler ${i + 1}`).fill(name);
  }
  for (let money = 1500; money > START_MONEY; money -= 100) await page.getByRole("button", { name: "−100", exact: true }).click();
  for (let money = 1500; money < START_MONEY; money += 100) await page.getByRole("button", { name: "+100", exact: true }).click();
  await page.getByRole("button", { name: "Losfahren" }).click();

  if (SOLO) {
    // Erste Bot-Tafel mit normaler Denkpause festhalten, danach im Test schnell weiter.
    for (let i = 0; i < 30; i++) {
      const turn = await page.waitForFunction(
        () => {
          if (document.querySelector(".tafel__label")?.textContent?.includes("Computer")) return "bot";
          const idle = !document.querySelector('.tafel[aria-busy="true"]');
          return idle && document.querySelector(".tafel .tafel__actions .button:not(:disabled)") ? "anna" : false;
        },
        null,
        { timeout: 20_000, polling: 50 },
      );
      if ((await turn.jsonValue()) === "bot") break;
      await page.locator(".tafel .tafel__actions .button:not(:disabled)").first().click();
    }
    await page.screenshot({ path: path.join(outDir, "solo-bot-am-zug.png") });
    await page.evaluate((pause) => history.replaceState(null, "", `?botpause=${pause}`), BOT_PAUSE);
  }

  let steps = 0;
  let trades = 0;
  let offers = 0;
  let result = "kein Gewinner";
  while (steps < MAX_STEPS) {
    const state = await ready(page);
    // Solo: Angebot eines Computergegners an Anna (Bild beim ersten Mal).
    if (SOLO && state === "buttons" && (await page.locator(".tafel__label", { hasText: "Handelsangebot" }).count()) > 0) {
      if (offers === 0) await page.screenshot({ path: path.join(outDir, "solo-angebot.png") });
      offers++;
    }
    if (state === "end") {
      result = (await page.locator(".tafel__name").innerText()).trim();
      break;
    }
    steps++;
    if (steps === SNAPSHOT) await page.screenshot({ path: path.join(outDir, "playtest-mitten.png") });
    if ((await randomStep(page, state)).traded) trades++;
  }

  await page.screenshot({ path: path.join(outDir, "playtest-ende.png") });
  console.log(`Schritte: ${steps}, Handelsangebote: ${trades}, Ergebnis: ${result}`);
  const logLines = await page.locator(".log__text").count();
  console.log(`Protokollzeilen sichtbar: ${logLines}`);
  if (SOLO) {
    const texts = await page.locator(".log__text").allInnerTexts();
    const anna = texts.filter((t) => t.startsWith("Anna")).length;
    console.log(`Solo: ${BOTS} Computergegner, ${offers} Angebote von Bots an Anna, ${texts.length - anna} von ${texts.length} sichtbaren Zeilen ohne Anna am Satzanfang.`);
  }
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
