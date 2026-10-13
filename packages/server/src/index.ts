// Server-Einstieg: startet den Spielserver. Der Server ist die einzige Wahrheit über den Spielstand.
// - npm start (im Projektordner): baut die Oberfläche und startet den Server, der dann alles unter
//   einer Adresse ausliefert, auch für andere Geräte im gleichen WLAN.
// - npm run dev: nur Spielserver (mit --dev), die Seite kommt von Vite (http://localhost:5173).
// Umgebungsvariablen: PORT (Standard 3001), ZUERIPOLY_CLIENT_DIR (Ordner der gebauten Oberfläche),
// ZUERIPOLY_ORIGINS (fremde Seiten, die verbinden dürfen, mit Komma getrennt, z. B. die GitHub-Pages-Adresse).
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_VERSION } from "@zueripoly/engine";
import { lanAddresses, routeAddress } from "./lan";
import { parseOrigins } from "./origin";
import { SERVER_PORT } from "./protocol";
import { startZueriServer } from "./server";

const port = Number(process.env.PORT ?? SERVER_PORT);
const dev = process.argv.includes("--dev");
const clientDir = path.resolve(process.env.ZUERIPOLY_CLIENT_DIR ?? fileURLToPath(new URL("../../client/dist", import.meta.url)));
const built = !dev && existsSync(path.join(clientDir, "index.html"));
const allowedOrigins = parseOrigins(process.env.ZUERIPOLY_ORIGINS);

try {
  const server = await startZueriServer({ port, clientDir: built ? clientDir : undefined, allowedOrigins });
  console.log(`ZüriPoly-Server läuft auf Port ${server.port} (Engine ${ENGINE_VERSION}).`);
  if (dev) {
    console.log("Im Browser spielen: http://localhost:5173 (Vite, startet mit npm run dev).");
  } else if (built) {
    const [lan, ...others] = lanAddresses(networkInterfaces(), server.port, await routeAddress());
    console.log("Spiel öffnen:");
    console.log(`  Auf diesem PC:     http://localhost:${server.port}`);
    if (lan) console.log(`  Im gleichen WLAN:  ${lan}`);
    else console.log("  Im gleichen WLAN:  keine Adresse gefunden (ist der PC mit einem WLAN verbunden?)");
    if (others.length > 0) console.log(`  Falls das nicht geht, andere Adapter: ${others.join(", ")}`);
  } else {
    console.log(`Die Oberfläche ist noch nicht gebaut (${clientDir} fehlt). Im Projektordner: npm start`);
  }
  if (allowedOrigins.length > 0) console.log(`Erlaubte fremde Seiten: ${allowedOrigins.join(", ")}`);

  const stop = () => {
    console.log("Server wird beendet …");
    void server.close().then(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.error(`Port ${port} ist schon belegt. Läuft der Server bereits in einem anderen Fenster? Dort mit Ctrl+C beenden.`);
  } else {
    console.error("Der Server konnte nicht starten:", error);
  }
  process.exit(1);
}
