// Hinweis oben auf der Seite, solange die Verbindung zum Spielserver fehlt.
// Socket.IO verbindet von selbst neu; danach meldet sich der Browser wieder auf seinem Platz an.
import type { ConnectionStatus } from "../online/connection";
import "./ConnectionBanner.css";

export function ConnectionBanner({ status, restoring = false }: { status: ConnectionStatus; restoring?: boolean }) {
  if (restoring) {
    return (
      <p className="connection" role="status">
        <strong>Der Spielserver wurde neu gestartet.</strong> Der Raum wird aus dem gespeicherten Spielstand wiederhergestellt …
      </p>
    );
  }
  if (status === "online") return null;
  return (
    <p className="connection" role="status">
      <strong>Verbindung unterbrochen.</strong> ZüriPoly verbindet neu, dein Platz bleibt reserviert.
    </p>
  );
}
