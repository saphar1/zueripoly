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

## Phase 3: Design und lokale Oberfläche  ← nächste Phase
Vorarbeit: `docs/design.md` und `docs/engine.md` lesen. Die Oberfläche nutzt `getWaitingFor`, `getLegalActions`, `applyAction` und formt Protokoll-Ereignisse in deutsche Sätze.

**Stand:** Statischer Entwurf (Brett + Spielerpanels, fester Beispiel-Spielstand) gebaut, **wartet auf das Okay des Entwicklers**. Ansehen: `npm run dev -w @zueripoly/client`, dann `http://localhost:5173/entwurf.html`. Screenshots: `npm run screenshots -w @zueripoly/client` (optional `-- --details`). Noch keine spielbare Oberfläche, `main.tsx` ist noch das Gerüst.
- [ ] Statischer HTML-Entwurf: Brett und Spielerpanel (zur Freigabe zeigen, **Okay abwarten**)
- [ ] Playwright als Dev-Abhängigkeit, Screenshots Desktop und Handy, gegen `docs/design.md` prüfen
- [ ] Tokens, Schriften lokal einbinden
- [ ] SVG-Figuren, Würfel, Icons
- [ ] Brett, Felder, Zoom
- [ ] Hauptmenü, Lokal-Lobby (Namen, Figuren, Optionen)
- [ ] Spielansicht, Aktionsleiste, Besitzkarten, Karten, Auktion, Handel, Protokoll
- [ ] Protokoll-Ereignisse (`GameEvent`) als deutsche Sätze formatieren
- [ ] Lokal spielbar von Anfang bis Gewinner

## Phase 4: Computergegner
- [ ] `bot.ts`: Entscheidungsschnittstelle (Zustand → Aktion)
- [ ] Stufe «einfach»
- [ ] Stufe «clever» (Farbgruppen, Geldreserve, Bauen, Handel, Auktionen)
- [ ] Solo-Modus im Client (1–5 Bots)
- [ ] Bot-gegen-Bot-Tests (kein Hängen, beendet Partien)

## Phase 5: Server und Online
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
