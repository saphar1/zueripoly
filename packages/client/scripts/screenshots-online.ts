// Screenshots des Online-Spiels (Desktop 1440×900 und Handy 390×844): Online-Start, Lobby (Host und Gast),
// Spiel aus Sicht der Wartenden, Störungsmeldung beim Host, Hinweis «Verbindung unterbrochen».
// Start: npm run screenshots -w @zueripoly/client -- --online  →  screenshots/online-*.png
// Startet dafür einen eigenen Spielserver (Abwesenheit schon nach 1 s) und einen Vite-Server.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, chromium } from "playwright";
import { createServer } from "vite";
import { startZueriServer } from "@zueripoly/server";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.resolve(clientRoot, "../../screenshots");

const game = await startZueriServer({ port: 0, log: false, timing: { absentMs: 1000 } });
process.env.ZUERIPOLY_SERVER = `http://localhost:${game.port}`;
const vite = await createServer({ root: clientRoot, logLevel: "warn", server: { port: 5197, strictPort: false } });
await vite.listen();
const base = vite.resolvedUrls?.local[0] ?? "http://localhost:5197/";

const VIEWS = [
  { suffix: "desktop", width: 1440, height: 900, scale: 1, mobile: false },
  { suffix: "handy", width: 390, height: 844, scale: 2, mobile: true },
] as const;

async function save(page: Page, name: string, fullPage = false): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`Gespeichert: ${file}`);
}

async function openWindow(browser: Browser, view: (typeof VIEWS)[number]): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.scale,
    isMobile: view.mobile,
    hasTouch: view.mobile,
    locale: "de-CH",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[Browser] ${msg.text()}`);
  });
  page.on("pageerror", (e) => console.log(`[Seitenfehler] ${e.message}`));
  return page;
}

const browser = await chromium.launch();
try {
  for (const view of VIEWS) {
    const s = view.suffix;
    const host = await openWindow(browser, view);
    const guest = await openWindow(browser, view);
    const third = await openWindow(browser, view);

    await host.goto(base, { waitUntil: "networkidle" });
    await host.getByRole("button", { name: /Online mit Freunden/ }).click();
    await host.getByLabel("Dein Name").fill("Anna");
    await save(host, `online-start-${s}`, view.mobile);
    await host.getByRole("button", { name: "Raum eröffnen" }).click();
    const code = (await host.locator(".room-code__value").innerText()).trim();

    for (const [page, name] of [
      [guest, "Ben"],
      [third, "Clara"],
    ] as const) {
      await page.goto(`${base}?raum=${code}`, { waitUntil: "networkidle" });
      await page.getByLabel("Dein Name").fill(name);
      await page.getByRole("button", { name: "Beitreten" }).click();
      await page.locator(".room-code").waitFor();
    }
    await guest.getByRole("button", { name: "Ich bin bereit" }).click();
    await host.getByRole("button", { name: "Computergegner dazu" }).click();
    await host.locator(".seat").nth(3).waitFor();
    await save(host, `online-lobby-host-${s}`, true);
    await save(third, `online-lobby-gast-${s}`, true);
    await third.getByRole("button", { name: "Ich bin bereit" }).click();
    await host.waitForFunction(() => !document.querySelector<HTMLButtonElement>(".lobby__start")?.disabled);
    await host.getByRole("button", { name: "Losfahren" }).click();
    await Promise.all([host, guest, third].map((p) => p.locator(".tafel").waitFor()));

    // Wer wartet, sieht einen Satz zur Lage statt Knöpfe.
    const watcher = await (async () => {
      for (const page of [host, guest, third]) {
        if ((await page.locator('.tafel[aria-busy="true"]').count()) > 0) return page;
      }
      return guest;
    })();
    await watcher.waitForTimeout(400);
    await save(watcher, `online-spiel-zuschauen-${s}`);

    // Clara trennt sich: alle sehen «Getrennt», der Host nach 1 s die Störungsmeldung.
    await third.context().close();
    await host.locator(".absent").waitFor({ timeout: 5000 });
    await host.locator(".absent").scrollIntoViewIfNeeded();
    await save(host, `online-stoerung-host-${s}`);
    await guest.locator(".absent").scrollIntoViewIfNeeded();
    await save(guest, `online-stoerung-gast-${s}`);

    // Eigene Verbindung weg: Hinweis oben.
    await guest.context().setOffline(true);
    await guest.locator(".connection").waitFor({ timeout: 30_000 });
    await guest.evaluate(() => window.scrollTo(0, 0));
    await save(guest, `online-verbindung-${s}`);

    await host.context().close();
    await guest.context().close();
  }
} finally {
  await browser.close();
  await vite.close();
  await game.close();
}
