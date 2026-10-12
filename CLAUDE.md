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
- Hauptquellen der Wahrheit: `docs/regeln.md`, `docs/brett.md`, `docs/design.md`. Engine-Schnittstelle: `docs/engine.md`.

## Befehle
Im Projektordner `C:\Users\sapir\zueripoly`:
```powershell
npm install        # Abhängigkeiten
npm test           # Engine-Tests (Vitest), inkl. 300 Zufallspartien (~12 s)
npm run typecheck  # TypeScript in allen Paketen
npm run dev        # Server und Client gleichzeitig
npm run build      # Client bauen
npm run dev -w @zueripoly/client                        # nur Client; Designentwurf: http://localhost:5173/entwurf.html
npm run screenshots -w @zueripoly/client                # Playwright: Desktop 1440×900 + Handy 390×844 nach screenshots/
npm run screenshots -w @zueripoly/client -- --details   # zusätzlich Brett-Viertel (2×) und Interaktionszustände
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
- **Phase 2 abgeschlossen**: Engine mit allen Regeln, 108 Tests, 300 Zufallspartien. Details in `docs/engine.md`.
- **Phase 3, Teil 1 (Design) fertig und freigegeben** (2026-10-12). Teil 2 (spielbare Oberfläche) offen, Reihenfolge in `PLAN.md`.

### Client (Phase 3, Teil 1)
- Entwurfsseite `entwurf.html` → `src/entwurf.tsx` → `screens/DesignDraft.tsx` mit Beispielzustand (`demo/demo-state.ts`) und Bewegungs-Demo ohne Spielregeln (`demo/use-demo.ts`). Bleibt als Stilreferenz bestehen.
- Komponenten in `src/components/`: `PascalCase.tsx` plus gleichnamige `.css` mit BEM-Klassen (`.tile__bar`). Farben nur über Tokens (`styles/tokens.css` = Kopie aus `docs/design.md`, Änderungen zuerst dort). Spielerfarben: `--player-<token>` und Schriftfarbe darauf `--player-<token>-on`.
- Brett: Grösse kommt von aussen (`--board-size`), alles darin rechnet in `--u` (eine Feldbreite, über Container-Einheiten). `@container board (max-width: 560px)` = Handy-Übersicht ohne Feldnamen; dort stehen Tafel und Besitzkarte unter dem Brett.
- Felder sind reine Anzeige (`Tile`, `CornerTile`); Hover, Fokus, Klick behandelt die Zelle `board__cell` in `Board.tsx`. Hover nur bei `pointerType === "mouse"`, auf Touch wählt Antippen aus.
- Bewegung: Dauern nur aus den Tokens `--motion-*`; JavaScript liest sie mit `motionMs()` (`src/motion.ts`). Bei `prefers-reduced-motion` sind alle 1 ms, Abläufe springen dann direkt ans Ziel.
- Texte: `format.ts` (`formatChf` mit ’, `hyphenate` = weiche Trennstellen für lange Feldnamen), `space-text.ts` (Feldbeschreibung, Feldregeln, Hinweis bei Ankunft).
- Wiederverwendbar für Teil 2: `Board` (Props für Hover, Auswahl, Hervorhebung, ziehende Figur, Overlay), `PlayerList`, `Sign`, `DeedCard`, `EventCard`, `Money`, `Dice`, `.button` / `.button--primary` (in `styles/base.css`).
- Schriften lokal über Fontsource: Bricolage `standard.css` (Gewicht + Breite 75–100 %), Familjen `wght.css`.

### Engine (Phase 2)
- Dateien: `types.ts` (alle Typen), `board.ts` (Felder, Konstanten), `cards.ts`, `random.ts` (Mulberry32, `createSeededRng`), `rules.ts` (reine Abfragen und Prüfungen), `validate.ts` (Aktion prüfen, `getLegalActions`, deutsche Fehlermeldungen), `game.ts` (`createGame`, `applyAction`), `invariants.ts`, `save.ts`.
- `applyAction(state, playerId, action, rng)` kopiert den Zustand (JSON-Kopie ohne Protokoll), arbeitet auf der Kopie und ruft danach `settle()` auf: Schulden automatisch zahlen, Versteigerungen aus der Warteschlange starten, Zug weitergeben, Gewinner feststellen.
- Das Spiel wartet immer auf genau einen Spieler (`getWaitingFor`). Vorrang: Handelsangebot > Hypothekenentscheid > Schuld > Versteigerung > Zug (`preRoll` / `buy` / `postRoll`).
- Jede Geldänderung läuft über `transfer()` und erzeugt ein `moneyTransferred`-Ereignis. Nie `money` direkt ändern, sonst schlägt `checkMoneyLog` fehl.
- `PropertyState.houses`: 0–4 Häuser, 5 = Hotel. Gebäudevorrat in `state.bank`.
- Kartenstapel: oberste Karte = Index 0, gezogene Karte kommt ans Ende; Freikarten bleiben beim Spieler bis zur Nutzung.
- Spieler-IDs «bank» und «jackpot» sind reserviert (Geldparteien im Protokoll).
- Figuren-IDs: `tram`, `swan`, `boeoegg`, `fondue`, `bike`, `coffee` (Namen in `TOKEN_NAMES`).
- `state.log` hält die letzten 200 Ereignisse; das vollständige Protokoll entsteht aus `createGame().log` plus allen `events` aus `applyAction`.
- Regelklarstellungen und weitere Abweichungen (Häuserversteigerung entfällt, Hotelabriss, Handel ohne Schulden, Schulden der Reihe nach usw.) stehen in `docs/regeln.md`, Abschnitt 16.
- Tests: `packages/engine/tests/helpers.ts` (`newGame`, `act` mit Invariantenprüfung, `dice(...)` für vorgegebene Würfe, `own`, `setHouses`, `cardOnTop`). Zufallspartien in `random-play.ts`, aufgeteilt auf zwei Testdateien (laufen parallel).
- Schriften gewählt: Bricolage Grotesque + Familjen Grotesk.
- Preise und Mieten wie im Original, in CHF (`docs/brett.md`).
- Bots: regelbasiert, zwei Stufen (einfach, clever), keine Simulation.
- Server zuerst nur lokal / Heimnetz, Spielstände als JSON-Dateien (Ordner `saves/`, in `.gitignore`). Hosting später optional.
- Git: Branch `main`, ein Commit pro Phase.
- Regelabweichungen vom Original: siehe `docs/regeln.md`, Abschnitt 16.

## Bekannte Probleme
- Zufallspartien können ewig dauern (Häusermangel-Patt: alle 32 Häuser verbaut, kein Hotel möglich). Der Test bricht nach 6000 Aktionen ab und verlangt nur, dass über 80 % mit Gewinner enden. Für echte Spieler (und die Bots in Phase 4) ist das kein Fehler der Engine.
- Ohne Zeitlimit kann ein menschlicher Schuldner das Spiel blockieren, wenn er weder Geld auftreibt noch handelt (er darf nur Bankrott erklären, wenn nichts mehr reicht). Online fängt das Zeitlimit oder (Phase 5) die Bot-Übernahme ab.
- Ist Port 5173 belegt (z. B. ein alter Dev-Server), nimmt Vite den nächsten freien Port (5174 …); die Adresse steht im Terminal. Die Startseite `/` zeigt bis Teil 2 nur das Gerüst, der Entwurf liegt unter `/entwurf.html`.
