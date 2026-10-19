// Neustart des Servers: Die Browser bewahren den verschlüsselten Stand auf und stellen den Raum wieder her.
import { describe, expect, it } from "vitest";
import { getWaitingFor } from "@zueripoly/engine";
import { TestClient, expectError, setupRoom, startGame, startServer, waitUntil } from "./helpers";

const KEY = Buffer.alloc(32, 3);

/** Alle spielen, bis Zug `turn` erreicht ist; danach warten, bis alle denselben Stand und Spielstand haben. */
async function playUntil(players: TestClient[], turn: number): Promise<void> {
  players.forEach((p) => p.autoplay("easy", (state) => state.turnNumber >= turn));
  await waitUntil(() => players.every((p) => (p.state?.turnNumber ?? 0) >= turn), `Zug ${turn}`, 20_000);
  players.forEach((p) => p.stopAutoplay());
  await waitUntil(() => {
    const seq = players[0]!.seq;
    return players.every((p) => p.seq === seq && p.save?.seq === seq);
  }, "gleicher Stand bei allen");
}

/** Neuer Browser nach dem Neustart: Raum wiederherstellen, dann mit dem alten Schlüssel zurück auf den Platz. */
async function comeBack(port: number, old: TestClient, blob = old.save!.blob!): Promise<TestClient> {
  const client = await TestClient.connect(port);
  const restored = await client.request("room:restore", { blob });
  if (!restored.ok) throw new Error(restored.error);
  return client;
}

describe("Spielstand nach einem Neustart des Servers", () => {
  it("die Spieler stellen den Raum wieder her und spielen mit demselben Stand weiter", async () => {
    const first = await startServer({ saveKey: KEY });
    const players = await setupRoom(first.port, ["Anna", "Ben"]);
    await players[0]!.request("lobby:addBot", { level: "clever" });
    await waitUntil(() => players.every((p) => p.room?.seats.length === 3), "Bot dabei");
    await startGame(players);
    await playUntil(players, 6);
    const [anna, ben] = players as [TestClient, TestClient];
    const before = { seq: anna.seq, state: JSON.stringify(anna.state), annaGrant: anna.grant!, benGrant: ben.grant! };
    expect(anna.save!.code).toBe(anna.grant!.code);
    await first.close();
    // Beim Beenden keine Abmeldung: Die Browser behalten Platz und Spielstand.
    expect(anna.closedReason).toBeNull();

    const second = await startServer({ saveKey: KEY });
    expect(expectError(await (await TestClient.connect(second.port)).resume(before.annaGrant))).toContain("gibt es nicht mehr");

    const anna2 = await comeBack(second.port, anna);
    const ben2 = await comeBack(second.port, ben);
    expect(second.registry.roomCount).toBe(1);
    expect((await anna2.resume(before.annaGrant)).ok).toBe(true);
    expect((await ben2.resume(before.benGrant)).ok).toBe(true);
    await waitUntil(() => anna2.state !== null && ben2.state !== null, "Vollstand");
    expect(anna2.seq).toBe(before.seq);
    expect(JSON.stringify(anna2.state)).toBe(before.state);
    expect(anna2.room?.seats.map((s) => [s.name, s.connected])).toEqual([
      ["Anna", true],
      ["Ben", true],
      [expect.any(String), true],
    ]);
    expect(anna2.room?.hostId).toBe(before.annaGrant.seatId);
    // Neue Stände kommen gleich nach dem Wiederverbinden.
    expect(anna2.save?.seq).toBe(before.seq);

    // Es geht weiter, auch der Bot zieht wieder.
    const turn = anna2.state!.turnNumber;
    await playUntil([anna2, ben2], turn + 6);
    expect(anna2.seq).toBeGreaterThan(before.seq);
    expect(JSON.stringify(anna2.state)).toBe(JSON.stringify(ben2.state));
    expect(anna2.updates.flatMap((u) => u.events).some((e) => e.type === "turnStarted" && e.player === "p3")).toBe(true);
  }, 40_000);

  it("kommen zwei Browser mit verschiedenen Ständen, gilt der neuere", async () => {
    const first = await startServer({ saveKey: KEY });
    const players = await setupRoom(first.port, ["Anna", "Ben"]);
    await startGame(players);
    await playUntil(players, 3);
    const [anna, ben] = players as [TestClient, TestClient];
    const old = anna.save!.blob!;
    const oldSeq = anna.seq;
    await playUntil(players, 6);
    const newSeq = ben.seq;
    expect(newSeq).toBeGreaterThan(oldSeq);
    await first.close();

    const second = await startServer({ saveKey: KEY });
    const anna2 = await comeBack(second.port, anna, old);
    const ben2 = await comeBack(second.port, ben);
    expect((await anna2.resume(anna.grant!)).ok).toBe(true);
    expect((await ben2.resume(ben.grant!)).ok).toBe(true);
    await waitUntil(() => anna2.seq === newSeq && ben2.seq === newSeq, "neuerer Stand bei beiden");

    // Nach dem ersten Spielzug gilt kein älterer Stand mehr.
    const mover = getWaitingFor(anna2.state!) === anna2.me ? anna2 : ben2;
    mover.autoplay("easy", () => false);
    await waitUntil(() => anna2.seq > newSeq, "weitergespielt");
    mover.stopAutoplay();
    const late = await TestClient.connect(second.port);
    expect((await late.request("room:restore", { blob: old })).ok).toBe(true);
    expect(anna2.seq).toBeGreaterThan(newSeq);
  }, 40_000);

  it("anderer Schlüssel, Unsinn oder zu gross: abgelehnt, kein Raum entsteht", async () => {
    const first = await startServer({ saveKey: KEY });
    const players = await setupRoom(first.port, ["Anna", "Ben"]);
    await startGame(players);
    await waitUntil(() => players[0]!.save !== null, "Spielstand");
    const blob = players[0]!.save!.blob!;
    await first.close();

    const other = await startServer({ saveKey: Buffer.alloc(32, 9) });
    const client = await TestClient.connect(other.port);
    expect(expectError(await client.request("room:restore", { blob }))).toContain("passt nicht");
    expect(expectError(await client.request("room:restore", { blob: 42 }))).toBe("Ungültige Anfrage.");
    expect(expectError(await client.request("room:restore", { blob: "z1." + "A".repeat(13_000) }))).toBe("Ungültige Anfrage.");
    expect(other.registry.roomCount).toBe(0);
  });

  it("wer das Spiel verlassen hat, kommt auch nach dem Neustart nicht zurück", async () => {
    const first = await startServer({ saveKey: KEY });
    const players = await setupRoom(first.port, ["Anna", "Ben", "Clara"]);
    await startGame(players);
    const [anna, ben] = players as [TestClient, TestClient];
    const seqBefore = anna.save?.seq ?? 0;
    expect((await ben.request("room:leave", {})).ok).toBe(true);
    // Neuer Stand ohne Bens Schlüssel (gleiche Spielnummer, aber neu versiegelt).
    await waitUntil(() => anna.save !== null && anna.save.seq === seqBefore && anna.room?.seats.find((s) => s.id === ben.me)?.left === true, "Ben ausgestiegen");
    await waitUntil(() => anna.save!.blob !== null, "Stand");
    const blob = anna.save!.blob!;
    await first.close();

    const second = await startServer({ saveKey: KEY });
    await comeBack(second.port, anna, blob);
    const ben2 = await TestClient.connect(second.port);
    expect(expectError(await ben2.resume(ben.grant!))).toContain("gibt es nicht mehr");
    const anna2 = await TestClient.connect(second.port);
    expect((await anna2.resume(anna.grant!)).ok).toBe(true);
    await waitUntil(() => anna2.room?.seats.find((s) => s.id === ben.me)?.needsDecision === true, "Host soll über Ben entscheiden");
  });
});
