// Öffentliche Schnittstelle der Engine. Reine Spiellogik: keine UI, kein Netzwerk, keine Node-/DOM-APIs.
export const ENGINE_VERSION = "0.1.0";

export * from "./types";
export * from "./board";
export * from "./cards";
export * from "./game";
export * from "./rules";
export * from "./bot";
