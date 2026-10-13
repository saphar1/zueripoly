// Bildschirme der App: Hauptmenü → Lobby (lokal oder solo) → Spiel, oder Online-Start → Raum.
// Einfacher Zustand, kein Router nötig; die Zurück-Geste regelt screen-history.ts.
import { useEffect, useRef, useState } from "react";
import type { GameConfig } from "@zueripoly/engine";
import { createGame, createRandomSeed, createSeededRng } from "@zueripoly/engine";
import type { SeatGrant } from "@zueripoly/server/protocol";
import { ROOM_LINK_PARAM } from "@zueripoly/server/protocol";
import type { GameSession } from "./game/use-local-game";
import { closeOnlineClient, openOnlineClient } from "./online/connection";
import { loadWindowSeat } from "./online/seat-storage";
import { useScreenHistory } from "./screen-history";
import { GameScreen } from "./screens/GameScreen";
import { Lobby, type LobbyMode } from "./screens/Lobby";
import { MainMenu } from "./screens/MainMenu";
import { OnlineRoom } from "./screens/OnlineRoom";
import { OnlineStart } from "./screens/OnlineStart";

type Screen =
  | { kind: "menu" }
  | { kind: "lobby"; mode: LobbyMode }
  | { kind: "game"; mode: LobbyMode; session: GameSession; id: number }
  | { kind: "online"; code: string }
  | { kind: "room"; resume: SeatGrant | null };

/** Neues Spiel mit frischer, seedbarer Zufallsquelle. Die Bots bekommen ihre eigene. */
function newSession(config: GameConfig): GameSession {
  const rng = createSeededRng(createRandomSeed());
  return { initial: createGame(config, rng), rng, botRng: createSeededRng(createRandomSeed()) };
}

/** Beim Laden: zurück in den Online-Raum dieses Fensters, oder Raumcode aus dem Link, sonst Hauptmenü. */
function firstScreen(): Screen {
  const seat = loadWindowSeat();
  if (seat) return { kind: "room", resume: seat };
  const code = new URLSearchParams(window.location.search).get(ROOM_LINK_PARAM);
  if (code) return { kind: "online", code };
  return { kind: "menu" };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(firstScreen);
  // Letzte Einstellungen je Spielart bleiben für «Nochmals spielen» und die Lobby erhalten.
  const [lastConfig, setLastConfig] = useState<Record<LobbyMode, GameConfig | null>>({ local: null, solo: null });
  // Zurück-Geste im Spiel oder Raum: Rückfrage «Spiel verlassen?» öffnen (jede Erhöhung einmal).
  const [leaveAsk, setLeaveAsk] = useState(0);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const start = (mode: LobbyMode, config: GameConfig) => {
    setLastConfig((current) => ({ ...current, [mode]: config }));
    setScreen({ kind: "game", mode, session: newSession(config), id: Date.now() });
  };

  const toMenu = () => {
    closeOnlineClient();
    setScreen({ kind: "menu" });
  };

  const syncHistory = useScreenHistory({
    inMenu: () => screenRef.current.kind === "menu",
    onBack: () => {
      const kind = screenRef.current.kind;
      if (kind === "game" || kind === "room") setLeaveAsk((n) => n + 1);
      else toMenu();
    },
  });
  useEffect(() => syncHistory(screen.kind !== "menu"), [screen.kind, syncHistory]);

  switch (screen.kind) {
    case "menu":
      return (
        <MainMenu
          onLocal={() => setScreen({ kind: "lobby", mode: "local" })}
          onSolo={() => setScreen({ kind: "lobby", mode: "solo" })}
          onOnline={() => setScreen({ kind: "online", code: "" })}
        />
      );
    case "lobby":
      return (
        <Lobby
          key={screen.mode}
          mode={screen.mode}
          initial={lastConfig[screen.mode]}
          onStart={(config) => start(screen.mode, config)}
          onBack={toMenu}
        />
      );
    case "game": {
      const config = lastConfig[screen.mode];
      return (
        <GameScreen
          key={screen.id}
          session={screen.session}
          onNewGame={() => (config ? start(screen.mode, config) : setScreen({ kind: "lobby", mode: screen.mode }))}
          onMenu={toMenu}
          leaveAsk={leaveAsk}
        />
      );
    }
    case "online":
      return (
        <OnlineStart
          client={openOnlineClient()}
          initialCode={screen.code}
          onSeated={() => setScreen({ kind: "room", resume: null })}
          onBack={toMenu}
        />
      );
    case "room":
      return (
        <OnlineRoom
          client={openOnlineClient()}
          resume={screen.resume}
          leaveAsk={leaveAsk}
          onExit={() => setScreen({ kind: "online", code: "" })}
        />
      );
  }
}
