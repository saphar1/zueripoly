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
npm test           # Engine-Tests (Vitest, 300 Zufallspartien, 200 Bot-Partien) und Server-Tests (simulierte Clients), ~30 s
npm run typecheck  # TypeScript in allen Paketen
npm run dev        # Spielserver (Port 3001) und Client (Vite, http://localhost:5173) gleichzeitig; Online braucht beides
npm run build      # Client bauen
npm start          # Client bauen + Server liefert alles unter einer Adresse aus (gleiches WLAN, Port 3001)
npm run test -w @zueripoly/server                       # nur Server-Tests (~10 s)
npm run dev -w @zueripoly/server                        # nur Spielserver (startet bei Codeänderungen neu, Räume sind dann weg)
npm run dev -w @zueripoly/client                        # nur Client; Designentwurf: http://localhost:5173/entwurf.html
npm run screenshots -w @zueripoly/client                # Playwright: Desktop 1440×900 + Handy 390×844 nach screenshots/
npm run screenshots -w @zueripoly/client -- --details   # zusätzlich Brett-Viertel (2×) und Interaktionszustände
npm run playtest -w @zueripoly/client                   # Durchspiel-Test der Oberfläche (Playwright klickt zufällig)
npm run playtest -w @zueripoly/client -- --money 500    # kurze Partie bis zum Gewinner (wenig Startkapital)
npm run playtest -w @zueripoly/client -- --solo --bots 3 # Solo: klickt nur für «Anna», Bots ziehen selbst (Bilder solo-*.png)
npm run playtest -w @zueripoly/client -- --online       # Online: eigener Server, 3 Browserfenster spielen bis zum Gewinner, Ben lädt neu
npm run playtest -w @zueripoly/client -- --online --prod # wie GitHub Pages + Render: gebaute Seite unter /zueripoly/, Server unter anderer Adresse
npm run screenshots -w @zueripoly/client -- --online    # Online-Bildschirme Desktop + Handy (online-*.png)
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
- **Phase 5, Teil A abgeschlossen**: Spielserver mit Räumen, Lobby, Wiederverbinden und Host-Entscheiden; Online-Spiel im Browser, lokal mit mehreren Fenstern getestet. Details in `docs/online.md`.
- **Phase 5, Teil B (Freunde von eigenen Geräten)**: Entscheid 2026-10-13: alles gratis, Seite auf GitHub Pages, Spielserver auf Render (Frankfurt), dazu gleiches WLAN (`npm start`). Code und Tests fertig. Offen: Commits umschreiben, Repository hochladen, Pages und Render einrichten, mit Freunden testen (siehe `PLAN.md`).

### Freunde spielen (Phase 5, Teil B)
- Server (`server.ts`): neben `/socket.io` noch `/healthz` (für Render), `/api/lan-addresses` (nur für Anfragen vom eigenen PC, `isLoopback`) und mit `clientDir` die gebaute Seite (`static-files.ts`, ohne Bibliothek: nur GET/HEAD, nur Dateien im Ordner, `/assets/*` immutable, sonst `no-cache`). `index.ts` liefert `packages/client/dist` aus, ausser mit `--dev` (aus `npm run dev`).
- WLAN-Adresse (`lan.ts`): `routeAddress()` fragt per UDP-«connect» auf 192.0.2.1 (kein Paket) nach dem Adapter des Wegs ins Internet; der kommt zuerst. Grund: Viele PCs haben virtuelle Adapter (VirtualBox «Ethernet 3» 192.168.56.1, VMware …), die man am Namen nicht immer erkennt.
- Lobby (`OnlineLobby.tsx`, `useShareOrigin`): fragt `/api/lan-addresses` nur, wenn die Seite vom eigenen Server kommt (`!import.meta.env.DEV && !SERVER_URL`) und auf `localhost` läuft; sonst keine Anfrage (keine 404 in der Konsole). Raumlink immer mit `import.meta.env.BASE_URL`.
- GitHub Pages: Vite `base` aus `ZUERIPOLY_BASE` (Pages: `/<repository>/`), Serveradresse beim Bauen aus `VITE_ZUERIPOLY_SERVER` (`SERVER_URL` in `online/connection.ts`, Typ in `src/vite-env.d.ts`). Mit `SERVER_URL` wartet «Raum eröffnen» bis 75 s auf die Verbindung, und `OnlineStart` erklärt das Aufwecken (nach 3 s; nach 90 s «antwortet nicht»).
- Origin-Prüfung (`origin.ts`): Webseiten dürfen nur von der eigenen Adresse (Origin-Host = Host-Kopfzeile) oder aus `ZUERIPOLY_ORIGINS` verbinden; ohne `Origin` (Tests) erlaubt. Socket.IO `cors` + `allowRequest`.
- Deployment: `.github/workflows/pages.yml` (bei Push auf `main`: `npm ci`, `npm test`, bauen, veröffentlichen; Variable `ZUERIPOLY_SERVER_URL`), `render.yaml` (Blueprint, Gratisstufe, Frankfurt, Start `npm run start -w @zueripoly/server`, `ZUERIPOLY_ORIGINS` im Dashboard), `.node-version` (24) für beide. **Ein Push auf `main` veröffentlicht** (Pages und Render bauen neu, Render-Neustart löscht alle Räume). `tsx` ist im Server-Paket eine normale Abhängigkeit (Render startet damit).
- Alle Browser-Speicher-Schlüssel beginnen mit `zueripoly.` (alle Pages-Seiten eines GitHub-Kontos teilen sich eine Adresse).

### Server und Online (Phase 5, Teil A)
- Server `packages/server/src`: `protocol.ts` (Nachrichten, Typen, Konstanten; nur Typen und Konstanten, der Client importiert es als `@zueripoly/server/protocol`), `server.ts` (`startZueriServer`, Socket.IO, jede Anfrage begrenzt und in try/catch), `room-registry.ts` (Räume, Socket → Raum, Aufräumen), `room.ts` (Lobby, Spiel, Bots, Zeitlimit, Anwesenheit, Host), `parse.ts` (Eingänge neu bauen), `room-code.ts`, `rate-limit.ts`, `pace.ts` (Abspielzeit und Denkpausen wie im Client).
- **Der Server nimmt die Spieler-ID nie aus der Nachricht**, sondern aus der Verbindung, und lässt `applyAction` prüfen. Clients dürfen kein `timeout` schicken. Die Kartenstapel gehen sortiert raus (`publicState`), die Zufallsquellen nie.
- Anfragen immer mit Antwort `{ ok, … }` / `{ ok: false, error }` (deutsch). Neue Anfrage: in `protocol.ts` (`Requests`, `REQUEST_NAMES`), Prüfung in `parse.ts`, Handler in `server.ts`, Logik in `room.ts`, Test in `packages/server/tests`.
- Zeiten im Typ `Timing` (`room.ts`): Abwesenheit 60 s, leere Lobby 5 Min., leeres Spiel 10 Min. Tests setzen kurze Werte (`FAST` in `tests/helpers.ts`, Flutbremse dort weit offen; die echte Bremse prüft `robustness.test.ts`).
- Abwesenheit: nach `absentMs` Störungsmeldung für den Host: warten / Computer spielt weiter (Stufe clever, endet bei Rückkehr) / aus dem Spiel nehmen (`removePlayer` der Engine). Ausdrücklich verlassen = sofort Entscheid, kein Zurück. Host-Wechsel beim Verlassen sofort, beim Trennen nach `absentMs`. Sind alle Menschen getrennt, ruht das Spiel.
- Engine: `removePlayer(state, playerId)` ist ein Eingriff von aussen (kein Spielzug), Ereignis `playerRemoved`, danach `bankrupt` an die Bank (im Protokoll ausgeblendet).
- Client: `online/connection.ts` (`OnlineClient`, eine Instanz pro Fenster über `openOnlineClient`/`closeOnlineClient`, sicher gegen StrictMode), `online/seat-storage.ts` (Sitzplatz-Schlüssel in sessionStorage pro Fenster, localStorage für «Zurück in Raum …», alles in try/catch), `online/use-server-clock.ts`. `game/use-online-game.ts` spielt Server-Stände nacheinander ab (Warteschlange; ab 3 wartenden oder bei verstecktem Fenster springen; Lücke in `seq` → `game:sync`).
- Bildschirme: `App.tsx` → `OnlineStart` (Name, eröffnen, beitreten, `?raum=CODE`) → `OnlineRoom` (Lobby oder Spiel je nach `room.phase`, Meldungen) → `OnlineLobby` / `OnlineGameScreen`. Beim Laden mit Platz im sessionStorage direkt zurück in den Raum.
- Gemeinsame Spielansicht `screens/GameView.tsx` für Lokal, Solo und Online; Abspielen in `game/use-game-playback.ts` (aus `use-local-game` herausgelöst). `ActionPanel` hat `me` (online eigener Platz; wartet jemand anderes, Satz zur Lage wie bei Bots), `waitingLabel`/`waitingNote` und `endActions` statt fester Knöpfe.
- Gemeinsame Bausteine: `TokenPicker`, `GameOptionsForm` (ohne `onChange` nur lesen), `.segments` und `.chip` in `styles/base.css`. Neue Chips: `chip--you` («Du»), `chip--away` (gestrichelt rot: getrennt/ausgestiegen), `chip--host`, `chip--ready`, `chip--waiting`. Störungsmeldung `AbsentNotice` (Signalrot), `ConnectionBanner` (fest oben).
- Vite leitet `/socket.io` an `ZUERIPOLY_SERVER` weiter (Standard `http://localhost:3001`). Playwright-Skripte starten Spielserver und Vite selbst.

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
- Git: Branch `main`. Zwischenstände innerhalb einer Phase als «Phase X (Zwischenstand): …» (auf Wunsch des Entwicklers), der Abschluss als eigener Commit «Phase X: …». Der Ordner `.claude/` wird nicht committet. Commit-E-Mail in diesem Repository: `eekk7439@gmail.com` (das Repository ist öffentlich).
- Regelabweichungen vom Original: siehe `docs/regeln.md`, Abschnitt 16.

## Bekannte Probleme
- Zufallspartien können ewig dauern (Häusermangel-Patt: alle 32 Häuser verbaut, kein Hotel möglich). Der Test bricht nach 6000 Aktionen ab und verlangt nur, dass über 80 % mit Gewinner enden. Die Bots lösen das Patt selbst (Umbau zum Hotel), ihre Partien enden alle.
- Ohne Zeitlimit kann ein menschlicher Schuldner das Spiel blockieren, wenn er weder Geld auftreibt noch handelt (er darf nur Bankrott erklären, wenn nichts mehr reicht). Online fängt das Zeitlimit oder der Host-Entscheid bei Abwesenheit ab; lokal nicht.
- Online-Räume liegen nur im Speicher des Servers. Startet der Server neu (auch `tsx watch` bei jeder Codeänderung), sind alle Räume weg; die Browser zeigen dann «Den Raum … gibt es nicht mehr». Speichern kommt in Phase 6.
- Gleicher Platz in zwei Fenstern: Das zuletzt geöffnete gewinnt, das erste wird abgemeldet. Zum Testen mehrerer Spieler einfach neue Fenster oder Tabs öffnen (sessionStorage ist pro Tab).
- `npm audit` meldet Lücken in Vitest (nur Testwerkzeug, läuft nicht im Spiel). Behebung braucht Vitest 5 (grössere Umstellung), daher vorerst nicht.
- Das Browserfenster der Claude-App (Vorschau) zeichnet nicht, wenn die App im Hintergrund ist. Oberflächen-Prüfungen deshalb mit den Playwright-Skripten.
- Ist Port 5173 belegt (z. B. ein alter Dev-Server), nimmt Vite den nächsten freien Port (5174 …); die Adresse steht im Terminal.
- Lokal und Solo: Neu laden im Browser beendet die Partie (Spielstand speichern kommt in Phase 6). Online kommt man nach dem Neuladen auf seinen Platz zurück. Noch keine Töne und kein Stummschalter (Phase 6).
- Jedes der 40 Felder ist ein eigener Tab-Halt; für Tastatur-Spielende ist das viel. Später eventuell Pfeiltasten-Navigation über das Brett.
- Der Durchspiel-Test mit 1500 CHF Startkapital endet oft ohne Gewinner (die Zufallsstrategie belastet zu viel). Mit `--money 500` endet er meist nach 500–800 Schritten mit Gewinner.
- Solo mit 5 Bots: Zwischen zwei eigenen Zügen vergehen leicht 20–30 s (Denkpause pro Bot-Schritt). Eine Tempo-Einstellung gibt es noch nicht (Idee für Phase 6).
- Während Würfel und Figur noch laufen, zeigt die Tafel schon den nächsten Entscheid (bei Bots den Satz zur nächsten Lage). Gilt auch für Menschen (Knöpfe dann gesperrt).
- Render (Gratisstufe) schläft nach 15 Minuten ohne Verkehr (Aufwachen bis 1 Minute) und startet bei jedem Push neu: Laufende Online-Räume sind dann weg. Speichern kommt in Phase 6.
- WLAN: Beim ersten `npm start` fragt die Windows-Firewall nach Node.js; der Entwickler muss «Private Netzwerke» selbst zulassen (Claude ändert keine Sicherheitseinstellungen). Über `http://` kein Schreiben in die Zwischenablage (Ersatz: Link markieren).
- Auf dem PC des Entwicklers laufen oft noch ältere `npm run dev` (Port 3001 und 5173 belegt). Nicht beenden, sondern für eigene Prüfungen `PORT=3002` nutzen.
- In Git Bash wandelt MSYS Pfade in Umgebungsvariablen um (`ZUERIPOLY_BASE=/zueripoly/` wird zu `C:/Program Files/Git/zueripoly/`): dort `MSYS_NO_PATHCONV=1` davor setzen. PowerShell und GitHub Actions sind nicht betroffen.
- Noch kein Favicon (Browser fragen `/favicon.ico` an, 404). Phase 6.
- «clever» ist für Anfänger stark (handelt geschickt, nutzt aus, dass «einfach» nur Listenpreise rechnet). Wer gewinnen lernen will, beginnt mit «einfach».
