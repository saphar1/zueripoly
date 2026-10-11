import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import { DesignDraft } from "./screens/DesignDraft";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DesignDraft />
  </StrictMode>,
);
