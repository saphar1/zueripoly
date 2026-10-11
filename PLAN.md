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

## Phase 2: Engine mit allen Regeln und Tests  ← nächste Phase
- [ ] `types.ts`: Feld, Spieler, Spielzustand, Aktionen, Ereignisse (Protokolleinträge als Daten, nicht als Text)
- [ ] `board.ts`: 40 Felder aus `docs/brett.md` (inkl. Test: 40 Felder, 22/4/2/12)
- [ ] `cards.ts`: 2 × 16 Karten, seedbares Mischen, Freikarten
- [ ] Seedbare Zufallsquelle (Würfel, Mischen)
- [ ] `game.ts`: Spiel erstellen (2–6 Spieler, Optionen), Aktionen anwenden, gültige Aktionen abfragen
- [ ] Würfeln, Ziehen, Start-Geld, Pasch, dritter Pasch
- [ ] Kaufen und Versteigerung
- [ ] Miete (Strasse, Farbgruppe, Bahnhof, Versorger)
- [ ] Bauen und Verkaufen (gleichmässig, Hausmangel 32/12)
- [ ] Hypotheken (10 % Zins)
- [ ] Gefängnis (zahlen, Pasch, Freikarte, 3 Runden)
- [ ] Steuern, Ereignis- und Gemeindekarten, Jackpot-Option
- [ ] Handel (Felder, Geld, Freikarten)
- [ ] Schulden und Bankrott (Gläubiger oder Bank), Gewinner
- [ ] Zeitlimit-Option als Engine-Aktion (`timeout`)
- [ ] Spielstand als JSON (serialisieren und laden)
- [ ] Zufallsspiele: Hunderte komplette Partien mit zufälligen gültigen Aktionen laufen durch (Invarianten: Geldsumme, Häuser, Besitz)
- [ ] Abschluss der Phase gemäss `CLAUDE.md`

## Phase 3: Design und lokale Oberfläche
- [ ] Statischer HTML-Entwurf: Brett und Spielerpanel (zur Freigabe zeigen, **Okay abwarten**)
- [ ] Playwright als Dev-Abhängigkeit, Screenshots Desktop und Handy, gegen `docs/design.md` prüfen
- [ ] Tokens, Schriften lokal einbinden
- [ ] SVG-Figuren, Würfel, Icons
- [ ] Brett, Felder, Zoom
- [ ] Hauptmenü, Lokal-Lobby (Namen, Figuren, Optionen)
- [ ] Spielansicht, Aktionsleiste, Besitzkarten, Karten, Auktion, Handel, Protokoll
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
