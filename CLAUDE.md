# CLAUDE.md – ZüriPoly

Online-Brettspiel im Stil von Monopoly, komplett in Zürich. Solo gegen Computergegner, lokal an einem Gerät, online mit Freunden.
Der Entwickler ist Lernender Plattformentwickler im 1. Lehrjahr: **wichtige Entscheidungen kurz und verständlich erklären.**
Alle Texte im Spiel und in der Doku: **Deutsch, Schweizer Schreibweise** (immer «ss», nie «ß»).

## Rechtliches (nie verletzen)
- Nie den Namen «Monopoly», kein Hasbro-Logo, keine Originalgrafiken, keine Originalfeldnamen oder -kartentexte.
- Spielregeln dürfen nachgebaut werden. Alle Namen, Karten und Grafiken sind eigene, zürcherische Inhalte.

## Technik
- TypeScript überall, strict. npm-Workspace mit drei Paketen:
  - `packages/engine`: reine Spiellogik, **keine UI, kein Netzwerk, keine Node-/DOM-APIs**. Mit Vitest gründlich getestet.
  - `packages/server`: Node.js + Socket.IO. **Der Server ist die einzige Wahrheit** über den Spielstand.
  - `packages/client`: Vite + React. Zeigt nur an und schickt Aktionen. Importiert die Engine für Solo und Lokal.
- Dieselbe Engine läuft für Solo, Lokal und Online. Zustand ist ein Wert, Aktionen sind Funktionen `(Zustand, Aktion) → neuer Zustand`; Zufall (Würfel, Mischen) kommt über eine übergebene, seedbare Zufallsquelle.
- Umgebung: **Windows 11, PowerShell, Node 24, npm 11, Git.** Skripte müssen unter Windows laufen (keine reinen Bash-Befehle in npm-Skripten, keine `rm -rf`, `cp` usw.).
- Hauptquellen der Wahrheit: `docs/regeln.md`, `docs/brett.md`, `docs/design.md`.

## Befehle
Im Projektordner `C:\Users\sapir\zueripoly`:
```powershell
npm install        # Abhängigkeiten
npm test           # Engine-Tests (Vitest)
npm run typecheck  # TypeScript in allen Paketen
npm run dev        # Server und Client gleichzeitig
npm run build      # Client bauen
```

## Namenskonventionen
- Code, Bezeichner, Dateinamen: **Englisch** (`PlayerState`, `rollDice`, `board.ts`). Texte für Spieler: Deutsch (`de-CH`).
- Dateien `kebab-case.ts`, React-Komponenten `PascalCase.tsx`, Typen `PascalCase`, Funktionen `camelCase`, Konstanten `UPPER_SNAKE`.
- Felder werden über Index 0 bis 39 angesprochen, Farbgruppen über feste IDs (`brown`, `lightblue`, `pink`, `orange`, `red`, `yellow`, `green`, `navy`).
- Geldbeträge sind ganze Zahlen in CHF.

## Design (Kurzfassung, Details in `docs/design.md`)
- Schweizer Grafikdesign + Zürcher Beschilderung (Tram, Haltestellenanzeige, Fahrplan). Strenges Raster, wenige kräftige Farben.
- Schriften: Bricolage Grotesque (Titel), Familjen Grotesk (Text). Lokal eingebunden.
- Schatten nur als harter Druckversatz. Eckenradius 0. Eigene SVG-Grafik, Linienstärke einheitlich.
- **Verboten:** violette/blaue Verläufe, Neon-Glow, Inter/Roboto/Arial/Systemschrift, Emojis als Icons, fremde Icon-Sets, Glassmorphism, Weichschatten, überall gleich runde Karten, Platzhaltertexte, Floskeln.
- Bewegung nur mit Sinn, `prefers-reduced-motion` respektieren, Stummschalter für Ton.
- Design-Tokens werden als CSS-Variablen geführt (Block in `docs/design.md`).

## Arbeitsweise
Arbeite in **Phasen**. Halte jede Phase klein und lauffähig. Teste die Engine, bevor eine Oberfläche gebaut wird. Siehe `PLAN.md` für den Stand.
1. Projekt aufsetzen und Dokumente
2. Engine mit allen Regeln und Tests
3. Designentwurf (statisch, **zur Freigabe zeigen und auf Okay warten**), danach spielbare Oberfläche (lokal)
4. Computergegner (regelbasiert, «einfach» und «clever»)
5. Server und Online-Spiel
6. Feinschliff: Animationen, Sounds, Mobile, Spielstand speichern

### Abschluss jeder Phase (genau so)
a) Alles testen und lauffähig machen.
b) `PLAN.md` aktualisieren: Erledigtes abhaken, nächste Schritte notieren.
c) In dieser `CLAUDE.md` festhalten: Entscheidungen, Befehle, bekannte Probleme, Konventionen, Designregeln.
d) Mit klarer Nachricht committen.
e) Dem Entwickler erklären, wie er das Spiel startet und was er ausprobieren soll.
f) Ausdrücklich schreiben: **«Phase X ist fertig und gesichert. Tippe jetzt /clear (oder starte eine neue Sitzung) und danach: Lies CLAUDE.md und PLAN.md und starte Phase Y.»**

Nach `/clear` kennt Claude den Verlauf nicht mehr. Alles Wichtige muss in `CLAUDE.md`, `PLAN.md` und `docs/` stehen. Wird eine Phase sehr lang, darf ein Neustart mittendrin vorgeschlagen werden, aber erst nachdem der Stand gesichert (committet) ist.

Design-Prüfung (Phase 3 und später): Screenshots (Playwright als Dev-Abhängigkeit), Desktop und Handy, kritisch gegen `docs/design.md` prüfen und verbessern.

## Stand und Entscheidungen
- **Phase 1 abgeschlossen**: Workspace, Gerüste, Doku. Details in `PLAN.md`.
- Schriften gewählt: Bricolage Grotesque + Familjen Grotesk.
- Preise und Mieten wie im Original, in CHF (`docs/brett.md`).
- Bots: regelbasiert, zwei Stufen (einfach, clever), keine Simulation.
- Server zuerst nur lokal / Heimnetz, Spielstände als JSON-Dateien (Ordner `saves/`, in `.gitignore`). Hosting später optional.
- Git: Branch `main`, ein Commit pro Phase.
- Regelabweichungen vom Original: siehe `docs/regeln.md`, Abschnitt 16.

## Bekannte Probleme
- Noch keine.
