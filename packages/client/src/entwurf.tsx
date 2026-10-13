import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import { DesignDraft } from "./screens/DesignDraft";
import { GameDraft } from "./screens/GameDraft";

// /entwurf.html: Brett und Spieler (Stilreferenz). /entwurf.html?ansicht=spiel: ganze Spielansicht mit Beispielstand.
const gameView = new URLSearchParams(window.location.search).get("ansicht") === "spiel";

createRoot(document.getElementById("root")!).render(<StrictMode>{gameView ? <GameDraft /> : <DesignDraft />}</StrictMode>);
