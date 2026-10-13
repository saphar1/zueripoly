// Welche Webseiten dürfen verbinden: die eigene Adresse, erlaubte fremde Seiten (GitHub Pages),
// Programme ohne Origin. Fremde Seiten werden abgelehnt, per Polling und per WebSocket.
import { io as connect } from "socket.io-client";
import { describe, expect, it } from "vitest";
import { normalizeOrigin, originAllowed, parseOrigins } from "../src/origin";
import { rawRequest, startServer, waitUntil } from "./helpers";

const PAGES = "https://anna.github.io";
const HANDSHAKE = "/socket.io/?EIO=4&transport=polling";

describe("Origin-Regeln", () => {
  it("vereinheitlicht und liest die Liste aus der Umgebungsvariable", () => {
    expect(normalizeOrigin(" HTTPS://Anna.GitHub.io/ ")).toBe(PAGES);
    expect(parseOrigins("https://anna.github.io/, https://zueripoly.ch,,")).toEqual([PAGES, "https://zueripoly.ch"]);
    expect(parseOrigins(undefined)).toEqual([]);
  });

  it("erlaubt ohne Origin, gleiche Adresse und Liste, sonst nicht", () => {
    expect(originAllowed(undefined, "localhost:3001", [])).toBe(true);
    expect(originAllowed("http://192.168.1.23:3001", "192.168.1.23:3001", [])).toBe(true);
    expect(originAllowed("https://zueripoly.onrender.com", "zueripoly.onrender.com", [])).toBe(true);
    expect(originAllowed("https://anna.github.io", "zueripoly.onrender.com", [PAGES])).toBe(true);
    expect(originAllowed("https://anna.github.io.evil.example", "zueripoly.onrender.com", [PAGES])).toBe(false);
    expect(originAllowed("https://evil.example", "zueripoly.onrender.com", [PAGES])).toBe(false);
    expect(originAllowed("null", "localhost:3001", [])).toBe(false);
    expect(originAllowed("http://localhost:5173", undefined, [])).toBe(false);
  });
});

describe("Verbindungen von Webseiten", () => {
  it("erlaubte Seite: Polling mit CORS-Kopfzeile", async () => {
    const server = await startServer({ allowedOrigins: [`${PAGES}/`] });
    const res = await rawRequest(server.port, HANDSHAKE, "GET", { origin: PAGES });
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(PAGES);
  });

  it("gleiche Adresse und ohne Origin: erlaubt", async () => {
    const server = await startServer();
    const same = await rawRequest(server.port, HANDSHAKE, "GET", { origin: `http://127.0.0.1:${server.port}` });
    expect(same.status).toBe(200);
    const none = await rawRequest(server.port, HANDSHAKE);
    expect(none.status).toBe(200);
  });

  it("fremde Seite: Polling abgelehnt", async () => {
    const server = await startServer({ allowedOrigins: [PAGES] });
    const res = await rawRequest(server.port, HANDSHAKE, "GET", { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("WebSocket: erlaubte Seite verbindet, fremde nicht", async () => {
    const server = await startServer({ allowedOrigins: [PAGES] });
    const url = `http://localhost:${server.port}`;
    const options = { transports: ["websocket"], forceNew: true, reconnection: false };

    const friend = connect(url, { ...options, extraHeaders: { origin: PAGES } });
    await waitUntil(() => friend.connected, "Verbindung der erlaubten Seite");
    friend.disconnect();

    const stranger = connect(url, { ...options, extraHeaders: { origin: "https://evil.example" } });
    let refused = false;
    stranger.on("connect_error", () => (refused = true));
    await waitUntil(() => refused, "Ablehnung der fremden Seite");
    expect(stranger.connected).toBe(false);
    stranger.disconnect();
  });
});
