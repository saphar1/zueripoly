import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GameState } from "@zueripoly/engine";
import { DEFAULT_OPTIONS, applyAction, chooseBotAction, createGame, createSeededRng, getWaitingFor } from "@zueripoly/engine";
import { SAVE_MAX_CHARS } from "../src/protocol";
import { type RoomSave, SAVE_MAX_AGE_MS, loadSaveKey, openRoom, sealRoom } from "../src/room-save";

const KEY = Buffer.alloc(32, 7);

/** Partie mit vollem Protokoll (200 Ereignisse) und gebauten Häusern: der grösste übliche Stand. */
function longGame(): { state: GameState; rngState: number } {
  const rng = createSeededRng(42);
  const bots = createSeededRng(43);
  const names = ["Anna", "Ben", "Clara", "Dario", "Elif", "Fabio"];
  const tokens = ["tram", "swan", "boeoegg", "fondue", "bike", "coffee"] as const;
  let state = createGame(
    { players: names.map((name, i) => ({ id: `p${i + 1}`, name, token: tokens[i]!, bot: "clever" as const })), options: DEFAULT_OPTIONS },
    rng,
  );
  for (let i = 0; i < 1500 && state.winner === null; i++) {
    const who = getWaitingFor(state)!;
    const result = applyAction(state, who, chooseBotAction(state, who, bots), rng);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return { state, rngState: rng.getState() };
}

function sample(state: GameState, rngState: number): RoomSave {
  return {
    code: "K7MP4",
    hostId: "p1",
    options: DEFAULT_OPTIONS,
    seats: state.players.map((p) => ({ id: p.id, name: p.name, token: p.token, bot: null, key: `schluessel-${p.id}`, left: false, standIn: null })),
    state,
    rngState,
    botRngState: 99,
    seq: 321,
    rev: 400,
    savedAt: Date.now(),
  };
}

describe("verschlüsselter Raum-Spielstand", () => {
  const { state, rngState } = longGame();

  it("versiegeln und öffnen ergibt denselben Stand; klein genug für «room:restore»", () => {
    const save = sample(state, rngState);
    const blob = sealRoom(save, KEY);
    expect(blob.startsWith("z1.")).toBe(true);
    expect(state.log.length).toBe(200);
    expect(blob.length).toBeLessThan(SAVE_MAX_CHARS);
    expect(openRoom(blob, KEY)).toEqual(save);
    // Geheimes steht nicht lesbar drin.
    expect(blob).not.toContain("schluessel");
    expect(Buffer.from(blob.slice(3), "base64url").toString("latin1")).not.toContain("schluessel");
  });

  it("jedes Mal anders verschlüsselt (zufälliger Startwert)", () => {
    const save = sample(state, rngState);
    expect(sealRoom(save, KEY)).not.toBe(sealRoom(save, KEY));
  });

  it("verändert, falscher Schlüssel, Unsinn: abgelehnt", () => {
    const blob = sealRoom(sample(state, rngState), KEY);
    const raw = Buffer.from(blob.slice(3), "base64url");
    raw[raw.length - 5]! ^= 1;
    expect(() => openRoom(`z1.${raw.toString("base64url")}`, KEY)).toThrow(/passt nicht/);
    expect(() => openRoom(blob, Buffer.alloc(32, 8))).toThrow(/passt nicht/);
    for (const junk of ["", "z1.", "z1.AAAA", "z2." + blob.slice(3), "hallo"]) expect(() => openRoom(junk, KEY)).toThrow(/passt nicht/);
  });

  it("älter als 24 Stunden: abgelehnt", () => {
    const blob = sealRoom(sample(state, rngState), KEY);
    expect(() => openRoom(blob, KEY, Date.now() + SAVE_MAX_AGE_MS + 1000)).toThrow(/zu alt/);
  });

  it("Schlüssel aus der Umgebung oder aus der Datei (wird angelegt und wiederverwendet)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zueripoly-key-"));
    try {
      const file = path.join(dir, "saves", "save-key");
      expect(loadSaveKey(KEY.toString("base64"), file).key).toEqual(KEY);
      expect(loadSaveKey("irgendein-text-von-render", file).key).toHaveLength(32);
      const first = loadSaveKey(undefined, file);
      expect(first.source).toContain("neu angelegt");
      expect(readFileSync(file, "utf8").trim()).toBe(first.key.toString("base64"));
      expect(loadSaveKey(undefined, file).key).toEqual(first.key);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
