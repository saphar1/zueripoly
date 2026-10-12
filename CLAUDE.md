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
- Hauptquellen der Wahrheit: `docs/regeln.md`, `docs/brett.md`, `docs/design.md`. Engine-Schnittstelle: `docs/engine.md`. Computergegner: `docs/bots.md`.

## Befehle
Im Projektordner `C:\Users\sapir\zueripoly`:
```powershell
npm install        # Abhängigkeiten
npm test           # Engine-Tests (Vitest), inkl. 300 Zufallspartien und 200 Bot-Partien (~15–25 s)
npm run typecheck  # TypeScript in allen Paketen
npm run dev        # Server und Client gleichzeitig
npm run build      # Client bauen
npm run dev -w @zueripoly/client                        # nur Client; Designentwurf: http://localhost:5173/entwurf.html
npm run screenshots -w @zueripoly/client                # Playwright: Desktop 1440×900 + Handy 390×844 nach screenshots/
npm run screenshots -w @zueripoly/client -- --details   # zusätzlich Brett-Viertel (2×) und Interaktionszustände
npm run playtest -w @zueripoly/client                   # Durchspiel-Test der Oberfläche (Playwright klickt zufällig)
npm run playtest -w @zueripoly/client -- --money 500    # kurze Partie bis zum Gewinner (wenig Startkapital)
npm run playtest -w @zueripoly/client -- --solo --bots 3 # Solo: klickt nur für «Anna», Bots ziehen selbst (Bilder solo-*.png)
npm run bots -w @zueripoly/engine                       # Bot-Liga: Siegquoten je Paarung (optional -- --games 500 --check)
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
- **Phase 3 abgeschlossen**: Design freigegeben (2026-10-12), lokal spielbar von Anfang bis Gewinner (Menü, Lobby, Spiel mit allen Entscheidungen, Handel, Zoom auf dem Handy). Durchspiel-Test der Oberfläche: `npm run playtest -w @zueripoly/client`.
- **Phase 4 abgeschlossen**: Computergegner «einfach» und «clever», Solomodus mit 1–5 Bots. 200 Bot-Partien in `npm test` (alle enden, clever schlägt einfach im Zweikampf in rund 90 %). Details in `docs/bots.md`.

### Computergegner (Phase 4)
- Engine: `bot.ts` (Entscheide je Lage, `BOT_NAMES`, `BOT_LEVEL_NAMES`), `bot-eval.ts` (Bewertung `positionValue`, `cashReserve`, `propertyWorth`, `patience`, `fairRatio`, kleine Helfer, `eventsThisTurn`), `bot-trade.ts` (Angebote prüfen und machen, Handel auf einer Kopie durchspielen). `bot-eval` wird nicht aus `index.ts` exportiert (intern).
- `chooseBotAction(state, playerId, rng, level?)` nur für den wartenden Spieler (sonst Fehler). Ausführen immer über `applyAction`, nie Abkürzungen.
- Fair: Bots lesen nie `state.decks` und bekommen nie die Spiel-Zufallsquelle, sondern eine eigene (`botRng`). Die Stufe der anderen Bots ist öffentlich (steht im Spielerpanel) und darf genutzt werden.
- Gedächtnis nur über `state.log` (Ereignisse seit dem letzten `turnStarted`): höchstens 1 Handelsangebot pro Zug, Verwaltungsschritte pro Zug begrenzt (clever 15, einfach 4), kürzlich abgelehnte Angebote nicht wiederholen.
- Damit jede Partie endet: Kompromissbereitschaft ab etwa 40 Runden (`patience`), Umbau bei Häusermangel (`rebuildForHotels`: Häuser einer schwächeren Gruppe verkaufen, stärkste Gruppe bis zum Hotel ausbauen).
- Erkenntnisse aus der Bot-Liga: Bauen entscheidet (clever darf für Häuser bis auf 30 % der Reserve gehen); im Zweikampf zahlt clever kein Geld für Felder (der Gegner baut sonst damit); Bargeld für den Ausbau eigener Gruppen zählt in der Bewertung mehr.
- Tests: `tests/bot.test.ts` (Einzelfälle, Fairness), `tests/bot-sim.ts` (Simulationsschleife ohne Vitest, auch für `scripts/bot-league.ts`), `tests/bot-games-a.test.ts` (100 gemischte Partien), `tests/bot-games-b.test.ts` (100 Zweikämpfe, clever ≥ 70 %). Wer die Bot-Logik ändert, prüft danach `npm run bots -w @zueripoly/engine`.
- Client: `game/use-bot-turns.ts` lässt Bots nach einer Denkpause ziehen (1 s, Folgeschritte 0,5 s, nach Karte 2 s, ohne Menschen 0,15 s). Die Pause ist Lesezeit, keine Animation, darum unabhängig von `prefers-reduced-motion`. Nur im Entwicklungsmodus: `?botpause=<ms>` (Durchspiel-Test). Wird eine Bot-Aktion abgelehnt, schickt der Hook `timeout` und warnt in der Konsole.
- `act` aus `use-local-game.ts` gibt `true`/`false` zurück. `GameSession` hat `botRng`. In `GameScreen` ruhen Verwalten, Würfelklick und Zeitlimit, solange ein Bot dran ist (`human`).
- Tafel bei Bots: `botStatus` in `ActionPanel.tsx` (ein Satz zur Lage mit Namen, Kopf «Am Zug · Computer, clever»), `aria-busy` ist dann `true` (der Durchspiel-Test wartet darauf). Bot-Angebote an Menschen ohne «zieht zurück»; eigenes Angebot an einen Bot kann man zurückziehen.
- Lobby: Prop `mode: "local" | "solo"`, `Seat.bot`; Solo: du + 1–5 Bots mit zufälligem Namen aus `BOT_NAMES`, Stufe als `.segments`. Namen müssen eindeutig sein (Prüfung in der Lobby). `App.tsx` merkt sich die letzten Einstellungen je Modus.
- Spielerpanel: Chip `chip--bot` «Computer · einfach/clever». Protokoll: `tradeProposed` nennt den Inhalt («Ueli bietet Anna den Letzigrund und 120 CHF für Höngg.»).

### Client (Phase 3, Teil 1)
- Entwurfsseite `entwurf.html` → `src/entwurf.tsx` → `screens/DesignDraft.tsx` mit Beispielzustand (`demo/demo-state.ts`) und Bewegungs-Demo ohne Spielregeln (`demo/use-demo.ts`). Bleibt als Stilreferenz bestehen.
- Komponenten in `src/components/`: `PascalCase.tsx` plus gleichnamige `.css` mit BEM-Klassen (`.tile__bar`). Farben nur über Tokens (`styles/tokens.css` = Kopie aus `docs/design.md`, Änderungen zuerst dort). Spielerfarben: `--player-<token>` und Schriftfarbe darauf `--player-<token>-on`.
- Brett: Grösse kommt von aussen (`--board-size`), alles darin rechnet in `--u` (eine Feldbreite, über Container-Einheiten). `@container board (max-width: 560px)` = Handy-Übersicht ohne Feldnamen; dort stehen Tafel und Besitzkarte unter dem Brett.
- Felder sind reine Anzeige (`Tile`, `CornerTile`); Hover, Fokus, Klick behandelt die Zelle `board__cell` in `Board.tsx`. Hover nur bei `pointerType === "mouse"`, auf Touch wählt Antippen aus.
- Bewegung: Dauern nur aus den Tokens `--motion-*`; JavaScript liest sie mit `motionMs()` (`src/motion.ts`). Bei `prefers-reduced-motion` sind alle 1 ms, Abläufe springen dann direkt ans Ziel.
- Texte: `format.ts` (`formatChf` mit ’, `hyphenate` = weiche Trennstellen für lange Feldnamen), `space-text.ts` (Feldbeschreibung, Feldregeln, Hinweis bei Ankunft).
- Wiederverwendbar für Teil 2: `Board` (Props für Hover, Auswahl, Hervorhebung, ziehende Figur, Overlay), `PlayerList`, `Sign`, `DeedCard`, `EventCard`, `Money`, `Dice`, `.button` / `.button--primary` (in `styles/base.css`).
- Schriften lokal über Fontsource: Bricolage `standard.css` (Gewicht + Breite 75–100 %), Familjen `wght.css`.

### Client (Phase 3, Teil 2: spielbar)
- `App.tsx` wechselt Bildschirme (`screens/MainMenu`, `screens/Lobby`, `screens/GameScreen`). Neues Spiel: `createSeededRng(createRandomSeed())` + `createGame` → `GameSession`.
- `game/use-local-game.ts`: `state` = Wahrheit (nach `applyAction`), `view` = Anzeige. Nach einer Aktion werden die Ereignisse abgespielt (Würfel, Figur Feld für Feld, Karte, Gefängnis), erst danach springt `view` auf `state`. Während `busy` nimmt der Hook keine Aktionen an. Die Augen beim Rollen kommen aus `Math.random`, nie aus der Spiel-Zufallsquelle.
- Wer entscheidet, sagt immer `getWaitingFor`; die Tafel (`components/ActionPanel.tsx`) bietet nur an, was `getLegalActions` erlaubt (Vergleich der ganzen Aktion, nicht nur `type`). Verwalten (bauen, verkaufen, belasten, auslösen) läuft über die angeklickte Besitzkarte (`PropertyActions`).
- Texte zu Ereignissen: `game-text.ts` (`formatEvent`, `formatEvents` fasst Wurf + Zug zusammen). Feldnamen mit Artikel über die Tabelle `GENDER` («die Enge», «das Seefeld», «Höngg» ohne Artikel). Keine Pronomen für Spieler, immer den Namen.
- Die Tafel hat `aria-busy`, solange eine Bewegung läuft (nutzt auch der Durchspiel-Test).
- Handel: `components/TradeComposer.tsx` (Angebot erstellen, prüft laufend mit `validateAction`), offene Angebote in `ActionPanel` (`TradeOfferView`: annehmen mit Auslösen, ablehnen, zurückziehen). Die Tafel kann mit `onAct(action, as)` auch für jemand anderen handeln (Anbieter zieht zurück).
- Zoom: `components/BoardViewport.tsx` nur unter 900 px Breite. Der Rahmen bekommt `--board-fit` (ganzes Brett passt) und setzt `--board-size = --board-fit × Zoom`. Zwei Finger zoomen (`touch-action: pan-x pan-y`), ein Finger verschiebt.
- Haltestellentafel: nach jeder Bewegung neu (`signFor`); ohne Bewegung wird nur der Hinweis nachgeführt (Kauf, Versteigerung, Bankrott …).
- Übersichtliches Spielfeld (nach Phase 4): Felder zeigen den Preis nur, solange sie frei sind; gekauft = Besitzerkreis, belastet = Ring (`tile__owner--mortgaged`) + schraffierter Balken, kein Text. Brettmitte: Tafel + Würfel im Mittelpunkt, Logo und Kartenstapel klein, Bankvorrat nur als Hinweis bei Knappheit (`SCARCE_HOUSES`/`SCARCE_HOTELS` in `BoardCenter.tsx`). Neue Elemente auf dem Brett nur, wenn sie für den nächsten Entscheid nötig sind.
- Durchspiel-Test `scripts/playtest.ts`: läuft mit `reducedMotion: "reduce"`, klickt meist den Hauptknopf, baut oft, handelt ab und zu, treibt bei Schulden Geld auf. Optionen `--steps`, `--players`, `--money`, `--snapshot`.

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
- Git: Branch `main`. Zwischenstände innerhalb einer Phase als «Phase X (Zwischenstand): …» (auf Wunsch des Entwicklers), der Abschluss als eigener Commit «Phase X: …». Der Ordner `.claude/` wird nicht committet.
- Regelabweichungen vom Original: siehe `docs/regeln.md`, Abschnitt 16.

## Bekannte Probleme
- Zufallspartien können ewig dauern (Häusermangel-Patt: alle 32 Häuser verbaut, kein Hotel möglich). Der Test bricht nach 6000 Aktionen ab und verlangt nur, dass über 80 % mit Gewinner enden. Die Bots lösen das Patt selbst (Umbau zum Hotel), ihre Partien enden alle.
- Ohne Zeitlimit kann ein menschlicher Schuldner das Spiel blockieren, wenn er weder Geld auftreibt noch handelt (er darf nur Bankrott erklären, wenn nichts mehr reicht). Online fängt das Zeitlimit oder (Phase 5) die Bot-Übernahme ab.
- Ist Port 5173 belegt (z. B. ein alter Dev-Server), nimmt Vite den nächsten freien Port (5174 …); die Adresse steht im Terminal.
- Neu laden im Browser beendet die Partie (Spielstand speichern kommt in Phase 6). Noch keine Töne und kein Stummschalter (Phase 6).
- Jedes der 40 Felder ist ein eigener Tab-Halt; für Tastatur-Spielende ist das viel. Später eventuell Pfeiltasten-Navigation über das Brett.
- Der Durchspiel-Test mit 1500 CHF Startkapital endet oft ohne Gewinner (die Zufallsstrategie belastet zu viel). Mit `--money 500` endet er meist nach 500–800 Schritten mit Gewinner.
- Solo mit 5 Bots: Zwischen zwei eigenen Zügen vergehen leicht 20–30 s (Denkpause pro Bot-Schritt). Eine Tempo-Einstellung gibt es noch nicht (Idee für Phase 6).
- Während Würfel und Figur noch laufen, zeigt die Tafel schon den nächsten Entscheid (bei Bots den Satz zur nächsten Lage). Gilt auch für Menschen (Knöpfe dann gesperrt).
- «clever» ist für Anfänger stark (handelt geschickt, nutzt aus, dass «einfach» nur Listenpreise rechnet). Wer gewinnen lernen will, beginnt mit «einfach».
