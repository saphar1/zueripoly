// Der Server liefert die gebaute Oberfläche aus (npm start, Render): richtige Dateien, richtige
// Kopfzeilen, nichts ausserhalb des Ordners.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawRequest, startServer, TestClient } from "./helpers";

const INDEX = "<!doctype html><title>ZüriPoly</title>";
const SCRIPT = "console.log('ZüriPoly');";
const SECRET = "geheim";
let base = "";
let dist = "";

beforeAll(() => {
  // Ordner wie nach «npm run build», daneben eine Datei, die nie ausgeliefert werden darf.
  base = mkdtempSync(path.join(tmpdir(), "zueripoly-static-"));
  dist = path.join(base, "dist");
  mkdirSync(path.join(dist, "assets"), { recursive: true });
  writeFileSync(path.join(dist, "index.html"), INDEX);
  writeFileSync(path.join(dist, "assets", "app-abc123.js"), SCRIPT);
  writeFileSync(path.join(dist, "assets", "font-x1.woff2"), "woff2");
  writeFileSync(path.join(base, "secret.txt"), SECRET);
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("Oberfläche ausliefern", () => {
  it("liefert index.html für / und für den Raumlink, ohne Zwischenspeichern", async () => {
    const server = await startServer({ clientDir: dist });
    for (const pathname of ["/", "/?raum=K7MP4", "/index.html"]) {
      const res = await rawRequest(server.port, pathname);
      expect(res.status).toBe(200);
      expect(res.body).toBe(INDEX);
      expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(res.headers["cache-control"]).toBe("no-cache");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    }
  });

  it("liefert Dateien aus /assets mit Typ und langem Zwischenspeichern", async () => {
    const server = await startServer({ clientDir: dist });
    const script = await rawRequest(server.port, "/assets/app-abc123.js");
    expect(script.status).toBe(200);
    expect(script.body).toBe(SCRIPT);
    expect(script.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(script.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    const font = await rawRequest(server.port, "/assets/font-x1.woff2");
    expect(font.headers["content-type"]).toBe("font/woff2");
  });

  it("HEAD ohne Inhalt, andere Methoden abgelehnt", async () => {
    const server = await startServer({ clientDir: dist });
    const head = await rawRequest(server.port, "/", "HEAD");
    expect(head.status).toBe(200);
    expect(head.body).toBe("");
    expect(head.headers["content-length"]).toBe(String(Buffer.byteLength(INDEX)));
    const post = await rawRequest(server.port, "/", "POST");
    expect(post.status).toBe(405);
    expect(post.headers.allow).toBe("GET, HEAD");
  });

  it("unbekannte Dateien und Ordner: 404", async () => {
    const server = await startServer({ clientDir: dist });
    for (const pathname of ["/fehlt.js", "/assets", "/assets/", "/entwurf.html"]) {
      const res = await rawRequest(server.port, pathname);
      expect(res.status, pathname).toBe(404);
    }
  });

  it("nichts ausserhalb des Ordners", async () => {
    const server = await startServer({ clientDir: dist });
    const attempts = [
      "/../secret.txt",
      "/assets/../../secret.txt",
      "/%2e%2e/secret.txt",
      "/%2E%2E%2Fsecret.txt",
      "/assets/..%2f..%2fsecret.txt",
      "/..%5csecret.txt",
      "/assets%5c..%5c..%5csecret.txt",
      "/index.html%00.js",
      "/%",
    ];
    for (const pathname of attempts) {
      const res = await rawRequest(server.port, pathname);
      expect(res.status, pathname).toBe(404);
      expect(res.body).not.toContain(SECRET);
    }
  });

  it("/healthz antwortet immer, auch ohne Oberfläche", async () => {
    const withClient = await startServer({ clientDir: dist });
    expect((await rawRequest(withClient.port, "/healthz")).body).toBe("ok\n");
    const without = await startServer();
    const res = await rawRequest(without.port, "/healthz");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("ohne Oberfläche: kurzer Text wie bisher", async () => {
    const server = await startServer();
    const res = await rawRequest(server.port, "/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("ZüriPoly-Server läuft");
  });

  it("das Spiel über /socket.io läuft daneben weiter", async () => {
    const server = await startServer({ clientDir: dist });
    const client = await TestClient.connect(server.port);
    const grant = await client.create("Anna");
    expect(grant.code).toHaveLength(5);
  });
});
