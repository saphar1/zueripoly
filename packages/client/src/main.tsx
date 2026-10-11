import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ENGINE_VERSION } from "@zueripoly/engine";

// Gerüst ohne Gestaltung. Das Design kommt in Phase 3 (siehe docs/design.md).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <p>ZüriPoly, Gerüst (Engine {ENGINE_VERSION})</p>
  </StrictMode>,
);
