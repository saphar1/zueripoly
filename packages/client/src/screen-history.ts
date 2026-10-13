// Browser-Verlauf für die Bildschirme. Es gibt genau zwei Einträge: «base» (Hauptmenü) und «inner»
// (alles andere). So führt die Zurück-Geste aus jedem Bildschirm ins Hauptmenü statt aus der Seite.
// Im Spiel und im Online-Raum fragt die App zuerst nach («Spiel verlassen?»), statt still zu gehen.
// Die Adresse bleibt dabei unverändert (auch `?raum=`).
import { useCallback, useEffect, useRef } from "react";

const KEY = "zueripoly";
type Mark = "base" | "inner";

function currentMark(): Mark | null {
  const state: unknown = window.history.state;
  if (state && typeof state === "object" && KEY in state) {
    const mark = (state as Record<string, unknown>)[KEY];
    if (mark === "base" || mark === "inner") return mark;
  }
  return null;
}

const markState = (mark: Mark) => ({ [KEY]: mark });

// Nur einmal pro Seite einrichten (StrictMode ruft Effekte im Entwicklungsmodus doppelt auf).
let initialized = false;

interface ScreenHistoryOptions {
  /** Zeigt die App gerade das Hauptmenü? */
  inMenu: () => boolean;
  /** Zurück-Geste, während kein Menü angezeigt wird. */
  onBack: () => void;
}

/**
 * Hält den Browser-Verlauf passend zum Bildschirm. Gibt `sync(inner)` zurück: bei jedem
 * Bildschirmwechsel aufrufen (inner = nicht das Hauptmenü).
 */
export function useScreenHistory({ inMenu, onBack }: ScreenHistoryOptions) {
  const ignorePops = useRef(0);
  const options = useRef({ inMenu, onBack });
  options.current = { inMenu, onBack };

  const back = useCallback(() => {
    ignorePops.current += 1;
    window.history.back();
  }, []);

  const sync = useCallback(
    (inner: boolean) => {
      const mark = currentMark();
      if (inner && mark !== "inner") window.history.pushState(markState("inner"), "");
      else if (!inner && mark === "inner") back();
    },
    [back],
  );

  useEffect(() => {
    if (!initialized) {
      initialized = true;
      const mark = currentMark();
      const inMenuNow = options.current.inMenu();
      if (!inMenuNow && mark !== "inner") {
        window.history.replaceState(markState("base"), "");
        window.history.pushState(markState("inner"), "");
      } else if (inMenuNow && mark === "inner") {
        // Neu geladen in einem Bildschirm, den es nicht mehr gibt: zurück auf den Menü-Eintrag.
        back();
      } else if (mark === null) {
        window.history.replaceState(markState("base"), "");
      }
    }

    const onPop = () => {
      if (ignorePops.current > 0) {
        ignorePops.current -= 1;
        return;
      }
      if (currentMark() === "inner") {
        // Vorwärts-Geste aus dem Menü: es gibt nichts, wohin man vorwärts gehen könnte.
        if (options.current.inMenu()) back();
        return;
      }
      if (options.current.inMenu()) return;
      // Der Eintrag «inner» bleibt bestehen; ob wirklich ins Menü gewechselt wird, entscheidet onBack.
      window.history.pushState(markState("inner"), "");
      options.current.onBack();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [back]);

  return sync;
}

/** Ruft `run` bei jeder Erhöhung von `token` auf (nicht beim ersten Anzeigen). */
export function useSignal(token: number, run: () => void) {
  const seen = useRef(token);
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    if (token === seen.current) return;
    seen.current = token;
    latest.current();
  }, [token]);
}
