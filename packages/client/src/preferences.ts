// Einstellungen dieses Browsers (nicht Teil des Spiels): Tempo der Computergegner, Ton.
// Gespeichert in localStorage, jeder Zugriff in try/catch (privates Fenster). Bildschirme lesen sie mit
// `usePreference`, damit alle Stellen (Kopfleiste, Hauptmenü) gleich umschalten.
import { useSyncExternalStore } from "react";

export type BotSpeed = "normal" | "fast";

interface Preferences {
  botSpeed: BotSpeed;
  /** Ton an (Standard) oder stumm. */
  sound: boolean;
}

const KEY = "zueripoly.preferences";
const DEFAULTS: Preferences = { botSpeed: "normal", sound: true };

function load(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
    return {
      botSpeed: stored.botSpeed === "fast" ? "fast" : "normal",
      sound: stored.sound !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: Preferences = load();
const listeners = new Set<() => void>();

export function getPreferences(): Preferences {
  return current;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  current = { ...current, [key]: value };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Kein Speicher: gilt nur bis zum Neuladen.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return useSyncExternalStore(subscribe, () => current[key]);
}
