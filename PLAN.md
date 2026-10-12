# PLAN.md – ZüriPoly

Legende: `[x]` erledigt, `[ ]` offen.

## Phase 1: Projekt aufsetzen
- [x] Git-Branch `main`, `.gitignore`, `.editorconfig`
- [x] npm-Workspace (`engine`, `server`, `client`), `tsconfig.base.json`
- [x] Engine-Gerüst mit Vitest und Rauchtest
- [x] Server-Gerüst (Socket.IO-Abhängigkeit, `tsx`)
- [x] Client-Gerüst (Vite + React), Ordner `screens, components, styles, assets, sounds`
- [x] `docs/regeln.md`
- [x] `docs/brett.md` (40 Felder, Preise, Mieten, 2 × 16 Karten)
- [x] `docs/design.md` (Idee, Palette, Schriften, Tokens, Komponenten)
- [x] `CLAUDE.md`, `PLAN.md`, `README.md`
- [x] `npm test` und `npm run typecheck` grün, Commit

## Phase 2: Engine mit allen Regeln und Tests
- [x] `types.ts`: Feld, Spieler, Spielzustand, Aktionen, Ereignisse (Protokolleinträge als Daten, nicht als Text)
- [x] `board.ts`: 40 Felder aus `docs/brett.md` (inkl. Test: 40 Felder, 22/4/2/12)
- [x] `cards.ts`: 2 × 16 Karten, seedbares Mischen, Freikarten
- [x] Seedbare Zufallsquelle (Würfel, Mischen): `random.ts`
- [x] `game.ts`: Spiel erstellen (2–6 Spieler, Optionen), Aktionen anwenden; `validate.ts`: gültige Aktionen abfragen
- [x] Würfeln, Ziehen, Start-Geld, Pasch, dritter Pasch
- [x] Kaufen und Versteigerung
- [x] Miete (Strasse, Farbgruppe, Bahnhof, Versorger)
- [x] Bauen und Verkaufen (gleichmässig, Hausmangel 32/12, Hotelabriss)
- [x] Hypotheken (10 % Zins)
- [x] Gefängnis (zahlen, Pasch, Freikarte, 3 Runden)
- [x] Steuern, Ereignis- und Gemeindekarten, Jackpot-Option
- [x] Handel (Felder, Geld, Freikarten, belastete Felder)
- [x] Schulden und Bankrott (Gläubiger oder Bank), Gewinner
- [x] Zeitlimit-Option als Engine-Aktion (`timeout`)
- [x] Spielstand als JSON (serialisieren und laden): `save.ts`
- [x] Zufallsspiele: 300 komplette Partien mit zufälligen gültigen Aktionen (Invarianten nach jeder Aktion, Geld-Protokoll am Ende): `invariants.ts`
- [x] Abschluss der Phase gemäss `CLAUDE.md`

## Phase 3: Design und lokale Oberfläche  ✓ abgeschlossen
Vorarbeit: `docs/design.md` und `docs/engine.md` lesen. Die Oberfläche nutzt `getWaitingFor`, `getLegalActions`, `applyAction` und formt Protokoll-Ereignisse in deutsche Sätze.

**Stand:** Designentwurf am 2026-10-12 freigegeben. Lokal spielbar von Anfang bis Gewinner: `npm run dev -w @zueripoly/client`, dann `http://localhost:5173/`. Entwurf bleibt als Stilreferenz unter `/entwurf.html`.

Teil 1: Design
- [x] Statischer Entwurf: Brett und Spielerpanel, gezeigt und freigegeben
- [x] Playwright als Dev-Abhängigkeit, Screenshots Desktop und Handy, gegen `docs/design.md` geprüft
- [x] Tokens, Schriften lokal einbinden
- [x] SVG-Figuren, Würfel, Icons
- [x] Brett und Felder, Hover/Fokus, Besitzkarte (`DeedCard`), Kartenumdrehen (`EventCard`), hochzählender Kontostand (`Money`)

Teil 2: spielbare Oberfläche
- [x] `main.tsx` → `App.tsx`: Bildschirme Hauptmenü → Lobby → Spiel (einfacher Zustand, kein Router)
- [x] Hauptmenü (Linientafel, noch nicht gebaute Spielarten «noch nicht in Betrieb»), Lokal-Lobby (Namen, Figuren, Startkapital, Jackpot, Zeitlimit)
- [x] Spielansicht: Hook `game/use-local-game.ts` (Zustand + `applyAction` + seedbare Zufallsquelle, spielt Ereignisse als Bewegung ab)
- [x] Tafel (`ActionPanel`) aus `getWaitingFor` + `getLegalActions`: Würfeln, Gefängnis, Kaufen, Versteigerung, Schulden, Bankrott, Hypothekenentscheid, Handelsangebot beantworten, Zug beenden, Spielende
- [x] Verwalten über die Besitzkarte (`PropertyActions`): bauen, verkaufen, belasten, auslösen, mit Grund, wenn Bauen nicht geht
- [x] Protokoll-Ereignisse als deutsche Sätze (`game-text.ts`), Spielprotokoll und Haltestellentafel daraus
- [x] Bewegungen: Würfel rollen, Figur hüpft, Karte dreht, Geld zählt (reduzierte Bewegung: springen)
- [x] Zeitlimit (`game/use-turn-timer.ts`, schickt `timeout`)
- [x] Durchspiel-Test der Oberfläche (`npm run playtest -w @zueripoly/client`): Partie bis zum Gewinner ohne Fehler
- [x] Handelsangebot erstellen (`TradeComposer`: Partner, zwei Spalten «Du gibst / Du bekommst», Geld, Freikarten, belastete Felder auslösen), Angebot annehmen mit Auslösen, zurückziehen
- [x] Zoom und Verschieben auf dem Handy (`BoardViewport`: zwei Finger, Knöpfe −/+, Tasten + − 0; ab ca. 160 % Feldnamen)
- [x] Abschluss: Screenshots Desktop und Handy geprüft, Doku, Commit «Phase 3»

## Phase 4: Computergegner  ✓ abgeschlossen
Vorarbeit: `docs/engine.md` (Ablauf, `getWaitingFor`, `getLegalActions`, `canProposeTrade`) und im Client `game/use-local-game.ts` (dort klinken sich die Bots ein: Ist der wartende Spieler ein Bot, wählt `bot.ts` die Aktion, der Hook führt sie mit kurzer Pause aus). `PlayerConfig.bot` («easy» / «clever») gibt es in der Engine schon.
- [x] `bot.ts`: Entscheidungsschnittstelle (Zustand → Aktion), `bot-eval.ts`, `bot-trade.ts`, Doku `docs/bots.md`
- [x] Stufe «einfach»
- [x] Stufe «clever» (Farbgruppen, Geldreserve, Bauen, Handel, Auktionen, Umbau bei Häusermangel)
- [x] Bot-gegen-Bot-Tests (200 Partien in `npm test`, alle enden; Liga: `npm run bots -w @zueripoly/engine`)
- [x] Solo-Modus im Client (1–5 Bots, Stufe je Bot, Denkpause `game/use-bot-turns.ts`, Tafel und Protokoll)
- [x] Durchspiel-Test `--solo --bots 3` ohne Fehler
- [x] Handy-Ansicht (375×812) der Solo-Lobby und Spielansicht geprüft, Build und lokaler Durchspiel-Test grün
- [x] Abschluss: Doku, Commit «Phase 4»

**Ergebnis Bot-Liga** (200 Partien je Paarung, alle beendet): clever gegen einfach 88 % Siege für clever, 1 clever gegen 3 einfach 79 % (gleich stark wären 25 %). Tabelle in `docs/bots.md`.

## Phase 5: Server und Online  ← nächste Phase
Vorarbeit: `docs/engine.md`, `docs/bots.md`, `packages/server/src/index.ts` (Gerüst). Der Server hält `GameState` + Spiel-Zufallsquelle (`SeededRng`, Stand mit `getState()` speicherbar) und eine eigene `botRng`; er prüft jede Aktion mit `applyAction` und schickt Zustand + Ereignisse an alle. Bots (auch Übernahme nach 5 Min. Abwesenheit, `chooseBotAction(..., level)`) und Zeitlimit (`timeout`) laufen auf dem Server, mit derselben Denkpause wie im Client. Spielstände mit `serializeGame` / `deserializeGame` im Ordner `saves/`.
- [ ] Räume, Raumcodes
- [ ] WebSocket-Protokoll (Aktionen rein, Zustand raus)
- [ ] Lobby mit Namen und Figurenwahl
- [ ] Wiederverbinden
- [ ] Server speichert Spielstände (JSON)
- [ ] Zeitlimit serverseitig
- [ ] Online mit Freunden getestet (lokales Netz)

## Phase 6: Feinschliff
- [ ] Animationen (Würfel, Figurenzug, Karte, Geldfluss), `prefers-reduced-motion`
- [ ] Sounds und Stummschalter
- [ ] Mobile-Feinschliff
- [ ] Spielstand speichern und fortsetzen (lokal und online)
- [ ] Optional: Hosting
