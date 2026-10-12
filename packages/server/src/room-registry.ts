// Alle Räume des Servers: erstellen, beitreten, wiederverbinden, aufräumen.
// Eine Verbindung (Socket) gehört höchstens zu einem Raum.
import { generateRoomCode } from "./room-code";
import { Room, type RoomOutput, type Timing } from "./room";
import type { Reply, SeatGrant } from "./protocol";

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

  private close(room: Room, reason: string): void {
    room.dispose(reason);
    this.rooms.delete(room.code);
    for (const [socketId, r] of this.bySocket) if (r === room) this.bySocket.delete(socketId);
    this.out.log(`Raum ${room.code} aufgelöst: ${reason} (${this.rooms.size} Räume).`);
  }

  dispose(): void {
    clearInterval(this.sweeper);
    for (const room of [...this.rooms.values()]) this.close(room, "Der Server wird beendet.");
  }
}
