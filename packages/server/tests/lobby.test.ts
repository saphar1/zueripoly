import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET } from "../src/protocol";
import { TestClient, expectError, setupRoom, startGame, startServer, waitUntil } from "./helpers";

describe("Räume", () => {
  it("Raum erstellen: Code mit 5 gut lesbaren Zeichen, wer eröffnet, ist Host", async () => {
    const server = await startServer();
    const host = await TestClient.connect(server.port);
    const grant = await host.create("Anna");
    expect(grant.code).toMatch(new RegExp(`^[${ROOM_CODE_ALPHABET}]{5}$`));
    expect(grant.code).not.toMatch(/[0O1IL]/);
    expect(grant.seatKey.length).toBeGreaterThanOrEqual(20);
    expect(host.room).toMatchObject({ code: grant.code, phase: "lobby", hostId: grant.seatId, you: grant.seatId });
    expect(host.room?.seats).toEqual([
      expect.objectContaining({ id: "p1", name: "Anna", token: "tram", bot: null, connected: true, ready: false }),
    ]);
    // Der Schlüssel zum Wiederverbinden geht nie an andere.
    expect(JSON.stringify(host.room)).not.toContain(grant.seatKey);
  });

  it("Beitreten per Code, auch klein geschrieben und mit Leerzeichen oder Bindestrich", async () => {
    const server = await startServer();
    const host = await TestClient.connect(server.port);
    const { code } = await host.create("Anna");
    const ben = await TestClient.connect(server.port);
    await ben.join(` ${code.slice(0, 2).toLowerCase()}-${code.slice(2)} `, "Ben");
    expect(ben.grant?.seatId).toBe("p2");
    await waitUntil(() => host.room?.seats.length === 2, "Ben bei Anna sichtbar");
    expect(host.room?.seats.map((s) => [s.name, s.token])).toEqual([
      ["Anna", "tram"],
      ["Ben", "swan"],
    ]);
  });

  it("falscher oder kaputter Code wird abgelehnt", async () => {
    const server = await startServer();
    const client = await TestClient.connect(server.port);
    expect(expectError(await client.request("room:join", { code: "ACDEF", name: "Ben" }))).toContain("gibt es nicht");
    expect(expectError(await client.request("room:join", { code: "AB0O1", name: "Ben" }))).toContain("5 Zeichen");
    expect(expectError(await client.request("room:join", { code: 12345, name: "Ben" }))).toContain("5 Zeichen");
  });

  it("höchstens 6 Plätze: die 7. Person wird abgelehnt", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben", "Clara", "Dario", "Elif", "Fabio"]);
    expect(new Set(players[0]!.room!.seats.map((s) => s.token)).size).toBe(6);
    const late = await TestClient.connect(server.port);
    expect(expectError(await late.request("room:join", { code: players[0]!.grant!.code, name: "Gina" }))).toContain("voll");
    expect(expectError(await players[0]!.request("lobby:addBot", { level: "easy" }))).toContain("voll");
  });

  it("Namen: eindeutig im Raum, gesäubert und gekürzt", async () => {
    const server = await startServer();
    const host = await TestClient.connect(server.port);
    const { code } = await host.create("Anna");
    const twin = await TestClient.connect(server.port);
    expect(expectError(await twin.request("room:join", { code, name: "ANNA" }))).toContain("gibt es in diesem Raum schon");
    expect(expectError(await twin.request("room:join", { code, name: "   " }))).toContain("Namen");
    await twin.join(code, "‮ben\u0000 \t  der   Grosse mit sehr langem Namen");
    const name = twin.room!.seats.find((s) => s.id === twin.me)!.name;
    expect(name).toBe("ben der Grosse m");
    expect(Array.from(name).length).toBeLessThanOrEqual(16);
  });

  it("Figuren: jede nur einmal; Wechsel sehen alle", async () => {
    const server = await startServer();
    const [anna, ben] = await setupRoom(server.port, ["Anna", "Ben"]);
    expect(expectError(await ben!.request("lobby:seat", { token: "tram" }))).toContain("Figur");
    expect(expectError(await ben!.request("lobby:seat", { token: "rakete" }))).toContain("Unbekannte Figur");
    expect((await ben!.request("lobby:seat", { token: "bike" })).ok).toBe(true);
    await waitUntil(() => anna!.room?.seats[1]?.token === "bike", "Figurwechsel bei Anna");
  });

  it("nur der Host stellt Optionen ein, füllt mit Bots und startet; Start erst, wenn alle bereit sind", async () => {
    const server = await startServer();
    const host = await TestClient.connect(server.port);
    const { code } = await host.create("Anna");
    const ben = await TestClient.connect(server.port);
    await ben.join(code, "Ben");

    expect(expectError(await ben.request("lobby:options", { startMoney: 2000 }))).toContain("Host");
    expect(expectError(await ben.request("lobby:addBot", { level: "easy" }))).toContain("Host");
    expect(expectError(await ben.request("lobby:start", {}))).toContain("Host");
    expect(expectError(await host.request("lobby:options", { startMoney: 2050 }))).toContain("Ungültige Optionen");
    expect(expectError(await host.request("lobby:options", { turnTimeLimit: 45 }))).toContain("Ungültige Optionen");

    expect((await host.request("lobby:options", { startMoney: 2000, jackpot: true, turnTimeLimit: 60 })).ok).toBe(true);
    await waitUntil(() => ben.room?.options.startMoney === 2000, "Optionen bei Ben");
    expect(ben.room?.options).toEqual({ startMoney: 2000, jackpot: true, turnTimeLimit: 60 });

    expect((await host.request("lobby:addBot", { level: "clever" })).ok).toBe(true);
    expect((await host.request("lobby:addBot", { level: "easy" })).ok).toBe(true);
    await waitUntil(() => ben.room?.seats.length === 4, "Bots bei Ben");
    const bots = ben.room!.seats.filter((s) => s.bot !== null);
    expect(bots.map((s) => s.bot)).toEqual(["clever", "easy"]);
    expect(bots.every((s) => s.ready && s.connected)).toBe(true);
    expect((await host.request("lobby:botLevel", { seatId: bots[1]!.id, level: "clever" })).ok).toBe(true);

    expect(expectError(await host.request("lobby:start", {}))).toContain("Noch nicht bereit: Ben");
    expect((await ben.request("lobby:seat", { ready: true })).ok).toBe(true);
    await startGame([host, ben]);
    expect(host.room?.phase).toBe("game");
    const state = ben.state!;
    expect(state.players).toHaveLength(4);
    expect(state.options).toEqual({ startMoney: 2000, jackpot: true, turnTimeLimit: 60 });
    expect(state.players.filter((p) => p.bot).map((p) => p.bot)).toEqual(["clever", "clever"]);
    expect(ben.updates[0]?.sync).toBe(true);
  });

  it("Host kann Plätze entfernen (Bots und Menschen), sich selbst nicht", async () => {
    const server = await startServer();
    const [anna, ben] = await setupRoom(server.port, ["Anna", "Ben"]);
    await anna!.request("lobby:addBot", { level: "easy" });
    await waitUntil(() => anna!.room?.seats.length === 3, "Bot da");
    const bot = anna!.room!.seats.find((s) => s.bot)!;
    expect(expectError(await ben!.request("lobby:removeSeat", { seatId: bot.id }))).toContain("Host");
    expect(expectError(await anna!.request("lobby:removeSeat", { seatId: anna!.me }))).toContain("eigenen Platz");
    expect((await anna!.request("lobby:removeSeat", { seatId: bot.id })).ok).toBe(true);
    expect((await anna!.request("lobby:removeSeat", { seatId: ben!.me })).ok).toBe(true);
    await waitUntil(() => ben!.closedReason !== null, "Ben erfährt es");
    expect(ben!.closedReason).toContain("aus dem Raum genommen");
    expect(anna!.room?.seats.map((s) => s.name)).toEqual(["Anna"]);
    expect(expectError(await ben!.request("lobby:seat", { ready: false }))).toContain("in keinem Raum");
  });

  it("verlässt der Host die Lobby, wird der Nächste Host; verlassen alle, verschwindet der Raum", async () => {
    const server = await startServer();
    const [anna, ben, clara] = await setupRoom(server.port, ["Anna", "Ben", "Clara"]);
    expect((await anna!.request("room:leave", {})).ok).toBe(true);
    await waitUntil(() => ben!.room?.seats.length === 2, "Anna weg");
    expect(ben!.room?.hostId).toBe(ben!.me);
    expect(clara!.room?.hostId).toBe(ben!.me);
    await ben!.request("room:leave", {});
    await clara!.request("room:leave", {});
    expect(server.registry.roomCount).toBe(0);
  });

  it("in ein laufendes Spiel kann niemand neu beitreten", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame(players);
    const late = await TestClient.connect(server.port);
    expect(expectError(await late.request("room:join", { code: players[0]!.grant!.code, name: "Clara" }))).toContain("läuft schon");
    expect(expectError(await players[1]!.request("lobby:seat", { token: "bike" }))).toContain("nur in der Lobby");
  });
});
