// Liefert die gebaute Oberfläche (packages/client/dist) aus, damit Seite und Spiel unter einer Adresse
// laufen (gleiches WLAN, Render). Bewusst klein und ohne Bibliothek: nur GET/HEAD, nur Dateien
// innerhalb des Ordners, keine Ordnerlisten. Alles andere bekommt 404 oder 405.
import { createReadStream, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

/** Dateien in /assets/ tragen einen Hash im Namen (von Vite) und ändern sich nie. */
const IMMUTABLE = "public, max-age=31536000, immutable";
/** Alles andere (vor allem index.html) jedes Mal nachfragen, damit neue Versionen sofort ankommen. */
const REVALIDATE = "no-cache";

export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => void;

function send(res: ServerResponse, status: number, text: string, extra: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff", ...extra });
  res.end(text);
}

/** Pfad aus der Anfrage → Datei im Ordner, oder null, wenn er ausserhalb liegt oder ungültig ist. */
export function resolveRequestPath(rootDir: string, url: string): string | null {
  const pathname = url.split("?")[0]!.split("#")[0]!;
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  // Rückwärtsstriche (Windows) und Nullbytes nie zulassen; «..» als Pfadteil auch nicht.
  if (decoded.includes("\0") || decoded.includes("\\") || decoded.split("/").includes("..")) return null;
  const relative = decoded === "/" || decoded === "" ? "index.html" : decoded.replace(/^\/+/, "");
  const root = path.resolve(rootDir);
  const file = path.resolve(root, relative);
  return file.startsWith(root + path.sep) ? file : null;
}

export function createStaticHandler(rootDir: string): StaticHandler {
  return (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "Methode nicht erlaubt.\n", { allow: "GET, HEAD" });
      return;
    }
    const file = resolveRequestPath(rootDir, req.url ?? "/");
    const stats = file ? statSafe(file) : null;
    if (!file || !stats?.isFile()) {
      send(res, 404, "Nicht gefunden.\n");
      return;
    }
    const assets = path.join(path.resolve(rootDir), "assets") + path.sep;
    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "content-length": String(stats.size),
      "cache-control": file.startsWith(assets) ? IMMUTABLE : REVALIDATE,
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  };
}

function statSafe(file: string) {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}
