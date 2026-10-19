// Alle Räume des Servers: erstellen, beitreten, wiederverbinden, aufräumen.
// Eine Verbindung (Socket) gehört höchstens zu einem Raum.
import { generateRoomCode } from "./room-code";
import { Room, type RoomOutput, type Timing } from "./room";
import type { Reply, SeatGrant } from "./protocol";
import { type RoomSave, openRoom, sealRoom } from "./room-save";

/** Höchstzahl gleichzeitiger Räume (Schutz vor Missbrauch). */
export const MAX_ROOMS = 500;

export interface RegistryOutput {
  emit(socketId: string, event: string, payload: unknown): void;
  log(message: string): void;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly bySocket = new Map<string, Room>();
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor(
    private readonly timing: Timing,
    private readonly out: RegistryOutput,
    /** Schlüssel für die aufbewahrten Spielstände (room-save.ts). */
    private readonly saveKey: Buffer,
  ) {
    this.sweeper = setInterval(() => this.sweep(), timing.sweepMs);
    this.sweeper.unref?.();
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(code);
  }

  roomOf(socketId: string): Room | undefined {
    return this.bySocket.get(socketId);
  }

  private output(): RoomOutput {
    return {
      emit: (socketId, event, payload) => this.out.emit(socketId, event, payload),
      release: (socketId, reason) => {
        this.bySocket.delete(socketId);
        this.out.emit(socketId, "room:closed", { reason });
      },
      log: (message) => this.out.log(message),
      seal: (save) => sealRoom(save, this.saveKey),
    };
  }

  /** Eine Verbindung, die schon in einem Raum ist, zuerst dort abmelden (wie ein Verbindungsabbruch). */
  private detach(socketId: string): void {
    const room = this.bySocket.get(socketId);
    if (!room) return;
    this.bySocket.delete(socketId);
    room.disconnect(socketId);
  }

  private remember(socketId: string, room: Room, reply: Reply<SeatGrant>): Reply<SeatGrant> {
    if (reply.ok) this.bySocket.set(socketId, room);
    return reply;
  }

  create(socketId: string, name: string): Reply<SeatGrant> {
    if (this.rooms.size >= MAX_ROOMS) return { ok: false, error: "Der Server ist gerade voll. Bitte später nochmals versuchen." };
    this.detach(socketId);
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();
    const room = new Room(code, this.timing, this.output());
    this.rooms.set(code, room);
    const reply = room.addHuman(socketId, name);
    if (!reply.ok) {
      this.rooms.delete(code);
      return reply;
    }
    this.out.log(`Raum ${code} eröffnet von ${name} (${this.rooms.size} Räume).`);
    return this.remember(socketId, room, reply);
  }

  join(socketId: string, code: string, name: string): Reply<SeatGrant> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: `Einen Raum ${code} gibt es nicht. Stimmt der Code?` };
    this.detach(socketId);
    return this.remember(socketId, room, room.addHuman(socketId, name));
  }

  resume(socketId: string, code: string, seatKey: string): Reply<SeatGrant> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: `Den Raum ${code} gibt es nicht mehr.` };
    if (this.bySocket.get(socketId) !== room) this.detach(socketId);
    return this.remember(socketId, room, room.resume(socketId, seatKey));
  }

  /**
   * Raum aus einem aufbewahrten Stand wiederherstellen (nach einem Neustart des Servers).
   * Gibt es den Raum schon (ein anderer Browser war schneller), gilt der neuere Stand, solange seither
   * noch nicht gespielt wurde. Danach meldet sich der Browser wie gewohnt mit «room:resume» an.
   */
  restore(blob: string): Reply<{ code: string }> {
    let save: RoomSave;
    try {
      save = openRoom(blob, this.saveKey);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Der Spielstand ist ungültig." };
    }
    const existing = this.rooms.get(save.code);
    if (existing) {
      if (existing.wasRestored) {
        existing.adoptNewer(save);
        return { ok: true, code: save.code };
      }
      return { ok: false, error: `Den Raum ${save.code} gibt es nicht mehr.` };
    }
    if (this.rooms.size >= MAX_ROOMS) return { ok: false, error: "Der Server ist gerade voll. Bitte später nochmals versuchen." };
    this.rooms.set(save.code, Room.fromSave(save, this.timing, this.output()));
    this.out.log(`Raum ${save.code} wiederhergestellt (Spielstand Nr. ${save.seq}, ${this.rooms.size} Räume).`);
    return { ok: true, code: save.code };
  }

  leave(socketId: string): Reply {
    const room = this.bySocket.get(socketId);
    if (!room) return { ok: false, error: "Du bist in keinem Raum." };
    const reply = room.leave(socketId);
    this.bySocket.delete(socketId);
    if (room.hasNoHumans()) this.close(room, "Alle haben den Raum verlassen.");
    return reply;
  }

  disconnect(socketId: string): void {
    this.detach(socketId);
  }

  /** Leere Räume löschen (niemand verbunden, länger als die Frist). */
  sweep(now = Date.now()): void {
    for (const room of [...this.rooms.values()]) {
      if (room.hasNoHumans()) this.close(room, "Alle haben den Raum verlassen.");
      else if (room.emptySince !== null && now - room.emptySince >= room.emptyLimitMs()) this.close(room, "Der Raum war zu lange leer.");
    }
  }

  private close(room: Room, reason: string, notify = true): void {
    room.dispose(reason, notify);
    this.rooms.delete(room.code);
    for (const [socketId, r] of this.bySocket) if (r === room) this.bySocket.delete(socketId);
    this.out.log(`Raum ${room.code} aufgelöst: ${reason} (${this.rooms.size} Räume).`);
  }

  dispose(): void {
    clearInterval(this.sweeper);
    for (const room of [...this.rooms.values()]) this.close(room, "Der Server wird beendet.", false);
  }
}
