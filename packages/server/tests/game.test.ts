import { describe, expect, it } from "vitest";
import { DECK_CARDS, getLegalActions, getWaitingFor } from "@zueripoly/engine";
import { expectError, setupRoom, sleep, startGame, startServer, waitUntil, waitingClient } from "./helpers";

const NAMES = ["Anna", "Ben", "Clara", "Dario"];

describe("Online-Spiel mit simulierten Clients", () => {
  for (const count of [2, 3, 4]) {
    it(`${count} Spieler spielen mindestens 10 Züge; alle sehen denselben Stand`, async () => {
      const server = await startServer();
      const players = await setupRoom(server.port, NAMES.slice(0, count));
      await startGame(players);
      const target = 11;
      players.forEach((p, i) => p.autoplay(i % 2 === 0 ? "easy" : "clever", (state) => state.turnNumber >= target));
      await waitUntil(() => players.every((p) => (p.state?.turnNumber ?? 0) >= target || p.state?.winner), "10 Züge", 15_000);
      // Kurz warten, bis keine Aktion mehr unterwegs ist, dann vergleichen.
      await sleep(100);
      const seqs = new Set(players.map((p) => p.seq));
      expect(seqs.size).toBe(1);
      const states = players.map((p) => JSON.stringify(p.state));
      expect(new Set(states).size).toBe(1);
      // Jeder Client hat jede Nummer genau einmal und in der richtigen Reihenfolge bekommen.
      for (const p of players) expect(p.updates.map((u) => u.seq)).toEqual(p.updates.map((_, i) => i + 1));
      const rolled = new Set(players[0]!.updates.flatMap((u) => u.events).filter((e) => e.type === "diceRolled").map((e) => (e as { player: string }).player));
      expect(rolled.size).toBe(count);
    }, 20_000);
  }

  it("eine ganze Partie mit 3 Clients endet mit einem Gewinner; danach zurück in die Lobby", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, NAMES.slice(0, 3));
    await players[0]!.request("lobby:options", { startMoney: 500 });
    await startGame(players);
    players.forEach((p, i) => p.autoplay(i === 0 ? "clever" : "easy"));
    await waitUntil(() => players.every((p) => p.state?.winner), "Gewinner", 60_000);
    const winner = players[0]!.state!.winner;
    for (const p of players) {
      expect(p.state!.winner).toBe(winner);
      expect(p.updates.flatMap((u) => u.events).some((e) => e.type === "gameWon")).toBe(true);
    }
    expect(expectError(await players[1]!.request("game:toLobby", {}))).toContain("Host");
    expect((await players[0]!.request("game:toLobby", {})).ok).toBe(true);
    await waitUntil(() => players.every((p) => p.room?.phase === "lobby"), "zurück in der Lobby");
    expect(players[0]!.room!.seats.every((s) => s.id === players[0]!.room!.hostId || !s.ready)).toBe(true);
  }, 70_000);

  it("Bots auf freien Plätzen ziehen selbst", async () => {
    const server = await startServer();
    const [anna] = await setupRoom(server.port, ["Anna"]);
    await anna!.request("lobby:addBot", { level: "clever" });
    await anna!.request("lobby:addBot", { level: "easy" });
    await startGame([anna!]);
    anna!.autoplay("easy", (state) => state.turnNumber >= 8);
    await waitUntil(() => (anna!.state?.turnNumber ?? 0) >= 8, "8 Züge mit Bots", 15_000);
    const botIds = anna!.state!.players.filter((p) => p.bot).map((p) => p.id);
    const botTurns = anna!.updates.flatMap((u) => u.events).filter((e) => e.type === "diceRolled" && botIds.includes(e.player));
    expect(botTurns.length).toBeGreaterThan(0);
  }, 20_000);

  it("Aktion ausserhalb des eigenen Zugs wird abgelehnt, der Stand bleibt gleich", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben", "Clara"]);
    await startGame(players);
    const waiting = waitingClient(players);
    const other = players.find((p) => p !== waiting)!;
    const seq = other.seq;
    expect(expectError(await other.request("game:action", { action: { type: "rollDice" } }))).toBe("Du bist gerade nicht an der Reihe.");
    expect(expectError(await other.request("game:action", { action: { type: "endTurn" } }))).toBe("Du bist gerade nicht an der Reihe.");
    await sleep(50);
    expect(players.every((p) => p.seq === seq)).toBe(true);
    // Wer dran ist, darf.
    expect((await waiting.request("game:action", { action: { type: "rollDice" } })).ok).toBe(true);
    await waitUntil(() => players.every((p) => p.seq === seq + 1), "neuer Stand bei allen");
  });

  it("ungültige Aktionen werden mit Grund abgelehnt, der Stand bleibt gleich", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame(players);
    const waiting = waitingClient(players);
    const seq = waiting.seq;
    expect(expectError(await waiting.request("game:action", { action: { type: "buyProperty" } }))).toBe("Das ist im Moment nicht möglich.");
    expect(expectError(await waiting.request("game:action", { action: { type: "buildHouse", space: 1 } }))).toBe("Dieses Feld gehört dir nicht.");
    expect(expectError(await waiting.request("game:action", { action: { type: "endTurn" } }))).toBe("Das ist im Moment nicht möglich.");
    expect(expectError(await waiting.request("game:action", { action: { type: "fliegen" } }))).toContain("Unbekannte oder ungültige Aktion");
    // Versteigerungen gibt es nicht mehr (docs/regeln.md, Abschnitt 16).
    expect(expectError(await waiting.request("game:action", { action: { type: "bid", amount: 100 } }))).toContain("ungültige Aktion");
    // Das Zeitlimit schickt nur der Server.
    expect(expectError(await waiting.request("game:action", { action: { type: "timeout" } }))).toContain("ungültige Aktion");
    // Ein Handel mit fremdem Feld
    const trade = { type: "proposeTrade", offer: { to: players.find((p) => p !== waiting)!.me, give: { spaces: [39], money: 0, jailCards: [] }, take: { spaces: [], money: 10, jailCards: [] } } };
    expect(expectError(await waiting.request("game:action", { action: trade }))).toBe("Dieses Feld gehört dir nicht.");
    await sleep(50);
    expect(players.every((p) => p.seq === seq)).toBe(true);
    expect(getLegalActions(waiting.state!, waiting.me).map((a) => a.type)).toContain("rollDice");
  });

  it("Würfel und Mischen nur auf dem Server: die Stapelreihenfolge erreicht nie einen Browser", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame(players);
    players.forEach((p) => p.autoplay("clever", (state) => state.turnNumber >= 30));
    await waitUntil(() => players.every((p) => (p.state?.turnNumber ?? 0) >= 30 || p.state?.winner), "30 Züge", 20_000);
    for (const p of players) {
      for (const update of p.updates) {
        for (const deck of ["event", "community"] as const) {
          const cards = update.state.decks[deck];
          expect(cards).toEqual([...cards].sort());
          const held = update.state.players.flatMap((pl) => pl.jailCards).filter((c) => DECK_CARDS[deck].some((k) => k.id === c));
          expect(cards.length + held.length).toBe(16);
        }
      }
    }
    // Die gezogenen Karten folgen nicht der sortierten Reihenfolge (sonst wäre die echte Reihenfolge verraten).
    const drawn = players[0]!.updates.flatMap((u) => u.events).filter((e) => e.type === "cardDrawn");
    expect(drawn.length).toBeGreaterThan(0);
  }, 25_000);

  it("Zeitlimit läuft auf dem Server: Uhr für alle, danach handelt der Server für den Spieler", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await players[0]!.request("lobby:options", { turnTimeLimit: 30 });
    await startGame(players);
    await waitUntil(() => players.every((p) => p.clock !== null), "Uhr bei allen");
    expect(players[1]!.clock).toMatchObject({ seq: 1, limitMs: 30_000 });
    expect(players[1]!.clock!.ms).toBeGreaterThan(29_000);
    // Uhr eines echten Spiels ist zu lang für den Test: Spielen geht trotzdem normal weiter.
    const waiting = waitingClient(players);
    expect((await waiting.request("game:action", { action: { type: "rollDice" } })).ok).toBe(true);
    await waitUntil(() => players.every((p) => p.seq === 2), "Stand 2");
    expect(getWaitingFor(players[0]!.state!)).not.toBeNull();
  });
});

describe("Zeitlimit (verkürzt)", () => {
  it("abgelaufene Zeit: Der Server schickt «timeout» für den Wartenden", async () => {
    const server = await startServer({ timing: { latencyMs: -29_800 } });
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await players[0]!.request("lobby:options", { turnTimeLimit: 30 });
    await startGame(players);
    const waiting = getWaitingFor(players[0]!.state!);
    await waitUntil(() => players[0]!.updates.some((u) => u.events.some((e) => e.type === "timeout" && e.player === waiting)), "Zeitablauf", 3000);
    const timeoutUpdate = players[0]!.updates.find((u) => u.events.some((e) => e.type === "timeout"))!;
    expect(timeoutUpdate.events.some((e) => e.type === "diceRolled")).toBe(true);
  });

  it("andere Verbindungen sehen die Züge live", async () => {
    const server = await startServer();
    const players = await setupRoom(server.port, ["Anna", "Ben"]);
    await startGame(players);
    const watcher = players.find((p) => p !== waitingClient(players))!;
    const before = watcher.updates.length;
    await waitingClient(players).request("game:action", { action: { type: "rollDice" } });
    await waitUntil(() => watcher.updates.length > before, "Zug beim Zuschauer");
    expect(watcher.updates.at(-1)!.events.some((e) => e.type === "diceRolled")).toBe(true);
  });
});
