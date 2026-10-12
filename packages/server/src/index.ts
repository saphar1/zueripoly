// Server-Einstieg: startet den Spielserver. Der Server ist die einzige Wahrheit über den Spielstand.
// Start: npm run dev -w @zueripoly/server  (Port 3001, mit der Umgebungsvariable PORT änderbar)
import { ENGINE_VERSION } from "@zueripoly/engine";
import { SERVER_PORT } from "./protocol";
import { startZueriServer } from "./server";

const port = Number(process.env.PORT ?? SERVER_PORT);

try {
  const server = await startZueriServer({ port });
  console.log(`ZüriPoly-Server läuft auf Port ${server.port} (Engine ${ENGINE_VERSION}).`);
  console.log("Im Browser spielen: Client starten (npm run dev) und http://localhost:5173 öffnen.");

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
