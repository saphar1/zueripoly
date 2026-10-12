// Screenshots des Designentwurfs (Desktop und Handy) mit Playwright.
// Start: npm run screenshots -w @zueripoly/client  →  Bilder im Ordner screenshots/ (Projektwurzel).
// Mit «-- --details» zusätzlich das Brett in vier Vierteln, doppelt aufgelöst, und die Interaktionszustände.
// Startet dafür selbst einen Vite-Server und beendet ihn danach wieder.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { createServer } from "vite";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.resolve(clientRoot, "../../screenshots");
const args = process.argv.slice(2);
const details = args.includes("--details");
const page = args.find((a) => !a.startsWith("--")) ?? "entwurf.html";
const name = path.basename(page, ".html");

const VIEWS = [
  { file: `${name}-desktop.png`, width: 1440, height: 900, scale: 1, mobile: false, fullPage: false },
  { file: `${name}-handy.png`, width: 390, height: 844, scale: 2, mobile: true, fullPage: false },
  { file: `${name}-handy-ganz.png`, width: 390, height: 844, scale: 2, mobile: true, fullPage: true },
];

/** Brett in vier Vierteln, Desktopgrösse mit doppelter Auflösung. */
async function saveBoardQuarters(browser: Browser, url: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "de-CH" });
  const tab = await context.newPage();
  await tab.goto(url, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const box = await tab.locator(".board").boundingBox();
  if (box) {
    const half = { width: box.width / 2, height: box.height / 2 };
    const quarters = [
      ["oben-links", box.x, box.y],
      ["oben-rechts", box.x + half.width, box.y],
      ["unten-links", box.x, box.y + half.height],
      ["unten-rechts", box.x + half.width, box.y + half.height],
    ] as const;
    for (const [label, x, y] of quarters) {
      const file = path.join(outDir, `${name}-detail-${label}.png`);
      await tab.screenshot({ path: file, clip: { x, y, ...half } });
      console.log(`Gespeichert: ${file}`);
    }
  }
  await context.close();
}

/** Interaktionszustände des Entwurfs: Zeiger auf Feld und Spieler, gezogene Karte, nach dem Würfeln. */
async function saveStates(browser: Browser, url: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "de-CH" });
  const tab = await context.newPage();
  await tab.goto(url, { waitUntil: "networkidle" });
  await tab.evaluate(() => document.fonts.ready);
  const shot = async (label: string) => {
    const file = path.join(outDir, `${name}-zustand-${label}.png`);
    await tab.screenshot({ path: file });
    console.log(`Gespeichert: ${file}`);
  };

  await tab.getByRole("button", { name: /^Langstrasse,/ }).hover();
  await tab.waitForTimeout(300);
  await shot("feld");

  await tab.getByRole("article", { name: "Ben" }).hover();
  await tab.waitForTimeout(300);
  await shot("spieler");

  await tab.mouse.move(5, 5);
  await tab.getByRole("button", { name: "Ereigniskarte ziehen" }).click();
  await tab.waitForTimeout(900);
  await shot("karte");

  await tab.keyboard.press("Escape");
  await tab.getByRole("button", { name: "Würfeln" }).click();
  await tab.waitForTimeout(3500);
  await shot("gewuerfelt");
  await context.close();
}

const server = await createServer({ root: clientRoot, logLevel: "warn", server: { port: 5199 } });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? "http://localhost:5199/";

const browser = await chromium.launch();
try {
  for (const view of VIEWS) {
    const context = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      deviceScaleFactor: view.scale,
      isMobile: view.mobile,
      hasTouch: view.mobile,
      locale: "de-CH",
    });
    const tab = await context.newPage();
    tab.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    });
    await tab.goto(new URL(page, base).href, { waitUntil: "networkidle" });
    await tab.evaluate(() => document.fonts.ready);
    const fonts = await tab.evaluate(() => ({
      display: document.fonts.check('700 16px "Bricolage Grotesque Variable"'),
      text: document.fonts.check('400 16px "Familjen Grotesk Variable"'),
    }));
    if (!fonts.display || !fonts.text) console.log("Warnung: Schriften nicht geladen", fonts);
    const file = path.join(outDir, view.file);
    await tab.screenshot({ path: file, fullPage: view.fullPage });
    console.log(`Gespeichert: ${file}`);
    await context.close();
  }
  if (details) {
    await saveBoardQuarters(browser, new URL(page, base).href);
    await saveStates(browser, new URL(page, base).href);
  }
} finally {
  await browser.close();
  await server.close();
}
