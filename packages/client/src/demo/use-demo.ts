// Kleine Bewegungs-Demo für den Designentwurf: Würfel rollen, Figur zieht Feld für Feld,
// über Start zählt das Geld hoch, Karten werden umgedreht.
// Keine Spielregeln: Miete, Kauf und Karteneffekte passieren hier nicht (das macht später die Engine).
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardId, DeckId, Dice, GameState, PlayerId, PlayerState } from "@zueripoly/engine";
import {
  BOARD_SIZE,
  GO_TO_JAIL_INDEX,
  JAIL_INDEX,
  START_SALARY,
  createRandomSeed,
  createSeededRng,
  getSpace,
  rollDice,
} from "@zueripoly/engine";
import type { SignMessage } from "../components/Sign";
import { motionMs, wait } from "../motion";
import { landingNote } from "../space-text";
import { DEMO_MESSAGE, createDemoState } from "./demo-state";

function updatePlayer(state: GameState, id: PlayerId, change: (p: PlayerState) => PlayerState): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? change(p) : p)) };
}

function stopName(index: number): string {
  return index === JAIL_INDEX ? "Gefängnis, zu Besuch" : getSpace(index).name;
}

export function useDemo() {
  const [game, setGame] = useState<GameState>(createDemoState);
  const [message, setMessage] = useState<SignMessage>(DEMO_MESSAGE);
  const [rollingDice, setRollingDice] = useState<Dice | null>(null);
  const [movingPlayer, setMovingPlayer] = useState<PlayerId | null>(null);
  const [drawnCard, setDrawnCard] = useState<CardId | null>(null);
  const gameRef = useRef(game);
  const busy = useRef(false);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const roll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setDrawnCard(null);
    const rng = createSeededRng(createRandomSeed());
    const final = rollDice(rng);

    // 1. Würfel rollen: Augen wechseln, bis die Würfelzeit um ist.
    const rollTime = motionMs("dice");
    const started = performance.now();
    setRollingDice(rollDice(rng));
    while (performance.now() - started < rollTime - 90) {
      await wait(90);
      setRollingDice(rollDice(rng));
    }
    setRollingDice(null);
    setGame((g) => ({ ...g, turn: { ...g.turn, dice: final } }));

    // 2. Figur zieht Feld für Feld (bei reduzierter Bewegung: Sprung direkt ans Ziel).
    const mover = gameRef.current.players[gameRef.current.current];
    if (!mover) {
      busy.current = false;
      return;
    }
    const sum = final[0] + final[1];
    const target = (mover.position + sum) % BOARD_SIZE;
    const passesStart = mover.position + sum >= BOARD_SIZE;
    const step = motionMs("step");
    setMovingPlayer(mover.id);
    if (step <= 1) {
      setGame((g) =>
        updatePlayer(g, mover.id, (p) => ({
          ...p,
          position: target,
          inJail: false,
          jailTurns: 0,
          money: p.money + (passesStart ? START_SALARY : 0),
        })),
      );
    } else {
      for (let i = 1; i <= sum; i++) {
        const position = (mover.position + i) % BOARD_SIZE;
        const bonus = position === 0 ? START_SALARY : 0;
        setGame((g) =>
          updatePlayer(g, mover.id, (p) => ({ ...p, position, inJail: false, jailTurns: 0, money: p.money + bonus })),
        );
        await wait(step);
      }
    }
    setMovingPlayer(null);

    // 3. Tafel zeigt den neuen Halt.
    const line = `${mover.name} · ${final[0]} + ${final[1]}${final[0] === final[1] ? " · Pasch" : ""}`;
    if (target === GO_TO_JAIL_INDEX) {
      setMessage({ token: mover.token, line, label: "Nächster Halt", stop: "Gehe ins Gefängnis", note: "Direkt dorthin, ohne über Start." });
      await wait(Math.max(motionMs("card"), 1));
      setGame((g) => updatePlayer(g, mover.id, (p) => ({ ...p, position: JAIL_INDEX, inJail: true, jailTurns: 0 })));
    } else {
      setMessage({
        token: mover.token,
        line,
        label: "Nächster Halt",
        stop: stopName(target),
        note: landingNote(gameRef.current, target, sum, mover.id),
      });
    }
    busy.current = false;
  }, []);

  /** Oberste Karte ziehen; sie kommt danach unter den Stapel (wie in der Engine). */
  const draw = useCallback((deck: DeckId) => {
    const top = gameRef.current.decks[deck][0];
    if (!top) return;
    setDrawnCard(top);
    setGame((g) => ({ ...g, decks: { ...g.decks, [deck]: [...g.decks[deck].slice(1), top] } }));
  }, []);

  const closeCard = useCallback(() => setDrawnCard(null), []);

  return { game, message, rollingDice, movingPlayer, drawnCard, roll, draw, closeCard };
}
