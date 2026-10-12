// Lokales Spiel an einem Gerät: hält den Spielstand, führt Aktionen über die Engine aus
// und spielt die Ereignisse danach als Bewegung ab (Würfel, Figur, Karte).
//
// Zwei Zustände:
//  - `state` ist die Wahrheit (Ergebnis von applyAction).
//  - `view` ist, was gerade angezeigt wird. Während einer Bewegung ist das noch der alte Stand
//    mit verschobener Figur; erst am Ende springt `view` auf `state` (Geld, Besitz, Gefängnis).
import { useCallback, useRef, useState } from "react";
import type { Action, CardId, Dice, GameEvent, GameState, PlayerId, PlayerState } from "@zueripoly/engine";
import { BOARD_SIZE, JAIL_INDEX, applyAction, getSpace, rollDice } from "@zueripoly/engine";
import type { Rng, SeededRng } from "@zueripoly/engine";
import type { SignMessage } from "../components/Sign";
import { formatEvents } from "../game-text";
import { motionMs, wait } from "../motion";
import { landingNote } from "../space-text";

export interface GameSession {
  initial: GameState;
  rng: SeededRng;
  /** Eigene Zufallsquelle der Computergegner (nie die des Spiels). */
  botRng: Rng;
}

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
}

const LOG_KEEP = 300;

/** Ereignisse ohne Bewegung, die den Hinweis auf der Haltestellentafel ersetzen. */
const FOLLOW_UP: readonly GameEvent["type"][] = [
  "propertyBought",
  "auctionWon",
  "auctionUnsold",
  "leftJail",
  "debtOpened",
  "bankrupt",
  "gameWon",
];

/** Nur für die Augen, die beim Rollen aufflackern. Nie die Spiel-Zufallsquelle verbrauchen. */
const FLICKER: Rng = { nextInt: (max) => Math.floor(Math.random() * max) };

function updatePlayer(state: GameState, id: PlayerId, change: (p: PlayerState) => PlayerState): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? change(p) : p)) };
}

/** Protokollzeilen mit Zugnummer; die Nummer springt bei jedem «turnStarted». */
function toEntries(state: GameState, all: readonly GameEvent[], startTurn: number, firstId: number): LogEntry[] {
  // Endet das Spiel im selben Schritt, gibt es keinen Hypothekenentscheid mehr zu treffen.
  const ended = all.some((e) => e.type === "gameWon");
  const events = ended ? all.filter((e) => e.type !== "mortgageDecisionRequired") : all;
  const entries: LogEntry[] = [];
  let turn = startTurn;
  let chunk: GameEvent[] = [];
  const flush = () => {
    for (const text of formatEvents(state, chunk)) entries.push({ id: firstId + entries.length, turn, text });
    chunk = [];
  };
  for (const event of events) {
    if (event.type === "turnStarted") {
      flush();
      turn = event.turnNumber;
    }
    chunk.push(event);
  }
  flush();
  return entries;
}

/** Tafel nach einer Bewegung: Wer, welcher Wurf, nächster Halt, was dort passiert. */
function signFor(next: GameState, events: readonly GameEvent[]): SignMessage | null {
  const won = events.find((e) => e.type === "gameWon");
  const winner = won && next.players.find((p) => p.id === won.player);
  if (winner) {
    return { token: winner.token, line: "Endstation", label: "Gewinner", stop: winner.name, note: `${winner.name} gewinnt ZüriPoly!` };
  }
  let moveIndex = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "moved" || e.type === "sentToJail") {
      moveIndex = i;
      break;
    }
  }
  if (moveIndex < 0) return null;
  const last = events[moveIndex]!;
  if (last.type !== "moved" && last.type !== "sentToJail") return null;
  const player = next.players.find((p) => p.id === last.player);
  if (!player) return null;

  const roll = [...events.slice(0, moveIndex + 1)]
    .reverse()
    .find((e): e is Extract<GameEvent, { type: "diceRolled" }> => e.type === "diceRolled" && e.player === player.id);
  const line = roll ? `${player.name} · ${roll.dice[0]} + ${roll.dice[1]}${roll.dice[0] === roll.dice[1] ? " · Pasch" : ""}` : player.name;

  if (last.type === "sentToJail") {
    return { token: player.token, line, label: "Nächster Halt", stop: "Gefängnis", note: "Direkt dorthin, ohne über Start." };
  }
  const after = events.slice(moveIndex + 1).filter((e) => e.type !== "turnEnded" && e.type !== "turnStarted");
  const lines = formatEvents(next, after).slice(0, 2);
  const sum = roll ? roll.dice[0] + roll.dice[1] : 0;
  const stop = last.to === JAIL_INDEX ? "Gefängnis, zu Besuch" : getSpace(last.to).name;
  const note = lines.length > 0 ? lines.join(" ") : landingNote(next, last.to, sum, player.id);
  return { token: player.token, line, label: "Nächster Halt", stop, note };
}

/** Tafel vor dem ersten Wurf: wer beginnt, in welcher Reihenfolge. */
function departure(state: GameState): SignMessage | null {
  const first = state.players[state.current];
  if (!first) return null;
  return {
    token: first.token,
    line: `${first.name} beginnt`,
    label: "Abfahrt",
    stop: "Start",
    note: `Reihenfolge: ${state.players.map((p) => p.name).join(", ")}.`,
  };
}

export function useLocalGame(session: GameSession) {
  const rng = useRef(session.rng);
  const truth = useRef(session.initial);
  const busyRef = useRef(false);
  const nextLogId = useRef(0);

  const [state, setState] = useState(session.initial);
  const [view, setView] = useState(session.initial);
  const [busy, setBusy] = useState(false);
  const [rollingDice, setRollingDice] = useState<Dice | null>(null);
  const [movingPlayer, setMovingPlayer] = useState<PlayerId | null>(null);
  const [card, setCard] = useState<CardId | null>(null);
  const [message, setMessage] = useState<SignMessage | null>(() => departure(session.initial));
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>(() => {
    const entries = toEntries(session.initial, session.initial.log, 1, 0);
    nextLogId.current = entries.length;
    return entries;
  });

  /** Ereignisse nacheinander zeigen, danach den neuen Stand übernehmen. */
  const play = useCallback(async (previous: GameState, events: readonly GameEvent[], next: GameState) => {
    let shown = previous;
    const show = (value: GameState) => {
      shown = value;
      setView(value);
    };

    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      switch (event.type) {
        case "diceRolled": {
          const duration = motionMs("dice");
          const started = performance.now();
          while (performance.now() - started < duration - 90) {
            setRollingDice(rollDice(FLICKER));
            await wait(90);
          }
          setRollingDice(null);
          show({ ...shown, turn: { ...shown.turn, dice: event.dice } });
          break;
        }
        case "moved": {
          const step = motionMs("step");
          const delta = event.direction === "forward" ? 1 : -1;
          setMovingPlayer(event.player);
          if (step <= 1) {
            show(updatePlayer(shown, event.player, (p) => ({ ...p, position: event.to, inJail: false })));
          } else {
            let position = event.from;
            while (position !== event.to) {
              position = (position + delta + BOARD_SIZE) % BOARD_SIZE;
              const at = position;
              show(updatePlayer(shown, event.player, (p) => ({ ...p, position: at, inJail: false })));
              await wait(step);
            }
          }
          setMovingPlayer(null);
          break;
        }
        case "sentToJail":
          await wait(Math.max(motionMs("card"), 1));
          show(updatePlayer(shown, event.player, (p) => ({ ...p, position: JAIL_INDEX, inJail: true })));
          break;
        case "cardDrawn":
          setCard(event.card);
          // Wenn die Karte die Figur noch bewegt: kurz lesen lassen, dann weiter.
          if (events.slice(i + 1).some((e) => e.type === "moved" || e.type === "sentToJail")) {
            await wait(motionMs("card") + 1400);
          }
          break;
        default:
          break;
      }
    }

    setView(next);
    const sign = signFor(next, events);
    if (sign) setMessage(sign);
    else {
      // Ohne Bewegung: Tafel nachführen, wenn am Halt etwas entschieden wurde (Kauf, Versteigerung, Bankrott …).
      const decided = events.filter((e) => FOLLOW_UP.includes(e.type));
      const lines = formatEvents(next, decided).slice(0, 2);
      if (lines.length > 0) setMessage((current) => (current ? { ...current, note: lines.join(" ") } : current));
    }
    const entries = toEntries(next, events, previous.turnNumber, nextLogId.current);
    nextLogId.current += entries.length;
    setLog((current) => [...current, ...entries].slice(-LOG_KEEP));
    busyRef.current = false;
    setBusy(false);
  }, []);

  /**
   * Aktion für einen Spieler ausführen. Ungültige Aktionen ändern nichts und zeigen den Grund.
   * Gibt zurück, ob die Aktion ausgeführt wurde.
   */
  const act = useCallback(
    (playerId: PlayerId, action: Action): boolean => {
      if (busyRef.current) return false;
      const previous = truth.current;
      const result = applyAction(previous, playerId, action, rng.current);
      if (!result.ok) {
        setError(result.error.message);
        return false;
      }
      setError(null);
      setCard(null);
      truth.current = result.state;
      setState(result.state);
      busyRef.current = true;
      setBusy(true);
      void play(previous, result.events, result.state);
      return true;
    },
    [play],
  );

  const dismissCard = useCallback(() => setCard(null), []);

  return { state, view, busy, rollingDice, movingPlayer, card, message, error, log, act, dismissCard };
}

export type LocalGame = ReturnType<typeof useLocalGame>;
