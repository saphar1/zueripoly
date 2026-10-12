// Bildschirme der App: Hauptmenü → Lobby → Spiel. Einfacher Zustand, kein Router nötig.
import { useState } from "react";
import type { GameConfig } from "@zueripoly/engine";
import { createGame, createRandomSeed, createSeededRng } from "@zueripoly/engine";
import type { GameSession } from "./game/use-local-game";
import { GameScreen } from "./screens/GameScreen";
import { Lobby } from "./screens/Lobby";
import { MainMenu } from "./screens/MainMenu";

type Screen =
  | { kind: "menu" }
  | { kind: "lobby" }
  | { kind: "game"; session: GameSession; id: number };

/** Neues Spiel mit frischer, seedbarer Zufallsquelle. */
function newSession(config: GameConfig): GameSession {
  const rng = createSeededRng(createRandomSeed());
  return { initial: createGame(config, rng), rng };
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "menu" });
  // Letzte Einstellungen bleiben für «Nochmals spielen» und die Lobby erhalten.
  const [lastConfig, setLastConfig] = useState<GameConfig | null>(null);

  const start = (config: GameConfig) => {
    setLastConfig(config);
    setScreen({ kind: "game", session: newSession(config), id: Date.now() });
  };

  switch (screen.kind) {
    case "menu":
      return <MainMenu onLocal={() => setScreen({ kind: "lobby" })} />;
    case "lobby":
      return <Lobby initial={lastConfig} onStart={start} onBack={() => setScreen({ kind: "menu" })} />;
    case "game":
      return (
        <GameScreen
          key={screen.id}
          session={screen.session}
          onNewGame={() => (lastConfig ? start(lastConfig) : setScreen({ kind: "lobby" }))}
          onMenu={() => setScreen({ kind: "menu" })}
        />
      );
  }
}
