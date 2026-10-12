// Bildschirme der App: Hauptmenü → Lobby (lokal oder solo) → Spiel. Einfacher Zustand, kein Router nötig.
import { useState } from "react";
import type { GameConfig } from "@zueripoly/engine";
import { createGame, createRandomSeed, createSeededRng } from "@zueripoly/engine";
import type { GameSession } from "./game/use-local-game";
import { GameScreen } from "./screens/GameScreen";
import { Lobby, type LobbyMode } from "./screens/Lobby";
import { MainMenu } from "./screens/MainMenu";

type Screen =
  | { kind: "menu" }
  | { kind: "lobby"; mode: LobbyMode }
  | { kind: "game"; mode: LobbyMode; session: GameSession; id: number };

/** Neues Spiel mit frischer, seedbarer Zufallsquelle. Die Bots bekommen ihre eigene. */
function newSession(config: GameConfig): GameSession {
  const rng = createSeededRng(createRandomSeed());
  return { initial: createGame(config, rng), rng, botRng: createSeededRng(createRandomSeed()) };
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  // Letzte Einstellungen je Spielart bleiben für «Nochmals spielen» und die Lobby erhalten.
  const [lastConfig, setLastConfig] = useState<Record<LobbyMode, GameConfig | null>>({ local: null, solo: null });

  const start = (mode: LobbyMode, config: GameConfig) => {
    setLastConfig((current) => ({ ...current, [mode]: config }));
    setScreen({ kind: "game", mode, session: newSession(config), id: Date.now() });
  };

  switch (screen.kind) {
    case "menu":
      return (
        <MainMenu onLocal={() => setScreen({ kind: "lobby", mode: "local" })} onSolo={() => setScreen({ kind: "lobby", mode: "solo" })} />
      );
    case "lobby":
      return (
        <Lobby
          key={screen.mode}
          mode={screen.mode}
          initial={lastConfig[screen.mode]}
          onStart={(config) => start(screen.mode, config)}
          onBack={() => setScreen({ kind: "menu" })}
        />
      );
    case "game": {
      const config = lastConfig[screen.mode];
      return (
        <GameScreen
          key={screen.id}
          session={screen.session}
          onNewGame={() => (config ? start(screen.mode, config) : setScreen({ kind: "lobby", mode: screen.mode }))}
          onMenu={() => setScreen({ kind: "menu" })}
        />
      );
    }
  }
}
