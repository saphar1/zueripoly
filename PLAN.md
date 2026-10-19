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

## Phase 5: Server und Online  ✓ abgeschlossen
Vorarbeit: `docs/online.md` (Ablauf, Nachrichten, Grenzen), `docs/engine.md` (`removePlayer`).

Teil A: lokal lauffähig (Server und Client auf einem PC, mehrere Browserfenster) ✓
- [x] Engine: `removePlayer` (Spieler aus dem Spiel nehmen) mit 13 Tests und 50 Zufallspartien
- [x] Räume mit 5-stelligem Code ohne verwechselbare Zeichen, Beitreten per Code oder Link `?raum=`, 2–6 Plätze
- [x] Socket.IO-Protokoll (`protocol.ts`): Anfragen mit Antwort, Zustand und Ereignisse an alle; Server als einzige Wahrheit
- [x] Lobby: Name, Figur (jede nur einmal), bereit; Host: Optionen, Bots, Plätze entfernen, Start
- [x] Jede Aktion prüft die Engine für den Platz der Verbindung; Würfel und Mischen nur auf dem Server; Stapelreihenfolge geheim
- [x] Bots, Vertretung abwesender Spieler und Zeitlimit serverseitig, Denkpausen wie im Client
- [x] Wiederverbinden mit Sitzplatz-Schlüssel (sessionStorage/localStorage), «Getrennt» je Spieler, Host-Entscheid nach 60 s (warten, Computer, entfernen), Host-Wechsel
- [x] Robustheit: Eingaben neu gebaut, Namen gesäubert (16 Zeichen), Flutbremse, 16-KB-Grenze, leere Räume aufgeräumt
- [x] Client: Online-Start, Online-Lobby, Online-Spiel (nur eigener Platz bedienbar, Züge der anderen live), Störungsmeldung, Verbindungshinweis
- [x] Gemeinsame Spielansicht `GameView` und gemeinsames Abspielen `use-game-playback` für Lokal, Solo und Online
- [x] Tests: 43 Server-Tests mit simulierten Clients; Online-Durchspiel-Test mit 3 Browserfenstern (mit Neuladen); Screenshots Desktop und Handy

Teil B: Freunde spielen von eigenen Geräten
- [x] Optionen recherchiert und verglichen (WLAN, Tunnel, Render, GitHub Pages, bezahlt, eigene Domain; Tabelle in `docs/online.md`). **Entscheid 2026-10-13:** alles gratis, Seite auf GitHub Pages, Spielserver auf Render (Frankfurt), dazu gleiches WLAN, Gratis-Adressen; Commits mit `eekk7439@gmail.com`
- [x] Server liefert die gebaute Oberfläche selbst aus (`npm start`, eine Adresse für alles), `/healthz`
- [x] WLAN: Startmeldung und Lobby zeigen die Adresse des Wegs ins Internet (virtuelle Adapter stören nicht), `/api/lan-addresses` nur für den eigenen PC
- [x] GitHub Pages: Pfad `/zueripoly/` (`ZUERIPOLY_BASE`), Serveradresse beim Bauen (`VITE_ZUERIPOLY_SERVER`), Text beim Aufwecken des Servers, Workflow `.github/workflows/pages.yml` (testet, baut, veröffentlicht)
- [x] Render: `render.yaml` (Gratisstufe, Frankfurt), `.node-version`; Server erlaubt fremde Seiten nur aus `ZUERIPOLY_ORIGINS`
- [x] Tests: `static.test.ts`, `lan.test.ts`, `origin.test.ts` (67 Server-Tests), Durchspiel-Test `--online --prod` (Pages + Render nachgespielt) bis zum Gewinner
- [x] Commits auf `eekk7439@gmail.com` umgeschrieben, Repository `github.com/saphar1/zueripoly` (öffentlich) hochgeladen
- [x] Pages (**https://saphar1.github.io/zueripoly/**) und Render (**https://zueripoly.onrender.com**) eingerichtet; Serveradresse fest im Workflow
- [x] Live geprüft: Solo auf Pages; Online mit zwei Fenstern (Desktop + Handy) über Pages und Render, Beitritt über den Link, beide sehen denselben Stand, keine Konsolenfehler. Gefunden und behoben: Hinter dem Proxy von Render galt jede Anfrage als «eigener PC» (`isLocalRequest`)
- [x] Abschluss: Doku, Commit «Phase 5: …»

Verschoben auf Phase 6: Spielstände auf dem Server speichern (zusammen mit «Spielstand fortsetzen»).

## Phase 6: Feinschliff
Plan in Teilen (jeder Teil lauffähig, Zwischenstand-Commit). **Entscheide 2026-10-13:** Online-Räume überleben Neustarts über einen verschlüsselten Spielstand im Browser der Spieler (AES-GCM, Schlüssel nur auf dem Server); Töne im Browser erzeugt (Web Audio, keine Dateien); keine eigene Domain.

Teil A: Rückmeldungen aus dem ersten Spiel mit Freunden (2026-10-13, iPhone, Safari) ✓
- [x] Zoom-Leiste verdeckte die Ecke um «Start»: jetzt eigene Zeile unter dem Brett (`BoardViewport`)
- [x] Handy-Ansicht neu (Entwurf `entwurf.html?ansicht=spiel` am 2026-10-13 freigegeben): Kopfleiste «ZüriPoly · Zug n» mit «Menü», Brett, schmale Haltestellentafel, kompakte Tafel, ein Platz für Karte/Besitzkarte, Spieler als aufklappbare Zeilen, Protokoll eingeklappt
- [x] Zurück: Browser-Verlauf mit zwei Einträgen (`screen-history.ts`); Zurück-Geste führt ins Menü, im Spiel und Online-Raum zuerst Rückfrage; «Menü» in der Kopfleiste (Handy)
- [x] Bauen sichtbar: Knopf «Bauen · Farbe» auf der Tafel öffnet die Besitzkarte; Satz in der Kurzanleitung (README)
- [x] Durchspiel-Tests (lokal, solo, online) prüfen Zurück-Geste und bauen über den neuen Knopf

Teil R: Regeländerungen (Wunsch des Entwicklers, 2026-10-13) ✓
- [x] Steuerfelder günstiger: Staats- und Gemeindesteuer 100 CHF (statt 200), Serafe-Rechnung 50 CHF (statt 100)
- [x] Gefängnis: einen Zug ganz aussetzen (kein Pasch-Versuch), danach frei; Kaution oder Freikarte holen sofort raus
- [x] Versteigerungen ganz abschaffen: nicht gekaufte Felder bleiben frei; bei Bankrott an die Bank gehen Felder frei zurück
- [x] Bots, Client, Server, Tests, Doku (`regeln.md` Abschnitte 5, 6, 9, 10, 12, 16; `brett.md`, `engine.md`, `bots.md`) angepasst; Bot-Liga: alle 1200 Partien enden, clever gegen einfach 79 %

Teil R2: Balance und Wünsche aus weiteren Runden (2026-10-14) ✓
- [x] Mieten ausbalanciert, nur runde Beträge: Grundmiete etwa 8–19 % des Preises, 1. Haus mindestens 3 × Grundmiete, Häuser billiger Gruppen stärker (Hotel Braun +50 % … Dunkelblau ±0), teurer nie weniger Miete; Versorger 5 × / 10 ×; Hypothekenzins auf 5 CHF aufgerundet
- [x] Pasch seltener: 1 von 7 (gewichtete Würfeltabelle, eine Zufallszahl pro Wurf)
- [x] Nach einem Pasch nur durchfahren: Zwischenfeld zählt nicht (keine Miete, kein Kauf, keine Karte), erst das Endfeld
- [x] Ereigniskarte «Baubewilligung» (E06 statt zweiter «Tram verpasst»): behalten, gratis ein Haus oder Hotel bauen, nicht handelbar; Bots setzen sie sofort ein
- [x] Bot-Liga: alle Partien enden, clever gegen einfach 84 %, Spieldauer etwa wie vorher (Versuche in `docs/bots.md`); «einfach» kauft jetzt mit 80 % (keine Versteigerungen mehr)

Teil B: Spielstand speichern und fortsetzen (2026-10-19) ✓
- [x] Lokal und Solo: nach jeder Aktion in `localStorage` (`game/local-save.ts`, ein Speicherplatz), Neuladen führt zurück ins Spiel, «Spiel verlassen» behält den Stand, Linie 4 «Spielstand fortsetzen» im Hauptmenü, Hinweis in der Lobby («ersetzt das gespeicherte Spiel»), Spielende löscht den Stand
- [x] Online: verschlüsselter Spielstand (`room-save.ts`, AES-256-GCM, Schlüssel `ZUERIPOLY_SAVE_KEY` oder `saves/save-key`), Nachricht `game:save`, Anfrage `room:restore`; nach einem Neustart stellt der erste Browser den Raum wieder her, ein neuerer Stand gilt, solange noch nicht weitergespielt wurde; beim Beenden meldet der Server niemanden ab
- [x] Tests: `room-save.test.ts`, `restore.test.ts`, Spielende ohne Stand (`game.test.ts`); Durchspiel-Tests lokal/solo (neu laden, verlassen und fortsetzen), online `--restart` (auch mit `--prod`)
- [ ] Nach dem nächsten Push prüfen: Render hat `ZUERIPOLY_SAVE_KEY` (aus `render.yaml`, sonst im Dashboard unter Environment setzen); dann einmal live einen Neustart ausprobieren

Teil C: Ton, Bewegung, Handy, Kleines
- [x] Töne (Web Audio, `sound.ts`: Würfel, Karte, Tramglocke beim Kauf, Haus, Geld, Gefängnis, Sieg; erst nach dem ersten Klick, nicht bei verstecktem Tab) und Stummschalter `SoundToggle` (Hauptmenü, Handy-Kopfleiste, Desktop neben «Zug n»)
- [ ] Bewegung: Betragsmarke beim Kontostand, Häuser setzen sich; `prefers-reduced-motion`
- [ ] Mobile-Feinschliff Safari (`100dvh`, Safe Area, Eingabefelder ≥ 16 px), alle Bildschirme bei 390 × 844 und 375 × 667
- [x] Favicon (`public/favicon.svg`, `apple-touch-icon.png`), Bot-Tempo «normal / schnell» in der Solo-Lobby (`preferences.ts`, Pausen × 0,4)
