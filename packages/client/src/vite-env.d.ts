/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Adresse des Spielservers, wenn er nicht unter derselben Adresse wie die Seite läuft
   * (Seite auf GitHub Pages, Server auf Render). Leer: dieselbe Adresse wie die Seite.
   */
  readonly VITE_ZUERIPOLY_SERVER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
