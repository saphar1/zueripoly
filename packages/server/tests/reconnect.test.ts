import { describe, expect, it } from "vitest";
import { getWaitingFor } from "@zueripoly/engine";
import { TestClient, expectError, setupRoom, sleep, startGame, startServer, waitUntil, waitingClient } from "./helpers";

const seatOf = (client: TestClient, id: string) => client.room?.seats.find((s) => s.id === id);

describe("Verbindungsabbruch und Wiederverbinden", () => {
  it("getrennt wird allen angezeigt; mit dem Schlüssel zurück auf den alten Platz mit vollem Stand", async () => {
    const server = await startServer();
    const [anna, ben] = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame([anna!, ben!]);
    await waitingClient([anna!, ben!]).request("game:action", { action: { type: "rollDice" } });
    await waitUntil(() => anna!.seq === 2 && ben!.seq === 2, "Stand 2");

    const grant = ben!.grant!;
    ben!.close();
    await waitUntil(() => seatOf(anna!, grant.seatId)?.connected === false, "Ben getrennt");
    expect(seatOf(anna!, grant.seatId)?.awayMs).toEqual(expect.any(Number));

    const back = await TestClient.connect(server.port);
    const reply = await back.resume(grant);
    expect(reply).toMatchObject({ ok: true, seatId: grant.seatId, code: grant.code });
    await waitUntil(() => back.state !== null, "Vollstand nach dem Wiederverbinden");
    expect(back.updates[0]).toMatchObject({ sync: true, seq: 2, events: [] });
    expect(JSON.stringify(back.state)).toBe(JSON.stringify(anna!.state));
    expect(back.room?.you).toBe(grant.seatId);
    await waitUntil(() => seatOf(anna!, grant.seatId)?.connected === true, "Ben wieder verbunden");
    expect(seatOf(anna!, grant.seatId)?.awayMs).toBeNull();
  });

  it("falscher Schlüssel oder falscher Raum: abgelehnt", async () => {
    const server = await startServer();
    const [anna] = await setupRoom(server.port, ["Anna", "Ben"]);
    const thief = await TestClient.connect(server.port);
    expect(expectError(await thief.resume({ code: anna!.grant!.code, seatKey: "x".repeat(24), seatId: "p1" }))).toContain("gibt es nicht mehr");
    expect(expectError(await thief.resume({ code: "ACDEF", seatKey: anna!.grant!.seatKey, seatId: "p1" }))).toContain("gibt es nicht mehr");
    expect(expectError(await thief.request("room:resume", { code: anna!.grant!.code, seatKey: 42 }))).toBe("Ungültige Anfrage.");
  });

  it("derselbe Platz in einem zweiten Fenster: das erste wird abgemeldet", async () => {
    const server = await startServer();
    const [anna, ben] = await setupRoom(server.port, ["Anna", "Ben"]);
    const second = await TestClient.connect(server.port);
    expect((await second.resume(ben!.grant!)).ok).toBe(true);
    await waitUntil(() => ben!.closedReason !== null, "erstes Fenster abgemeldet");
    expect(ben!.closedReason).toContain("anderen Fenster");
    expect(seatOf(anna!, ben!.me)?.connected).toBe(true);
    expect(expectError(await ben!.request("lobby:seat", { ready: false }))).toContain("in keinem Raum");
  });

  it("Wiederverbinden geht auch in der Lobby", async () => {
    const server = await startServer();
    const [anna, ben] = await setupRoom(server.port, ["Anna", "Ben"]);
    ben!.close();
    await waitUntil(() => seatOf(anna!, ben!.me)?.connected === false, "Ben getrennt");
    expect(expectError(await anna!.request("lobby:start", {}))).toContain("nicht verbunden");
    const back = await TestClient.connect(server.port);
    expect((await back.resume(ben!.grant!)).ok).toBe(true);
    await waitUntil(() => seatOf(anna!, ben!.me)?.connected === true, "Ben zurück");
    expect((await anna!.request("lobby:start", {})).ok).toBe(true);
  });
});

describe("Host entscheidet, wenn jemand länger weg ist", () => {
  async function gameWithAbsentBen() {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben", "Clara"]);
    await startGame(players);
    const [anna, ben, clara] = players as [TestClient, TestClient, TestClient];
    const benId = ben.me;
    ben.close();
    await waitUntil(() => seatOf(anna, benId)?.connected === false, "Ben getrennt");
    expect(seatOf(anna, benId)?.needsDecision).toBe(false);
    await waitUntil(() => seatOf(anna, benId)?.needsDecision === true, "Host soll entscheiden", 2000);
    return { server, anna, ben, clara, benId };
  }

  it("warten: Meldung verschwindet und kommt nach der Frist wieder", async () => {
    const { anna, clara, benId } = await gameWithAbsentBen();
    expect(expectError(await clara.request("game:absent", { seatId: benId, decision: "wait" }))).toContain("Host");
    expect((await anna.request("game:absent", { seatId: benId, decision: "wait" })).ok).toBe(true);
    await waitUntil(() => seatOf(anna, benId)?.needsDecision === false, "Meldung weg");
    await waitUntil(() => seatOf(anna, benId)?.needsDecision === true, "Meldung wieder da", 2000);
  });

  it("Computer übernimmt: zieht für den Abwesenden und gibt bei der Rückkehr ab", async () => {
    const { server, anna, ben, clara, benId } = await gameWithAbsentBen();
    expect((await anna.request("game:absent", { seatId: benId, decision: "bot" })).ok).toBe(true);
    await waitUntil(() => seatOf(clara, benId)?.standIn === "clever", "Vertretung sichtbar");
    anna.autoplay("easy");
    clara.autoplay("easy");
    await waitUntil(
      () => anna.updates.some((u) => u.events.some((e) => e.type === "diceRolled" && e.player === benId)),
      "Computer würfelt für Ben",
      10_000,
    );
    anna.stopAutoplay();
    clara.stopAutoplay();

    const back = await TestClient.connect(server.port);
    expect((await back.resume(ben.grant!)).ok).toBe(true);
    await waitUntil(() => seatOf(anna, benId)?.standIn === null && seatOf(anna, benId)?.connected === true, "Ben spielt wieder selbst");
    // Ab jetzt zieht für Ben niemand mehr automatisch: Wartet das Spiel auf Ben, bleibt es stehen.
    back.autoplay("easy", (state) => getWaitingFor(state) === benId);
    anna.autoplay("easy", (state) => getWaitingFor(state) === benId);
    clara.autoplay("easy", (state) => getWaitingFor(state) === benId);
    await waitUntil(() => back.state !== null && getWaitingFor(back.state) === benId, "Ben ist wieder dran", 10_000);
    const seq = back.seq;
    await sleep(300);
    expect(back.seq).toBe(seq);
  }, 20_000);

  it("aus dem Spiel nehmen: Ben scheidet aus, das Spiel läuft ohne ihn weiter", async () => {
    const { anna, clara, benId } = await gameWithAbsentBen();
    expect((await anna.request("game:absent", { seatId: benId, decision: "remove" })).ok).toBe(true);
    await waitUntil(() => anna.state?.players.find((p) => p.id === benId)?.bankrupt === true, "Ben ausgeschieden");
    expect(anna.updates.at(-1)!.events[0]).toEqual({ type: "playerRemoved", player: benId });
    expect(seatOf(anna, benId)?.needsDecision).toBe(false);
    expect(expectError(await anna.request("game:absent", { seatId: benId, decision: "bot" }))).toContain("ausgeschieden");
    anna.autoplay("easy", (s) => s.turnNumber >= 6);
    clara.autoplay("easy", (s) => s.turnNumber >= 6);
    await waitUntil(() => (anna.state?.turnNumber ?? 0) >= 6 || anna.state?.winner !== null, "Spiel läuft weiter", 10_000);
  }, 15_000);

  it("verbundene Spieler kann der Host nicht entfernen", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame(players);
    expect(expectError(await players[0]!.request("game:absent", { seatId: players[1]!.me, decision: "remove" }))).toContain("wieder verbunden");
  });

  it("ist der Host länger weg, wird ein verbundener Spieler Host; kommt er zurück, bleibt es so", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben", "Clara"]);
    await startGame(players);
    const [anna, ben, clara] = players as [TestClient, TestClient, TestClient];
    anna.close();
    await waitUntil(() => ben.room?.hostId === ben.me, "Ben wird Host", 2000);
    expect(clara.room?.hostId).toBe(ben.me);
    const back = await TestClient.connect(server.port);
    expect((await back.resume(anna.grant!)).ok).toBe(true);
    await waitUntil(() => back.room !== null, "Raumzustand");
    expect(back.room?.hostId).toBe(ben.me);
  });

  it("verlässt der Host das Spiel, gibt es sofort einen neuen Host, der über den Platz entscheidet", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben", "Clara"]);
    await startGame(players);
    const [anna, ben] = players as [TestClient, TestClient, TestClient];
    expect((await anna.request("room:leave", {})).ok).toBe(true);
    await waitUntil(() => ben.room?.hostId === ben.me, "Ben wird sofort Host", 200);
    await waitUntil(() => seatOf(ben, anna.me)?.needsDecision === true, "Entscheid sofort nötig", 200);
    expect(seatOf(ben, anna.me)?.left).toBe(true);
    expect(expectError(await ben.request("game:absent", { seatId: anna.me, decision: "wait" }))).toContain("kommt nicht zurück");
    // Wer gegangen ist, kommt mit dem alten Schlüssel nicht mehr hinein.
    const back = await TestClient.connect(server.port);
    expect((await back.resume(anna.grant!)).ok).toBe(false);
    expect((await ben.request("game:absent", { seatId: anna.me, decision: "bot" })).ok).toBe(true);
  });
});

describe("Leere Räume", () => {
  it("sind alle Menschen getrennt, ruht das Spiel; danach wird der Raum aufgeräumt", async () => {
    // Bots mit echter Denkpause (1 s), damit man sieht, dass sie ohne Menschen nicht weiterziehen.
    const server = await startServer({ timing: { emptyGameMs: 2000, botScale: 1 } });
    const [anna] = await setupRoom(server.port, ["Anna"]);
    await anna!.request("lobby:addBot", { level: "easy" });
    await startGame([anna!]);
    anna!.autoplay("easy");
    await waitUntil(() => anna!.state !== null && getWaitingFor(anna!.state) !== anna!.me, "Bot ist dran", 5000);
    const seq = anna!.seq;
    const grant = anna!.grant!;
    anna!.close();
    await sleep(1500);
    expect(server.registry.roomCount).toBe(1);
    const watcher = await TestClient.connect(server.port);
    expect((await watcher.resume(grant)).ok).toBe(true);
    await waitUntil(() => watcher.state !== null, "Vollstand");
    expect(watcher.seq).toBe(seq);
    // Mit einem Menschen im Raum zieht der Bot weiter.
    await waitUntil(() => watcher.seq > seq, "Bot zieht wieder", 3000);
    watcher.close();
    await waitUntil(() => server.registry.roomCount === 0, "Raum aufgeräumt", 4000);
    const late = await TestClient.connect(server.port);
    expect(expectError(await late.resume(grant))).toContain("gibt es nicht mehr");
  }, 15_000);

  it("eine leere Lobby verschwindet nach der Frist", async () => {
    const server = await startServer();
    const host = await TestClient.connect(server.port);
    await host.create("Anna");
    expect(server.registry.roomCount).toBe(1);
    host.close();
    await waitUntil(() => server.registry.roomCount === 0, "Lobby aufgeräumt", 2000);
  });
});
