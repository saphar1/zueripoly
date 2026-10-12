import { describe, expect, it } from "vitest";
import { cleanName, parseAction, parseOptions } from "../src/parse";
import { TokenBucket } from "../src/rate-limit";
import { normalizeRoomCode } from "../src/room-code";
import { TestClient, expectError, setupRoom, sleep, startGame, startServer, waitUntil, waitingClient } from "./helpers";

describe("Eingänge prüfen (ohne Netz)", () => {
  it("Aktionen werden neu gebaut: nur bekannte Felder, richtige Typen", () => {
    expect(parseAction({ type: "rollDice", dice: [6, 6], extra: "x" })).toEqual({ type: "rollDice" });
    expect(parseAction({ type: "buildHouse", space: 39 })).toEqual({ type: "buildHouse", space: 39 });
    expect(parseAction({ type: "buildHouse", space: 40 })).toBeNull();
    expect(parseAction({ type: "buildHouse", space: 1.5 })).toBeNull();
    expect(parseAction({ type: "bid", amount: -10 })).toBeNull();
    expect(parseAction({ type: "bid", amount: "100" })).toBeNull();
    expect(parseAction({ type: "timeout" })).toBeNull();
    expect(parseAction({ type: "toString" })).toBeNull();
    expect(parseAction({ type: "__proto__" })).toBeNull();
    expect(parseAction(null)).toBeNull();
    expect(parseAction([{ type: "rollDice" }])).toBeNull();
    expect(parseAction("rollDice")).toBeNull();
    expect(parseAction({ type: "acceptTrade" })).toEqual({ type: "acceptTrade", lift: [] });
    expect(parseAction({ type: "resolveMortgages", lift: [1, 1] })).toBeNull();
    const trade = parseAction({
      type: "proposeTrade",
      offer: { to: "p2", give: { spaces: [1], money: 0, jailCards: [], hack: 1 }, take: { spaces: [], money: 50, jailCards: ["E08"] }, x: 2 },
    });
    expect(trade).toEqual({
      type: "proposeTrade",
      offer: { to: "p2", give: { spaces: [1], money: 0, jailCards: [] }, take: { spaces: [], money: 50, jailCards: ["E08"] }, lift: [] },
    });
    expect(parseAction({ type: "proposeTrade", offer: { to: "p2", give: { spaces: "1", money: 0, jailCards: [] }, take: {} } })).toBeNull();
  });

  it("gefährliche Schlüssel wie «__proto__» verschmutzen nichts", () => {
    const evil = JSON.parse('{"type":"rollDice","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
    expect(parseAction(evil)).toEqual({ type: "rollDice" });
    expect(parseOptions(JSON.parse('{"__proto__":{"polluted":true},"jackpot":true}'))).toEqual({ jackpot: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("Namen: Steuer- und Richtungszeichen weg, Leerraum zusammengefasst, höchstens 16 Zeichen", () => {
    expect(cleanName("  Anna  ")).toBe("Anna");
    expect(cleanName("‮anna​")).toBe("anna");
    expect(cleanName("A\nn\tn\u0007a")).toBe("Anna");
    expect(cleanName("<script>alert(1)</script>")).toBe("<script>alert(1)");
    expect(cleanName("Zoë Müller-Lüdenscheid")).toBe("Zoë Müller-Lüden");
    expect(cleanName("\u0000\u0001")).toBeNull();
    expect(cleanName("")).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName("x".repeat(10_000))).toBeNull();
  });

  it("Raumcodes: Grossbuchstaben, ohne Leerzeichen und Bindestriche, nur erlaubte Zeichen", () => {
    expect(normalizeRoomCode(" k7m-p4 ")).toBe("K7MP4");
    expect(normalizeRoomCode("ac-def")).toBe("ACDEF");
    expect(normalizeRoomCode("AC DE F")).toBe("ACDEF");
    expect(normalizeRoomCode("AB0O1")).toBeNull();
    expect(normalizeRoomCode("ACDEFG")).toBeNull();
    expect(normalizeRoomCode({})).toBeNull();
  });

  it("Flutbremse: Vorrat aufgebraucht → abgelehnt, mit der Zeit wieder frei", () => {
    let now = 0;
    const bucket = new TokenBucket(3, 2, () => now);
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, true, false]);
    now = 500; // eine Marke nachgefüllt
    expect([bucket.take(), bucket.take()]).toEqual([true, false]);
  });
});

describe("Robustheit des Servers", () => {
  it("kaputte und unerwartete Nachrichten werden abgelehnt, der Server läuft weiter", async () => {
    const server = await startServer();
    const client = await TestClient.connect(server.port);
    for (const data of [null, 42, "Anna", [], { name: {} }, { name: "x".repeat(5000) }, { name: "" }]) {
      expect(expectError(await client.request("room:create", data))).toBeTruthy();
    }
    expect(expectError(await client.request("game:action", { action: { type: "rollDice" } }))).toContain("in keinem Raum");
    expect(expectError(await client.request("lobby:options", "viel Geld"))).toContain("Ungültige Optionen");
    // Unbekannte Nachricht mit und ohne Antwortwunsch
    const unknown = (await client.socket.timeout(2000).emitWithAck("hack:server", { evil: true })) as { ok: boolean; error: string };
    expect(unknown).toEqual({ ok: false, error: "Unbekannte Nachricht." });
    client.socket.emit("room:create", { name: "ohne Antwort" });
    client.socket.emit("game:action");
    client.socket.emit("lobby:seat", null, null, null);
    // __proto__ übers Netz
    const evil = JSON.parse('{"name":"Eve","__proto__":{"polluted":true}}');
    expect((await client.request("room:create", evil)).ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // Der Server lebt: Ein anderer Browser kann normal spielen.
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame(players);
    expect((await waitingClient(players).request("game:action", { action: { type: "rollDice" } })).ok).toBe(true);
  });

  it("zu grosse Nachrichten trennen nur diese Verbindung", async () => {
    const server = await startServer();
    const client = await TestClient.connect(server.port);
    client.socket.emit("room:create", { name: "A", padding: "x".repeat(64 * 1024) });
    await waitUntil(() => !client.socket.connected, "Verbindung getrennt", 3000);
    const other = await TestClient.connect(server.port);
    expect((await other.create("Ben")).seatId).toBe("p1");
  });

  it("Nachrichtenflut: Begrenzung greift, Dauerflut trennt die Verbindung, andere spielen weiter", async () => {
    const server = await startServer({ rateLimit: { capacity: 20, perSecond: 10 } });
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame(players);
    const [anna, ben] = players as [TestClient, TestClient];
    const replies = await Promise.allSettled(
      Array.from({ length: 30 }, () => ben.request("game:action", { action: { type: "endTurn" } })),
    );
    const errors = replies.flatMap((r) => (r.status === "fulfilled" && !r.value.ok ? [r.value.error] : []));
    expect(errors.filter((e) => e.includes("Zu viele Nachrichten")).length).toBeGreaterThan(0);
    // Weiterfluten → Verbindung wird getrennt.
    for (let i = 0; i < 80; i++) ben.socket.emit("game:sync", {});
    await waitUntil(() => !ben.socket.connected, "Flut getrennt", 3000);
    // Anna spielt weiter (eigene Begrenzung, eigener Vorrat).
    await sleep(50);
    expect((await anna.request("game:sync", {})).ok).toBe(true);
    await waitUntil(() => anna.room?.seats.find((s) => s.id === ben.me)?.connected === false, "Ben als getrennt angezeigt");
  });

  it("Namen werden gesäubert und gekürzt angezeigt, auch beim Umbenennen", async () => {
    const server = await startServer();
    const [anna, ben] = await setupRoom(server.port, ["Anna", "Ben"]);
    expect((await ben!.request("lobby:seat", { name: "‮<b>Benjamin</b>\u0000 von und zu Zürich" })).ok).toBe(true);
    await waitUntil(() => anna!.room?.seats[1]?.name !== "Ben", "Umbenennung sichtbar");
    expect(anna!.room?.seats[1]?.name).toBe("<b>Benjamin</b>");
    expect(expectError(await ben!.request("lobby:seat", { name: "anna" }))).toContain("gibt es in diesem Raum schon");
    expect(expectError(await ben!.request("lobby:seat", { name: 7 }))).toContain("Namen");
  });
});
